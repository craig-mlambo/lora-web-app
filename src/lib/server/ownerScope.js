const householdFields =
	'id, owner_profile_id, account_number, name, address_line_1, address_line_2, suburb, city, province, postal_code, timezone, status, created_at, updated_at';

/**
 * Returns only households the profile owns or actively belongs to.
 *
 * @param {App.Locals} locals
 * @param {string} profileId
 */
export async function loadAccessibleHouseholds(locals, profileId) {
	const [{ data: owned, error: ownedError }, { data: memberships, error: membershipError }] =
		await Promise.all([
			locals.supabase
				.from('households')
				.select(householdFields)
				.eq('owner_profile_id', profileId)
				.neq('status', 'closed')
				.order('name'),
			locals.supabase
				.from('household_members')
				.select(
					`household_id, access_level, relationship, status, joined_at, household:households!household_members_household_id_fkey(${householdFields})`
				)
				.eq('profile_id', profileId)
				.eq('status', 'active')
		]);

	const loadError = ownedError ?? membershipError;
	if (loadError) return { households: [], loadError };

	/** @type {Map<string, any>} */
	const accessible = new Map();
	for (const household of owned ?? []) {
		accessible.set(household.id, {
			...household,
			access_level: 'owner',
			relationship: 'Primary account holder'
		});
	}
	for (const membership of memberships ?? []) {
		const household = Array.isArray(membership.household)
			? membership.household[0]
			: membership.household;
		if (!household || household.status === 'closed') continue;
		const existing = accessible.get(household.id);
		accessible.set(household.id, {
			...household,
			access_level: existing?.access_level === 'owner' ? 'owner' : membership.access_level,
			relationship: membership.relationship,
			joined_at: membership.joined_at
		});
	}

	return {
		households: [...accessible.values()].sort((a, b) => a.name.localeCompare(b.name)),
		loadError: null
	};
}

/**
 * Verifies that the profile may see a household. Set write=true to require
 * owner or manager access.
 *
 * @param {App.Locals} locals
 * @param {string} profileId
 * @param {string} householdId
 * @param {{write?: boolean}} [options]
 */
export async function assertHouseholdAccess(locals, profileId, householdId, options = {}) {
	const [{ data: household, error: householdError }, { data: membership, error: memberError }] =
		await Promise.all([
			locals.supabase
				.from('households')
				.select('id, owner_profile_id, status')
				.eq('id', householdId)
				.maybeSingle(),
			locals.supabase
				.from('household_members')
				.select('household_id, access_level, status')
				.eq('household_id', householdId)
				.eq('profile_id', profileId)
				.eq('status', 'active')
				.maybeSingle()
		]);

	if (householdError || memberError || !household || household.status === 'closed') return null;
	const accessLevel =
		household.owner_profile_id === profileId ? 'owner' : (membership?.access_level ?? null);
	if (!accessLevel) return null;
	if (options.write && !['owner', 'manager'].includes(accessLevel)) return null;

	return { household, accessLevel };
}

/**
 * @param {App.Locals} locals
 * @param {string} profileId
 * @param {string} accountId
 */
export async function assertPrepaidAccountAccess(locals, profileId, accountId) {
	const { data: account, error } = await locals.supabase
		.from('prepaid_accounts')
		.select('id, household_id, currency, status, low_balance_threshold_litres')
		.eq('id', accountId)
		.maybeSingle();
	if (error || !account) return null;

	const access = await assertHouseholdAccess(locals, profileId, account.household_id);
	return access ? { account, accessLevel: access.accessLevel } : null;
}
