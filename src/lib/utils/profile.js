/**
 * Turn the authenticated Supabase user and their public profile into the
 * compact identity shape used throughout the dashboard shell.
 *
 * @param {{full_name?: string | null} | null | undefined} profile
 * @param {{email?: string, user_metadata?: Record<string, unknown>} | null | undefined} authUser
 */
export function toDashboardUser(profile, authUser) {
	const email = authUser?.email ?? '';
	const metadataName =
		typeof authUser?.user_metadata?.full_name === 'string'
			? authUser.user_metadata.full_name
			: typeof authUser?.user_metadata?.name === 'string'
				? authUser.user_metadata.name
				: '';
	const name =
		profile?.full_name?.trim() || metadataName.trim() || email.split('@')[0] || 'Account';
	const initials =
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join('') || 'U';

	return { name, email, initials };
}
