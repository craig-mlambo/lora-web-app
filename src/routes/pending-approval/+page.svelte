<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getSupabaseBrowserClient } from '$lib/supabaseClient.js';

	let { data } = $props();
	let signingOut = $state(false);

	const isPending = $derived(data.profile?.account_status === 'invited');

	async function signOut() {
		signingOut = true;
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signOut();
		await invalidateAll();
		await goto(resolve('/login'));
	}

	async function refreshStatus() {
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Account status · LYE Aqua Flow</title>
</svelte:head>

<main class="grid min-h-screen min-h-dvh place-items-center bg-ink-50 px-4 py-6 sm:p-6">
	<div class="w-full max-w-md">
		<div class="flex justify-center"><Logo /></div>
		<section
			class="mt-8 rounded-2xl border border-ink-200 bg-white p-5 text-center shadow-[var(--shadow-card)] sm:p-7"
		>
			<div
				class="mx-auto grid h-14 w-14 place-items-center rounded-full {isPending
					? 'bg-amber-100 text-amber-700'
					: 'bg-rose-100 text-rose-700'}"
			>
				<Icon name={isPending ? 'clock' : 'alert'} size={25} />
			</div>

			<h1 class="mt-4 text-xl font-semibold text-ink-900">
				{isPending ? 'Approval pending' : 'Account unavailable'}
			</h1>
			<p class="mt-2 text-sm leading-relaxed text-ink-500">
				{#if isPending}
					Your house-owner profile has been created. An administrator needs to approve it before you
					can access the dashboard.
				{:else}
					Your account status is
					<span class="font-medium text-ink-700">{data.profile?.account_status ?? 'unknown'}</span>.
					Contact an administrator if you believe this is incorrect.
				{/if}
			</p>

			<div class="mt-6 grid gap-2 sm:grid-cols-2">
				<button
					type="button"
					onclick={refreshStatus}
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
				>
					<Icon name="refresh" size={17} /> Check status
				</button>
				<button
					type="button"
					disabled={signingOut}
					onclick={signOut}
					class="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-60"
				>
					<Icon name="logout" size={17} />
					{signingOut ? 'Signing out…' : 'Sign out'}
				</button>
			</div>
		</section>
	</div>
</main>
