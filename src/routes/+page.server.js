import { redirect } from '@sveltejs/kit';
import { dashboardPathForProfile } from '$lib/utils/roles.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ parent }) {
	const { user, profile } = await parent();

	if (!user) redirect(303, '/login');
	redirect(303, dashboardPathForProfile(profile));
}
