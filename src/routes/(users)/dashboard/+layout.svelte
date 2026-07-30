<script>
	import AppShell from '$lib/components/AppShell.svelte';
	import { ownerNav } from '$lib/data/nav.js';
	import { toDashboardUser } from '$lib/utils/profile.js';
	import { isAdminProfile } from '$lib/utils/roles.js';

	let { data, children } = $props();
	const dashboardUser = $derived(toDashboardUser(data.profile, data.user));
	const canViewAdmin = $derived(isAdminProfile(data.profile));
</script>

<AppShell user={dashboardUser} nav={ownerNav} {canViewAdmin}>
	{@render children()}
</AppShell>
