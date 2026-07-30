<script>
	import { resolve } from '$app/paths';
	import StatCard from '$lib/components/StatCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { timeAgo } from '$lib/utils/format.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const quickLinks = /** @type {const} */ ([
		{ label: 'Users', href: '/admin/users', icon: 'users', desc: 'Approve profiles and roles' },
		{ label: 'Households', href: '/admin/households', icon: 'home', desc: 'Owners and addresses' },
		{ label: 'Devices', href: '/admin/devices', icon: 'gauge', desc: 'Register and assign meters' },
		{ label: 'Accounts', href: '/admin/accounts', icon: 'drop', desc: 'Prepaid water accounts' },
		{ label: 'Tariffs', href: '/admin/tariffs', icon: 'chart', desc: 'Rates and tariff bands' },
		{ label: 'Payments', href: '/admin/payments', icon: 'zap', desc: 'Payments and refunds' },
		{ label: 'Readings', href: '/admin/readings', icon: 'activity', desc: 'Stored meter readings' },
		{
			label: 'Reports',
			href: '/admin/reports',
			icon: 'chart',
			desc: 'Usage and meter health'
		},
		{ label: 'Live readings', href: '/admin/live', icon: 'signal', desc: 'Live meter telemetry' }
	]);

	/**
	 * @param {string} status
	 */
	function statusClass(status) {
		if (['active', 'succeeded', 'approved'].includes(status)) {
			return 'bg-emerald-50 text-emerald-700';
		}
		if (['pending', 'processing'].includes(status)) {
			return 'bg-amber-50 text-amber-700';
		}
		return 'bg-ink-100 text-ink-600';
	}
</script>

<svelte:head>
	<title>Admin · LYE Aqua Flow</title>
</svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Admin console</h1>
		<p class="mt-1 text-sm text-ink-500">
			Database-backed management for households, meters, prepaid accounts, and payments.
		</p>
	</div>
	<div class="flex gap-2">
		<a
			href={resolve('/admin/users')}
			class="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 shadow-sm hover:bg-ink-50"
		>
			<Icon name="users" size={17} /> Review users
		</a>
		<a
			href={resolve('/admin/devices')}
			class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
		>
			<Icon name="plus" size={17} /> Register device
		</a>
	</div>
</div>

<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Households"
		value={String(data.summary.households)}
		icon="home"
		accent="brand"
		hint={`${data.summary.accounts} prepaid accounts`}
	/>
	<StatCard
		label="Registered meters"
		value={String(data.summary.devices)}
		icon="gauge"
		accent="emerald"
		hint={`${data.summary.activeDevices} active`}
	/>
	<StatCard
		label="Active profiles"
		value={String(data.summary.activeProfiles)}
		icon="users"
		accent="brand"
		hint={`${data.summary.pendingProfiles} awaiting approval`}
	/>
	<StatCard
		label="Payment records"
		value={String(data.summary.payments)}
		icon="zap"
		accent="amber"
		hint="Across all prepaid accounts"
	/>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-2">
	<section class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="font-semibold text-ink-900">Newest profiles</h2>
				<p class="text-sm text-ink-500">Recently created customer accounts</p>
			</div>
			<a
				href={resolve('/admin/users')}
				class="text-sm font-medium text-brand-700 hover:text-brand-800">View all</a
			>
		</div>

		{#if data.recentProfiles.length}
			<ul class="mt-4 divide-y divide-ink-100">
				{#each data.recentProfiles as profile (profile.id)}
					<li class="flex items-center justify-between gap-4 py-3">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-ink-900">
								{profile.full_name || 'Unnamed profile'}
							</p>
							<p class="mt-0.5 text-xs text-ink-400">{timeAgo(profile.created_at, new Date())}</p>
						</div>
						<span
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusClass(
								profile.approval_status || profile.account_status
							)}"
						>
							{profile.approval_status || profile.account_status}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-6 text-sm text-ink-400">No profiles have been created yet.</p>
		{/if}
	</section>

	<section class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="font-semibold text-ink-900">Recent payments</h2>
				<p class="text-sm text-ink-500">Latest prepaid payment records</p>
			</div>
			<a
				href={resolve('/admin/payments')}
				class="text-sm font-medium text-brand-700 hover:text-brand-800">View all</a
			>
		</div>

		{#if data.recentPayments.length}
			<ul class="mt-4 divide-y divide-ink-100">
				{#each data.recentPayments as payment (payment.id)}
					<li class="flex items-center justify-between gap-4 py-3">
						<div class="min-w-0">
							<p class="text-sm font-medium text-ink-900">
								{payment.currency}
								{Number(payment.amount).toFixed(2)}
							</p>
							<p class="mt-0.5 truncate text-xs text-ink-400">
								{payment.provider} · {timeAgo(payment.created_at, new Date())}
							</p>
						</div>
						<span
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusClass(payment.status)}"
						>
							{payment.status}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-6 text-sm text-ink-400">No payment records have been created yet.</p>
		{/if}
	</section>
</div>

<section class="mt-8">
	<h2 class="text-lg font-semibold tracking-tight text-ink-900">Manage</h2>
	<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each quickLinks as link (link.href)}
			<a
				href={resolve(link.href)}
				class="group flex flex-col rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]"
			>
				<span
					class="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white"
				>
					<Icon name={link.icon} size={20} />
				</span>
				<span class="mt-3 font-medium text-ink-900">{link.label}</span>
				<span class="mt-0.5 text-xs text-ink-400">{link.desc}</span>
			</a>
		{/each}
	</div>
</section>
