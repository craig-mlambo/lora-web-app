import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/authorization.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [
		,
		{ data: payments, error: paymentsError },
		{ data: accounts, error: accountsError },
		{ data: households, error: householdsError },
		{ data: profiles, error: profilesError },
		{ data: refunds, error: refundsError },
		{ data: purchases, error: purchasesError }
	] = await Promise.all([
		parent(),
		locals.supabase
			.from('payments')
			.select(
				'id, prepaid_account_id, payer_profile_id, amount, currency, provider, provider_reference, status, failure_code, failure_message, requested_at'
			)
			.order('requested_at', { ascending: false })
			.limit(250),
		locals.supabase
			.from('prepaid_accounts')
			.select('id, household_id, currency, status')
			.limit(500),
		locals.supabase.from('households').select('id, name, account_number').limit(500),
		locals.supabase.from('profiles').select('id, full_name, phone').limit(1000),
		locals.supabase
			.from('payment_refunds')
			.select('id, payment_id, amount, status, reason, requested_at')
			.limit(500),
		locals.supabase
			.from('water_credit_purchases')
			.select('id, payment_id, purchased_litres, bonus_litres')
			.limit(500)
	]);

	const loadError =
		paymentsError ??
		accountsError ??
		householdsError ??
		profilesError ??
		refundsError ??
		purchasesError;
	if (loadError) {
		return { payments: [], accounts: [], profiles: [], loadError: loadError.message };
	}

	const householdById = new Map((households ?? []).map((household) => [household.id, household]));
	const accountById = new Map(
		(accounts ?? []).map((account) => [
			account.id,
			{ ...account, household: householdById.get(account.household_id) ?? null }
		])
	);
	const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
	const refundsByPayment = new Map();
	for (const refund of refunds ?? []) {
		const current = refundsByPayment.get(refund.payment_id) ?? [];
		current.push(refund);
		refundsByPayment.set(refund.payment_id, current);
	}
	const purchaseByPayment = new Map(
		(purchases ?? []).map((purchase) => [purchase.payment_id, purchase])
	);

	return {
		payments: (payments ?? []).map((payment) => ({
			...payment,
			account: accountById.get(payment.prepaid_account_id) ?? null,
			payer: payment.payer_profile_id ? (profileById.get(payment.payer_profile_id) ?? null) : null,
			refunds: refundsByPayment.get(payment.id) ?? [],
			purchase: purchaseByPayment.get(payment.id) ?? null
		})),
		accounts: [...accountById.values()].filter((account) => account.status === 'active'),
		profiles: profiles ?? [],
		loadError: null
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const accountId = String(formData.get('prepaid_account_id') ?? '');
		const payerProfileId = String(formData.get('payer_profile_id') ?? '');
		const provider = String(formData.get('provider') ?? '').trim();
		const providerReference = String(formData.get('provider_reference') ?? '').trim();
		const amount = Number(formData.get('amount'));
		const currency = String(formData.get('currency') ?? '')
			.trim()
			.toUpperCase();

		if (!uuidPattern.test(accountId) || !provider || !/^[A-Z]{3}$/.test(currency)) {
			return fail(400, { message: 'Account, provider, and currency are required.' });
		}
		if (payerProfileId && !uuidPattern.test(payerProfileId)) {
			return fail(400, { message: 'Select a valid payer profile.' });
		}
		if (!Number.isFinite(amount) || amount <= 0) {
			return fail(400, { message: 'Payment amount must be greater than zero.' });
		}

		const { data: payment, error } = await locals.supabase
			.from('payments')
			.insert({
				prepaid_account_id: accountId,
				payer_profile_id: payerProfileId || administrator.id,
				provider,
				provider_reference: providerReference || null,
				idempotency_key: `admin-${crypto.randomUUID()}`,
				amount,
				currency,
				status: 'pending',
				metadata: { source: 'admin-console' }
			})
			.select('id')
			.single();
		if (error || !payment) {
			return fail(500, { message: error?.message ?? 'Payment creation failed.' });
		}

		return { created: true, paymentId: payment.id };
	},

	update: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const paymentId = String(formData.get('payment_id') ?? '');
		const status = String(formData.get('status') ?? '');
		const providerReference = String(formData.get('provider_reference') ?? '').trim();
		const failureCode = String(formData.get('failure_code') ?? '').trim();
		const failureMessage = String(formData.get('failure_message') ?? '').trim();

		if (!uuidPattern.test(paymentId)) {
			return fail(400, { message: 'A valid payment id is required.' });
		}
		if (
			![
				'pending',
				'processing',
				'succeeded',
				'failed',
				'cancelled',
				'partially_refunded',
				'refunded'
			].includes(status)
		) {
			return fail(400, { message: 'Select a valid payment status.' });
		}

		const { error } = await locals.supabase
			.from('payments')
			.update({
				status,
				provider_reference: providerReference || null,
				failure_code: failureCode || null,
				failure_message: failureMessage || null,
				paid_at: status === 'succeeded' ? new Date().toISOString() : null,
				updated_at: new Date().toISOString()
			})
			.eq('id', paymentId);
		if (error) return fail(500, { message: error.message });

		return { updated: true, paymentId };
	},

	refund: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const paymentId = String(formData.get('payment_id') ?? '');
		const amount = Number(formData.get('amount'));
		const reason = String(formData.get('reason') ?? '').trim();

		if (!uuidPattern.test(paymentId) || !Number.isFinite(amount) || amount <= 0) {
			return fail(400, { message: 'Payment and positive refund amount are required.' });
		}

		const { error } = await locals.supabase.from('payment_refunds').insert({
			payment_id: paymentId,
			amount,
			reason: reason || null,
			status: 'pending',
			requested_by_profile_id: administrator.id,
			metadata: { source: 'admin-console' }
		});
		if (error) return fail(500, { message: error.message });

		return { refundCreated: true, paymentId };
	},

	delete: async ({ request, locals }) => {
		await requireAdmin(locals);
		const paymentId = String((await request.formData()).get('payment_id') ?? '');
		if (!uuidPattern.test(paymentId)) {
			return fail(400, { message: 'A valid payment id is required.' });
		}

		const { data: payment } = await locals.supabase
			.from('payments')
			.select('status')
			.eq('id', paymentId)
			.maybeSingle();
		if (!payment || !['pending', 'failed', 'cancelled'].includes(payment.status)) {
			return fail(409, { message: 'Only pending, failed, or cancelled payments can be deleted.' });
		}

		const [{ count: eventCount }, { count: refundCount }, { count: purchaseCount }] =
			await Promise.all([
				locals.supabase
					.from('payment_events')
					.select('*', { count: 'exact', head: true })
					.eq('payment_id', paymentId),
				locals.supabase
					.from('payment_refunds')
					.select('*', { count: 'exact', head: true })
					.eq('payment_id', paymentId),
				locals.supabase
					.from('water_credit_purchases')
					.select('*', { count: 'exact', head: true })
					.eq('payment_id', paymentId)
			]);
		if ((eventCount ?? 0) + (refundCount ?? 0) + (purchaseCount ?? 0) > 0) {
			return fail(409, { message: 'This payment has related financial history.' });
		}

		const { error } = await locals.supabase.from('payments').delete().eq('id', paymentId);
		if (error) return fail(500, { message: error.message });
		return { deleted: true, paymentId };
	}
};
