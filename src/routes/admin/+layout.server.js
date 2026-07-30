import { redirect } from '@sveltejs/kit';
import { isAdminProfile } from '$lib/utils/roles.js';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ parent }) {
	const { user, profile } = await parent();

	if (!user) redirect(303, '/login');
	if (profile?.account_status !== 'active') redirect(303, '/pending-approval');
	if (!isAdminProfile(profile)) redirect(303, '/dashboard');
}
