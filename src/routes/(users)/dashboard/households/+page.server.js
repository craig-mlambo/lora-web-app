import { fail } from '@sveltejs/kit';
import { requireActiveProfile } from '$lib/server/authorization.js';
import { assertHouseholdAccess } from '$lib/server/ownerScope.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const { households, householdLoadError } = await parent();
	if (householdLoadError || households.length === 0) {
		return { households, loadError: householdLoadError };
	}

	const householdIds = households.map((household) => household.id);
	const [
		{ data: devices, error: devicesError },
		{ data: accounts, error: accountsError },
		{ data: memberships, error: membersError }
	] = await Promise.all([
		locals.supabase
			.from('devices')
			.select('id, household_id, serial_number, status, valve_state, last_seen_at')
			.in('household_id', householdIds)
			.neq('status', 'retired'),
		locals.supabase
			.from('prepaid_accounts')
			.select('id, household_id, currency, status, low_balance_threshold_litres, opened_at')
			.in('household_id', householdIds),
		locals.supabase
			.from('household_members')
			.select('household_id, profile_id, access_level, relationship, status, joined_at')
			.in('household_id', householdIds)
			.eq('status', 'active')
	]);

	const relatedError = devicesError ?? accountsError ?? membersError;
	if (relatedError) return { households: [], loadError: relatedError.message };

	const profileIds = [...new Set((memberships ?? []).map((membership) => membership.profile_id))];
	const { data: profiles, error: profilesError } = profileIds.length
		? await locals.supabase
				.from('profiles')
				.select('id, full_name, phone, avatar_url')
				.in('id', profileIds)
		: { data: [], error: null };
	if (profilesError) return { households: [], loadError: profilesError.message };

	const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
	const accountByHousehold = new Map(
		(accounts ?? []).map((account) => [account.household_id, account])
	);
	/** @type {Map<string, any[]>} */
	const devicesByHousehold = new Map();
	for (const device of devices ?? []) {
		const current = devicesByHousehold.get(device.household_id) ?? [];
		current.push(device);
		devicesByHousehold.set(device.household_id, current);
	}
	/** @type {Map<string, any[]>} */
	const membersByHousehold = new Map();
	for (const membership of memberships ?? []) {
		const current = membersByHousehold.get(membership.household_id) ?? [];
		current.push({ ...membership, profile: profileById.get(membership.profile_id) ?? null });
		membersByHousehold.set(membership.household_id, current);
	}

	return {
		households: households.map((household) => ({
			...household,
			devices: devicesByHousehold.get(household.id) ?? [],
			members: membersByHousehold.get(household.id) ?? [],
			prepaidAccount: accountByHousehold.get(household.id) ?? null
		})),
		loadError: null
	};
}

export const actions = {
	update: async ({ request, locals }) => {
		const { user } = await requireActiveProfile(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const name = String(formData.get('name') ?? '').trim();
		const addressLine1 = String(formData.get('address_line_1') ?? '').trim();
		const addressLine2 = String(formData.get('address_line_2') ?? '').trim();
		const suburb = String(formData.get('suburb') ?? '').trim();
		const city = String(formData.get('city') ?? '').trim();
		const province = String(formData.get('province') ?? '').trim();
		const postalCode = String(formData.get('postal_code') ?? '').trim();

		if (!uuidPattern.test(householdId) || !name || !addressLine1) {
			return fail(400, { message: 'Household name and primary address are required.' });
		}
		const access = await assertHouseholdAccess(locals, user.id, householdId, { write: true });
		if (!access) return fail(403, { message: 'Owner or manager access is required.' });

		const { error } = await locals.supabase
			.from('households')
			.update({
				name,
				address_line_1: addressLine1,
				address_line_2: addressLine2 || null,
				suburb: suburb || null,
				city: city || null,
				province: province || null,
				postal_code: postalCode || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', householdId);
		if (error) return fail(500, { message: error.message });
		return { updated: true };
	}
};
