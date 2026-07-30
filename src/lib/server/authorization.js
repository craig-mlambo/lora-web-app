import { error, redirect } from '@sveltejs/kit';
import { isAdminRoleRows, roleCodesFromRows, rolesFromRows } from '$lib/utils/roles.js';

/**
 * @param {App.Locals} locals
 */
export async function requireActiveProfile(locals) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('id, full_name, phone, account_status, avatar_url, preferred_language')
		.eq('id', user.id)
		.maybeSingle();

	if (profileError || !profile) {
		error(403, 'Your application profile is not available.');
	}

	if (profile.account_status !== 'active') {
		error(403, 'Your account is not active.');
	}

	const { data: roleRows, error: rolesError } = await locals.supabase
		.from('profile_roles')
		.select('role_id, user_roles(id, code)')
		.eq('profile_id', user.id);
	if (rolesError) error(403, 'Your application roles are not available.');

	const roles = roleCodesFromRows(roleRows);
	const roleIds = rolesFromRows(roleRows).flatMap((role) => (role.id ? [role.id] : []));

	return { user, profile: { ...profile, roles, roleIds, isAdmin: isAdminRoleRows(roleRows) } };
}

/**
 * @param {App.Locals} locals
 */
export async function requireAdmin(locals) {
	const identity = await requireActiveProfile(locals);
	if (!identity.profile.isAdmin) {
		error(403, 'Administrator access is required.');
	}

	return identity;
}
