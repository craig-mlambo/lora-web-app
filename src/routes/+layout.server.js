import { isAdminRoleRows, rolesFromRows } from '$lib/utils/roles.js';

const profileFields =
	'id, full_name, phone, account_status, avatar_url, preferred_language, created_at, updated_at';
const profileWithRoles = `${profileFields}, profile_roles:profile_roles!profile_roles_profile_id_fkey(role_id, user_roles(id, code))`;

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
	const { session, user } = await locals.safeGetSession();

	if (!user) {
		return { session: null, user: null, profile: null };
	}

	const profileResult = await locals.supabase
		.from('profiles')
		.select(profileWithRoles)
		.eq('id', user.id)
		.maybeSingle();
	/** @type {any} */
	let profile = profileResult.data;
	let roleRows = profile?.profile_roles ?? null;

	if (!profile) {
		const metadataName =
			typeof user.user_metadata?.full_name === 'string'
				? user.user_metadata.full_name
				: typeof user.user_metadata?.name === 'string'
					? user.user_metadata.name
					: '';
		const fullName = metadataName.trim() || user.email?.split('@')[0] || 'Account';
		const phone =
			typeof user.user_metadata?.phone === 'string'
				? user.user_metadata.phone.trim() || null
				: null;
		const preferredLanguage =
			typeof user.user_metadata?.preferred_language === 'string'
				? user.user_metadata.preferred_language
				: 'en';

		const { data: createdProfile } = await locals.supabase
			.from('profiles')
			.insert({
				id: user.id,
				full_name: fullName,
				phone,
				preferred_language: preferredLanguage,
				account_status: 'invited'
			})
			.select(profileFields)
			.single();

		profile = createdProfile;

		// A second request may have created the same profile concurrently.
		if (!profile) {
			const { data: existingProfile } = await locals.supabase
				.from('profiles')
				.select(profileWithRoles)
				.eq('id', user.id)
				.maybeSingle();
			profile = existingProfile;
			roleRows = existingProfile?.profile_roles ?? null;
		}
	}

	/** @type {ReturnType<typeof rolesFromRows>} */
	let roles = [];
	if (profile) {
		let roleError = null;
		if (roleRows === null) {
			const roleResult = await locals.supabase
				.from('profile_roles')
				.select('role_id, user_roles(id, code)')
				.eq('profile_id', user.id);
			roleRows = roleResult.data;
			roleError = roleResult.error;
		}

		if (!roleError) {
			roles = rolesFromRows(roleRows);

			if (roles.length === 0) {
				const { data: defaultRole } = await locals.supabase
					.from('user_roles')
					.select('id, code')
					.eq('code', 'house-owner')
					.single();

				if (defaultRole) {
					const { error: assignmentError } = await locals.supabase
						.from('profile_roles')
						.insert({ profile_id: user.id, role_id: defaultRole.id });
					if (!assignmentError) roles = [{ id: defaultRole.id, code: defaultRole.code }];
				}
			}
		}
	}

	const roleCodes = roles.flatMap((role) => (role.code ? [role.code] : []));
	const roleIds = roles.flatMap((role) => (role.id ? [role.id] : []));
	const isAdmin = isAdminRoleRows(roles.map((role) => ({ role_id: role.id, user_roles: role })));
	if (profile && 'profile_roles' in profile) delete profile.profile_roles;

	return {
		session,
		user,
		profile: profile
			? {
					...profile,
					roles: roleCodes,
					roleIds,
					isAdmin
				}
			: {
					id: user.id,
					full_name: null,
					phone: null,
					roles: [],
					roleIds: [],
					isAdmin: false,
					account_status: 'invited',
					avatar_url: null,
					preferred_language: null,
					created_at: user.created_at,
					updated_at: user.updated_at ?? user.created_at
				}
	};
}
