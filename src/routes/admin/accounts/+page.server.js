import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/authorization.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [, { data: accounts, error: accountsError }, { data: households, error: householdsError }] =
		await Promise.all([
			parent(),
			locals.supabase
				.from('prepaid_accounts')
				.select(
					'id, household_id, currency, low_balance_threshold_litres, status, opened_at, created_at'
				)
				.order('created_at', { ascending: false })
				.limit(500),
			locals.supabase
				.from('households')
				.select('id, name, account_number, owner_profile_id, status')
				.order('name')
				.limit(500)
		]);

	const loadError = accountsError ?? householdsError;
	if (loadError) {
		return { accounts: [], households: [], loadError: loadError.message };
	}

	const householdById = new Map((households ?? []).map((household) => [household.id, household]));
	const usedHouseholds = new Set((accounts ?? []).map((account) => account.household_id));

	return {
		accounts: (accounts ?? []).map((account) => ({
			...account,
			household: householdById.get(account.household_id) ?? null
		})),
		households: (households ?? []).filter(
			(household) => !usedHouseholds.has(household.id) && household.status !== 'closed'
		),
		loadError: null
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const currency = String(formData.get('currency') ?? '')
			.trim()
			.toUpperCase();
		const threshold = Number(formData.get('low_balance_threshold_litres'));

		if (!uuidPattern.test(householdId) || !/^[A-Z]{3}$/.test(currency)) {
			return fail(400, { message: 'Household and three-letter currency are required.' });
		}
		if (!Number.isFinite(threshold) || threshold < 0) {
			return fail(400, { message: 'Low-balance threshold must be zero or greater.' });
		}

		const { data: account, error } = await locals.supabase
			.from('prepaid_accounts')
			.insert({
				household_id: householdId,
				currency,
				low_balance_threshold_litres: threshold,
				status: 'active'
			})
			.select('id')
			.single();
		if (error || !account) {
			return fail(500, { message: error?.message ?? 'Prepaid account creation failed.' });
		}

		return { created: true, accountId: account.id };
	},

	update: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const accountId = String(formData.get('account_id') ?? '');
		const currency = String(formData.get('currency') ?? '')
			.trim()
			.toUpperCase();
		const threshold = Number(formData.get('low_balance_threshold_litres'));
		const status = String(formData.get('status') ?? '');

		if (!uuidPattern.test(accountId) || !/^[A-Z]{3}$/.test(currency)) {
			return fail(400, { message: 'Account and currency are required.' });
		}
		if (!Number.isFinite(threshold) || threshold < 0) {
			return fail(400, { message: 'Low-balance threshold must be zero or greater.' });
		}
		if (!['pending', 'active', 'suspended', 'closed'].includes(status)) {
			return fail(400, { message: 'Select a valid account status.' });
		}

		const now = new Date().toISOString();
		const { error } = await locals.supabase
			.from('prepaid_accounts')
			.update({
				currency,
				low_balance_threshold_litres: threshold,
				status,
				closed_at: status === 'closed' ? now : null,
				updated_at: now
			})
			.eq('id', accountId);
		if (error) return fail(500, { message: error.message });

		return { updated: true, accountId };
	},

	delete: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const accountId = String(formData.get('account_id') ?? '');
		if (!uuidPattern.test(accountId)) {
			return fail(400, { message: 'A valid account id is required.' });
		}

		const [{ count: paymentCount }, { count: ledgerCount }] = await Promise.all([
			locals.supabase
				.from('payments')
				.select('*', { count: 'exact', head: true })
				.eq('prepaid_account_id', accountId),
			locals.supabase
				.from('water_ledger_entries')
				.select('*', { count: 'exact', head: true })
				.eq('prepaid_account_id', accountId)
		]);
		if ((paymentCount ?? 0) > 0 || (ledgerCount ?? 0) > 0) {
			return fail(409, { message: 'Close this account; it already has financial history.' });
		}

		const { error } = await locals.supabase.from('prepaid_accounts').delete().eq('id', accountId);
		if (error) return fail(500, { message: error.message });

		return { deleted: true, accountId };
	}
};
