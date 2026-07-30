<script>
	import { navigating, page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';
	import { ownerNav } from '$lib/data/nav.js';
	import { getSupabaseBrowserClient } from '$lib/supabaseClient.js';

	/**
	 * @typedef {import('$lib/data/nav.js').NavItem} NavItem
	 * @typedef {Object} Props
	 * @property {{name:string, email:string, initials:string}} user
	 * @property {NavItem[]} [nav]
	 * @property {string} [roleLabel]
	 * @property {boolean} [canViewAdmin]
	 * @property {import('svelte').Snippet} children
	 */

	/** @type {Props} */
	let { user, nav = ownerNav, roleLabel = '', canViewAdmin = false, children } = $props();

	let mobileOpen = $state(false);
	let signingOut = $state(false);
	const isAdminDashboard = $derived(page.url.pathname.startsWith('/admin'));
	const destinationPath = $derived(navigating.to?.url.pathname ?? null);

	/** @param {string} href */
	function isActive(href) {
		const base = href.split('#')[0];
		const p = page.url.pathname;
		if (p === base) return true;
		return base !== '/admin' && base !== '/dashboard' && p.startsWith(base + '/');
	}

	async function signOut() {
		signingOut = true;
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signOut();
		await invalidateAll();
		await goto(resolve('/login'));
	}
</script>

{#snippet sidebar()}
	<div class="flex h-full flex-col">
		<div class="flex h-16 items-center gap-2 px-5">
			<Logo />
			{#if roleLabel}
				<span
					class="rounded-md bg-ink-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
				>
					{roleLabel}
				</span>
			{/if}
		</div>
		<div
			class="mx-3 grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 text-xs font-semibold"
			aria-label="Choose dashboard"
		>
			<a
				href={resolve('/dashboard')}
				class="rounded-lg px-2 py-2 text-center transition-colors {isAdminDashboard
					? 'text-ink-500 hover:text-ink-800'
					: 'bg-white text-ink-900 shadow-sm'}"
			>
				User
			</a>
			{#if canViewAdmin}
				<a
					href={resolve('/admin')}
					class="rounded-lg px-2 py-2 text-center transition-colors {isAdminDashboard
						? 'bg-white text-ink-900 shadow-sm'
						: 'text-ink-500 hover:text-ink-800'}"
				>
					Admin
				</a>
			{:else}
				<span
					class="cursor-not-allowed rounded-lg px-2 py-2 text-center text-ink-400"
					aria-disabled="true"
					title="Admin access required"
				>
					Admin
				</span>
			{/if}
		</div>
		<nav class="flex-1 space-y-1 px-3 py-4" data-sveltekit-preload-code="viewport">
			{#each nav as item (item.label)}
				<a
					href={resolve(item.href)}
					data-sveltekit-preload-data="hover"
					aria-busy={destinationPath === item.href}
					onclick={() => (mobileOpen = false)}
					class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors {isActive(
						item.href
					)
						? 'bg-brand-50 text-brand-700'
						: 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<Icon name={item.icon} size={19} />
					<span class="flex-1">{item.label}</span>
					{#if destinationPath === item.href}
						<span
							class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
							aria-label="Loading page"
						></span>
					{:else if item.badge}
						<span
							class="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
						>
							{item.badge}
						</span>
					{/if}
				</a>
			{/each}
		</nav>
		<div class="border-t border-ink-100 p-3">
			<div class="flex items-center gap-3 rounded-xl px-2 py-2">
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white"
				>
					{user.initials}
				</span>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-ink-800">{user.name}</p>
					<p class="truncate text-xs text-ink-400">{user.email}</p>
				</div>
			</div>
			<button
				type="button"
				disabled={signingOut}
				onclick={signOut}
				class="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:opacity-60"
			>
				<Icon name="logout" size={19} />
				{signingOut ? 'Signing out…' : 'Sign out'}
			</button>
		</div>
	</div>
{/snippet}

<div class="min-h-screen min-h-dvh bg-ink-50">
	{#if navigating.to}
		<div
			class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-100"
			role="progressbar"
			aria-label="Loading page"
		>
			<div class="h-full w-2/3 animate-pulse bg-brand-600"></div>
		</div>
	{/if}
	<!-- Desktop sidebar -->
	<aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-ink-200 bg-white lg:block">
		{@render sidebar()}
	</aside>

	<!-- Mobile drawer -->
	{#if mobileOpen}
		<div class="fixed inset-0 z-40 lg:hidden">
			<button
				class="absolute inset-0 bg-ink-900/40"
				aria-label="Close menu"
				onclick={() => (mobileOpen = false)}
			></button>
			<div
				class="scroll-thin absolute inset-y-0 left-0 w-72 max-w-[calc(100vw-3rem)] overflow-y-auto bg-white shadow-xl"
			>
				{@render sidebar()}
			</div>
		</div>
	{/if}

	<div class="min-w-0 lg:pl-64">
		<!-- Topbar -->
		<header
			class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/80 px-4 backdrop-blur-md sm:px-6"
		>
			<button
				class="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 lg:hidden"
				aria-label="Open menu"
				onclick={() => (mobileOpen = true)}
			>
				<Icon name="menu" />
			</button>

			<label class="relative hidden max-w-md flex-1 sm:block">
				<span
					class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400"
				>
					<Icon name="search" size={18} />
				</span>
				<input
					type="search"
					placeholder="Search meters, households, serials…"
					class="w-full rounded-xl border-ink-200 bg-ink-50 py-2 pl-10 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:ring-brand-400"
				/>
			</label>

			<div class="ml-auto flex items-center gap-2">
				<button
					class="relative grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
					aria-label="Notifications"
				>
					<Icon name="bell" />
					<span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
					></span>
				</button>
				<span
					class="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white lg:hidden"
				>
					{user.initials}
				</span>
			</div>
		</header>

		<main
			class="mx-auto min-w-0 max-w-7xl px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8"
		>
			{@render children()}
		</main>
	</div>
</div>
