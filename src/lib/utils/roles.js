export const ADMIN_ROLE_ID = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b';

/**
 * Normalizes Supabase nested-relation results. Depending on generated relation
 * metadata, a joined role can be represented as an object or a one-item array.
 *
 * @param {Array<{role_id?: unknown, user_roles?: {id?: unknown, code?: unknown, name?: unknown} | Array<{id?: unknown, code?: unknown, name?: unknown}> | null}> | null | undefined} rows
 */
export function rolesFromRows(rows) {
	return (rows ?? []).flatMap((row) => {
		const relatedRole = Array.isArray(row.user_roles) ? row.user_roles[0] : row.user_roles;
		const id =
			typeof relatedRole?.id === 'string'
				? relatedRole.id
				: typeof row.role_id === 'string'
					? row.role_id
					: null;
		const code = typeof relatedRole?.code === 'string' ? relatedRole.code : null;
		const name = typeof relatedRole?.name === 'string' ? relatedRole.name : null;

		return id || code ? [{ id, code, ...(name ? { name } : {}) }] : [];
	});
}

/** @param {Parameters<typeof rolesFromRows>[0]} rows */
export function roleCodesFromRows(rows) {
	return rolesFromRows(rows).flatMap((role) => (role.code ? [role.code] : []));
}

/** @param {Parameters<typeof rolesFromRows>[0]} rows */
export function isAdminRoleRows(rows) {
	return rolesFromRows(rows).some(
		(role) => role.id === ADMIN_ROLE_ID || role.code?.toLowerCase() === 'admin'
	);
}

/**
 * @param {{account_status?: string, isAdmin?: boolean, roles?: string[], roleIds?: string[]} | null | undefined} profile
 */
export function isAdminProfile(profile) {
	return Boolean(
		profile?.isAdmin ||
		profile?.roleIds?.includes(ADMIN_ROLE_ID) ||
		profile?.roles?.some((role) => role.toLowerCase() === 'admin')
	);
}

/** @param {Parameters<typeof isAdminProfile>[0]} profile */
export function dashboardPathForProfile(profile) {
	if (profile?.account_status && profile.account_status !== 'active') {
		return '/pending-approval';
	}
	return isAdminProfile(profile) ? '/admin' : '/dashboard';
}
