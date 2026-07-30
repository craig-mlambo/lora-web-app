import { fail } from '@sveltejs/kit';
import { requireActiveProfile } from '$lib/server/authorization.js';
import { assertPrepaidAccountAccess } from '$lib/server/ownerScope.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {App.Locals} locals
 * @param {string[]} accountIds
 */
async function fetchLedger(locals, accountIds) {
	/** @type {any[]} */
	const rows = [];
	const pageSize = 1000;
	for (let offset = 0; offset < 10_000; offset += pageSize) {
		const { data, error } = await locals.supabase
			.from('water_ledger_entries')
			.select('id, prepaid_account_id, entry_type, litres_delta, description, occurred_at')
			.in('prepaid_account_id', accountIds)
			.order('occurred_at', { ascending: false })
			.range(offset, offset + pageSize - 1);
		if (error) return { data: [], error };
		rows.push(...(data ?? []));
		if ((data ?? []).length < pageSize) break;
	}
	return { data: rows, error: null };
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const { households, householdLoadError } = await parent();
	if (householdLoadError || households.length === 0)
		return { accounts: [], payments: [], ledger: [], loadError: householdLoadError };

	const householdIds = households.map((household) => household.id);
	const { data: accounts, error: accountsError } = await locals.supabase
		.from('prepaid_accounts')
		.select('id, household_id, currency, status, low_balance_threshold_litres, opened_at')
		.in('household_id', householdIds)
		.order('opened_at');
	if (accountsError)
		return { accounts: [], payments: [], ledger: [], loadError: accountsError.message };
	const accountIds = (accounts ?? []).map((account) => account.id);
	const householdById = new Map(households.map((household) => [household.id, household]));
	const enrichedAccounts = (accounts ?? []).map((account) => ({
		...account,
		household: householdById.get(account.household_id) ?? null,
		ledgerBalanceLitres: 0
	}));
	if (accountIds.length === 0)
		return { accounts: enrichedAccounts, payments: [], ledger: [], loadError: null };

	const [
		{ data: payments, error: paymentsError },
		{ data: purchases, error: purchasesError },
		{ data: ledger, error: ledgerError }
	] = await Promise.all([
		locals.supabase
			.from('payments')
			.select(
				'id, prepaid_account_id, payer_profile_id, provider, provider_reference, amount, currency, status, failure_code, failure_message, requested_at, paid_at'
			)
			.in('prepaid_account_id', accountIds)
			.order('requested_at', { ascending: false })
			.limit(250),
		locals.supabase
			.from('water_credit_purchases')
			.select(
				'id, prepaid_account_id, payment_id, paid_amount, currency, purchased_litres, bonus_litres, purchased_at'
			)
			.in('prepaid_account_id', accountIds)
			.order('purchased_at', { ascending: false }),
		fetchLedger(locals, accountIds)
	]);
	const relatedError = paymentsError ?? purchasesError ?? ledgerError;
	if (relatedError)
		return {
			accounts: enrichedAccounts,
			payments: [],
			ledger: [],
			loadError: relatedError.message
		};

	const accountById = new Map(enrichedAccounts.map((account) => [account.id, account]));
	const purchaseByPayment = new Map(
		(purchases ?? []).map((purchase) => [purchase.payment_id, purchase])
	);
	const balanceByAccount = new Map();
	for (const entry of ledger ?? [])
		balanceByAccount.set(
			entry.prepaid_account_id,
			(balanceByAccount.get(entry.prepaid_account_id) ?? 0) + Number(entry.litres_delta)
		);

	return {
		accounts: enrichedAccounts.map((account) => ({
			...account,
			ledgerBalanceLitres: balanceByAccount.get(account.id) ?? 0
		})),
		payments: (payments ?? []).map((payment) => ({
			...payment,
			account: accountById.get(payment.prepaid_account_id) ?? null,
			purchase: purchaseByPayment.get(payment.id) ?? null
		})),
		ledger: (ledger ?? []).map((entry) => ({
			...entry,
			account: accountById.get(entry.prepaid_account_id) ?? null
		})),
		loadError: null
	};
}

export const actions = {
	initiate: async ({ request, locals }) => {
		const { user } = await requireActiveProfile(locals);
		const formData = await request.formData();
		const accountId = String(formData.get('prepaid_account_id') ?? '');
		const provider = String(formData.get('provider') ?? '').trim();
		const providerReference = String(formData.get('provider_reference') ?? '').trim();
		const amount = Number(formData.get('amount'));
		if (!uuidPattern.test(accountId) || !provider || !Number.isFinite(amount) || amount <= 0)
			return fail(400, { message: 'Choose an account, provider, and positive amount.' });
		const access = await assertPrepaidAccountAccess(locals, user.id, accountId);
		if (!access || access.account.status !== 'active')
			return fail(403, { message: 'This prepaid account is not available.' });

		const { error } = await locals.supabase.from('payments').insert({
			prepaid_account_id: accountId,
			payer_profile_id: user.id,
			provider,
			provider_reference: providerReference || null,
			idempotency_key: `owner:${user.id}:${crypto.randomUUID()}`,
			amount,
			currency: access.account.currency,
			status: 'pending',
			metadata: { source: 'owner-dashboard' }
		});
		if (error) return fail(500, { message: error.message });
		return { initiated: true };
	},
	cancel: async ({ request, locals }) => {
		const { user } = await requireActiveProfile(locals);
		const paymentId = String((await request.formData()).get('payment_id') ?? '');
		if (!uuidPattern.test(paymentId)) return fail(400, { message: 'Invalid payment.' });
		const { data: payment } = await locals.supabase
			.from('payments')
			.select('id, prepaid_account_id, payer_profile_id, status')
			.eq('id', paymentId)
			.maybeSingle();
		if (!payment || payment.payer_profile_id !== user.id || payment.status !== 'pending')
			return fail(403, { message: 'Only your pending payment requests can be cancelled.' });
		const access = await assertPrepaidAccountAccess(locals, user.id, payment.prepaid_account_id);
		if (!access) return fail(403, { message: 'Payment account access was not found.' });
		const { error } = await locals.supabase
			.from('payments')
			.update({ status: 'cancelled', updated_at: new Date().toISOString() })
			.eq('id', payment.id)
			.eq('status', 'pending');
		if (error) return fail(500, { message: error.message });
		return { cancelled: true };
	}
};
