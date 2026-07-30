import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/authorization.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [
		,
		{ data: households, error: householdsError },
		{ data: profiles, error: profilesError },
		{ data: devices, error: devicesError },
		{ data: accounts, error: accountsError },
		{ data: memberships, error: membershipsError }
	] = await Promise.all([
		parent(),
		locals.supabase
			.from('households')
			.select(
				'id, owner_profile_id, account_number, name, address_line_1, city, province, status, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(250),
		locals.supabase
			.from('profiles')
			.select('id, full_name, phone, account_status')
			.eq('account_status', 'active')
			.order('full_name')
			.limit(500),
		locals.supabase
			.from('devices')
			.select('id, household_id, serial_number, status')
			.order('created_at')
			.limit(1000),
		locals.supabase
			.from('prepaid_accounts')
			.select('id, household_id, currency, status, low_balance_threshold_litres')
			.limit(500),
		locals.supabase
			.from('household_members')
			.select('household_id, profile_id, access_level, relationship, status, joined_at')
			.limit(2000)
	]);

	const loadError =
		householdsError ?? profilesError ?? devicesError ?? accountsError ?? membershipsError;
	if (loadError) {
		console.error('Unable to load household administration data.', loadError);
		return { households: [], owners: [], loadError: loadError.message };
	}

	const ownerById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
	const devicesByHousehold = new Map();
	for (const device of devices ?? []) {
		const current = devicesByHousehold.get(device.household_id) ?? [];
		current.push(device);
		devicesByHousehold.set(device.household_id, current);
	}
	const accountByHousehold = new Map(
		(accounts ?? []).map((account) => [account.household_id, account])
	);
	const membersByHousehold = new Map();
	for (const membership of memberships ?? []) {
		const current = membersByHousehold.get(membership.household_id) ?? [];
		current.push({
			...membership,
			profile: ownerById.get(membership.profile_id) ?? null
		});
		membersByHousehold.set(membership.household_id, current);
	}

	return {
		households: (households ?? []).map((household) => ({
			...household,
			owner: ownerById.get(household.owner_profile_id) ?? null,
			devices: devicesByHousehold.get(household.id) ?? [],
			prepaidAccount: accountByHousehold.get(household.id) ?? null,
			members: membersByHousehold.get(household.id) ?? []
		})),
		owners: profiles ?? [],
		loadError: null
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const ownerProfileId = String(formData.get('owner_profile_id') ?? '');
		const accountNumber = String(formData.get('account_number') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		const addressLine1 = String(formData.get('address_line_1') ?? '').trim();
		const city = String(formData.get('city') ?? '').trim();
		const province = String(formData.get('province') ?? '').trim();
		const currency = String(formData.get('currency') ?? 'USD')
			.trim()
			.toUpperCase();

		if (!uuidPattern.test(ownerProfileId) || !accountNumber || !name || !addressLine1) {
			return fail(400, { message: 'Owner, account number, name, and address are required.' });
		}
		if (!/^[A-Z]{3}$/.test(currency)) {
			return fail(400, { message: 'Currency must be a three-letter ISO code.' });
		}

		const { data: household, error: householdError } = await locals.supabase
			.from('households')
			.insert({
				owner_profile_id: ownerProfileId,
				account_number: accountNumber,
				name,
				address_line_1: addressLine1,
				city: city || null,
				province: province || null,
				status: 'active'
			})
			.select('id')
			.single();

		if (householdError || !household) {
			return fail(500, { message: householdError?.message ?? 'Household creation failed.' });
		}

		const { error: membershipError } = await locals.supabase.from('household_members').upsert(
			{
				household_id: household.id,
				profile_id: ownerProfileId,
				access_level: 'owner',
				relationship: 'Primary account holder',
				status: 'active'
			},
			{ onConflict: 'household_id,profile_id' }
		);

		const { error: accountError } = membershipError
			? { error: null }
			: await locals.supabase.from('prepaid_accounts').insert({
					household_id: household.id,
					currency,
					status: 'active'
				});

		if (membershipError || accountError) {
			await locals.supabase.from('prepaid_accounts').delete().eq('household_id', household.id);
			await locals.supabase.from('household_members').delete().eq('household_id', household.id);
			await locals.supabase.from('households').delete().eq('id', household.id);
			return fail(500, {
				message: membershipError?.message ?? accountError?.message ?? 'Household setup failed.'
			});
		}

		return { created: true, householdId: household.id };
	},

	update: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const ownerProfileId = String(formData.get('owner_profile_id') ?? '');
		const accountNumber = String(formData.get('account_number') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		const addressLine1 = String(formData.get('address_line_1') ?? '').trim();
		const city = String(formData.get('city') ?? '').trim();
		const province = String(formData.get('province') ?? '').trim();

		if (
			!uuidPattern.test(householdId) ||
			!uuidPattern.test(ownerProfileId) ||
			!accountNumber ||
			!name ||
			!addressLine1
		) {
			return fail(400, { message: 'Complete all required household fields.' });
		}

		const { error: membershipError } = await locals.supabase.from('household_members').upsert(
			{
				household_id: householdId,
				profile_id: ownerProfileId,
				access_level: 'owner',
				relationship: 'Primary account holder',
				status: 'active'
			},
			{ onConflict: 'household_id,profile_id' }
		);
		if (membershipError) return fail(500, { message: membershipError.message });

		const { error } = await locals.supabase
			.from('households')
			.update({
				owner_profile_id: ownerProfileId,
				account_number: accountNumber,
				name,
				address_line_1: addressLine1,
				city: city || null,
				province: province || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', householdId);

		if (error) return fail(500, { message: error.message });
		return { updated: true, householdId };
	},

	setStatus: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const status = String(formData.get('status') ?? '');

		if (
			!uuidPattern.test(householdId) ||
			!['pending', 'active', 'suspended', 'closed'].includes(status)
		) {
			return fail(400, { message: 'Select a valid household and status.' });
		}

		const { error } = await locals.supabase
			.from('households')
			.update({ status, updated_at: new Date().toISOString() })
			.eq('id', householdId);
		if (error) return fail(500, { message: error.message });

		return { statusUpdated: true, householdId };
	},

	addMember: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const profileId = String(formData.get('profile_id') ?? '');
		const accessLevel = String(formData.get('access_level') ?? '');
		const relationship = String(formData.get('relationship') ?? '').trim();

		if (!uuidPattern.test(householdId) || !uuidPattern.test(profileId)) {
			return fail(400, { message: 'Select a valid household and profile.' });
		}
		if (!['owner', 'manager', 'viewer'].includes(accessLevel)) {
			return fail(400, { message: 'Select a valid member access level.' });
		}

		const { error } = await locals.supabase.from('household_members').upsert(
			{
				household_id: householdId,
				profile_id: profileId,
				access_level: accessLevel,
				relationship: relationship || null,
				status: 'active'
			},
			{ onConflict: 'household_id,profile_id' }
		);
		if (error) return fail(500, { message: error.message });

		return { memberSaved: true, householdId };
	},

	updateMember: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const profileId = String(formData.get('profile_id') ?? '');
		const accessLevel = String(formData.get('access_level') ?? '');
		const relationship = String(formData.get('relationship') ?? '').trim();
		const status = String(formData.get('member_status') ?? '');

		if (!uuidPattern.test(householdId) || !uuidPattern.test(profileId)) {
			return fail(400, { message: 'Select a valid household member.' });
		}
		if (
			!['owner', 'manager', 'viewer'].includes(accessLevel) ||
			!['invited', 'active', 'revoked'].includes(status)
		) {
			return fail(400, { message: 'Select valid membership settings.' });
		}

		const { data: household } = await locals.supabase
			.from('households')
			.select('owner_profile_id')
			.eq('id', householdId)
			.maybeSingle();
		if (
			household?.owner_profile_id === profileId &&
			(accessLevel !== 'owner' || status !== 'active')
		) {
			return fail(409, { message: 'Change the household owner before changing this membership.' });
		}

		const { error } = await locals.supabase
			.from('household_members')
			.update({
				access_level: accessLevel,
				relationship: relationship || null,
				status
			})
			.eq('household_id', householdId)
			.eq('profile_id', profileId);
		if (error) return fail(500, { message: error.message });

		return { memberSaved: true, householdId };
	},

	removeMember: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const profileId = String(formData.get('profile_id') ?? '');
		if (!uuidPattern.test(householdId) || !uuidPattern.test(profileId)) {
			return fail(400, { message: 'Select a valid household member.' });
		}

		const { data: household } = await locals.supabase
			.from('households')
			.select('owner_profile_id')
			.eq('id', householdId)
			.maybeSingle();
		if (household?.owner_profile_id === profileId) {
			return fail(409, { message: 'Change the household owner before removing this member.' });
		}

		const { error } = await locals.supabase
			.from('household_members')
			.delete()
			.eq('household_id', householdId)
			.eq('profile_id', profileId);
		if (error) {
			return fail(409, {
				message: 'This member cannot be removed while a device is assigned to them.'
			});
		}

		return { memberRemoved: true, householdId };
	},

	delete: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		if (!uuidPattern.test(householdId)) {
			return fail(400, { message: 'A valid household id is required.' });
		}

		const [{ count: deviceCount }, { count: accountCount }] = await Promise.all([
			locals.supabase
				.from('devices')
				.select('*', { count: 'exact', head: true })
				.eq('household_id', householdId),
			locals.supabase
				.from('prepaid_accounts')
				.select('*', { count: 'exact', head: true })
				.eq('household_id', householdId)
		]);
		if ((deviceCount ?? 0) > 0 || (accountCount ?? 0) > 0) {
			return fail(409, {
				message: 'Close this household instead; it still has a meter or prepaid account.'
			});
		}

		await locals.supabase.from('household_members').delete().eq('household_id', householdId);
		const { error } = await locals.supabase.from('households').delete().eq('id', householdId);
		if (error) return fail(500, { message: error.message });

		return { deleted: true, householdId };
	}
};
