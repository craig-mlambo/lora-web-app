import { redirect } from '@sveltejs/kit';
import { loadAccessibleHouseholds } from '$lib/server/ownerScope.js';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ parent, locals }) {
	const { user, profile } = await parent();
	if (!user) redirect(303, '/login');
	if (profile?.account_status !== 'active') redirect(303, '/pending-approval');

	const { households, loadError } = await loadAccessibleHouseholds(locals, user.id);
	return {
		user,
		profile,
		households,
		householdLoadError: loadError?.message ?? null
	};
}
