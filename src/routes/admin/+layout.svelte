<script>
	import AppShell from '$lib/components/AppShell.svelte';
	import { adminNav } from '$lib/data/nav.js';
	import { toDashboardUser } from '$lib/utils/profile.js';

	let { data, children } = $props();
	const dashboardUser = $derived(toDashboardUser(data.profile, data.user));
</script>

<AppShell user={dashboardUser} nav={adminNav} roleLabel="Admin" canViewAdmin={true}>
	{@render children()}
</AppShell>
