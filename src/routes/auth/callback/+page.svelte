<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSupabaseBrowserClient } from '$lib/supabaseClient.js';
	import { dashboardPathForProfile, rolesFromRows } from '$lib/utils/roles.js';

	let errorMessage = $state('');

	onMount(async () => {
		const supabase = getSupabaseBrowserClient();
		const code = new URL(window.location.href).searchParams.get('code');

		if (code) {
			const { error } = await supabase.auth.exchangeCodeForSession(code);
			if (error) {
				errorMessage = error.message;
				return;
			}
		}

		const {
			data: { user },
			error
		} = await supabase.auth.getUser();

		if (error || !user) {
			errorMessage = error?.message ?? 'This sign-in link is invalid or has expired.';
			return;
		}

		const [{ data: profile }, { data: roleRows }] = await Promise.all([
			supabase.from('profiles').select('account_status').eq('id', user.id).maybeSingle(),
			supabase
				.from('profile_roles')
				.select('role_id, user_roles(id, code)')
				.eq('profile_id', user.id)
		]);
		const roles = rolesFromRows(roleRows);
		const destination = dashboardPathForProfile({
			account_status: profile?.account_status,
			roles: roles.flatMap((role) => (role.code ? [role.code] : [])),
			roleIds: roles.flatMap((role) => (role.id ? [role.id] : []))
		});

		await goto(resolve(destination), {
			invalidateAll: true
		});
	});
</script>

<svelte:head>
	<title>Completing sign in · LYE Aqua Flow</title>
</svelte:head>

<main class="grid min-h-screen min-h-dvh place-items-center bg-ink-50 px-4 py-6 sm:p-6">
	<div
		class="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-[var(--shadow-card)]"
	>
		{#if errorMessage}
			<p class="font-medium text-rose-700">We couldn't complete your sign-in</p>
			<p class="mt-2 text-sm text-ink-500">{errorMessage}</p>
			<a
				href={resolve('/login')}
				class="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
			>
				Return to sign in
			</a>
		{:else}
			<span
				class="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
			></span>
			<p class="mt-3 text-sm font-medium text-ink-700">Completing your sign-in…</p>
		{/if}
	</div>
</main>
