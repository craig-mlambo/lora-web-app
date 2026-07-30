import { error } from '@sveltejs/kit';

/**
 * @param {import('@supabase/supabase-js').PostgrestResponse<unknown>[]} results
 */
function assertQueries(results) {
	const failed = results.find((result) => result.error);

	if (failed?.error) {
		console.error('Unable to load admin dashboard data.', failed.error);
		error(500, 'Unable to load the admin dashboard.');
	}
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [, ...results] = await Promise.all([
		// Read-only dashboard queries can run while the layout verifies access.
		parent(),
		locals.supabase.from('households').select('*', { count: 'exact', head: true }),
		locals.supabase.from('devices').select('*', { count: 'exact', head: true }),
		locals.supabase
			.from('devices')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'active'),
		locals.supabase
			.from('profiles')
			.select('*', { count: 'exact', head: true })
			.eq('account_status', 'active'),
		locals.supabase
			.from('profiles')
			.select('*', { count: 'exact', head: true })
			.eq('approval_status', 'pending'),
		locals.supabase.from('prepaid_accounts').select('*', { count: 'exact', head: true }),
		locals.supabase.from('payments').select('*', { count: 'exact', head: true }),
		locals.supabase
			.from('profiles')
			.select('id, full_name, account_status, approval_status, created_at')
			.order('created_at', { ascending: false })
			.limit(5),
		locals.supabase
			.from('payments')
			.select('id, amount, currency, status, provider, created_at')
			.order('created_at', { ascending: false })
			.limit(5)
	]);

	assertQueries(results);

	const [
		households,
		devices,
		activeDevices,
		activeProfiles,
		pendingProfiles,
		accounts,
		payments,
		recentProfiles,
		recentPayments
	] = results;

	return {
		summary: {
			households: households.count ?? 0,
			devices: devices.count ?? 0,
			activeDevices: activeDevices.count ?? 0,
			activeProfiles: activeProfiles.count ?? 0,
			pendingProfiles: pendingProfiles.count ?? 0,
			accounts: accounts.count ?? 0,
			payments: payments.count ?? 0
		},
		recentProfiles: recentProfiles.data ?? [],
		recentPayments: recentPayments.data ?? []
	};
}
