<script>
	import Icon from '$lib/components/Icon.svelte';
	import { shortTime, timeAgo } from '$lib/utils/format.js';

	let { data } = $props();
	let householdFilter = $state('all');
	let statusFilter = $state('all');
	const meters = $derived(
		data.meters.filter(
			(meter) =>
				(householdFilter === 'all' || meter.household_id === householdFilter) &&
				(statusFilter === 'all' || meter.status === statusFilter)
		)
	);
	/** @type {Record<string, string>} */
	const statusStyles = {
		pending: 'bg-amber-50 text-amber-700',
		active: 'bg-emerald-50 text-emerald-700',
		inactive: 'bg-ink-100 text-ink-500',
		faulty: 'bg-rose-50 text-rose-700'
	};
</script>

<svelte:head><title>My meters · LYE Aqua Flow</title></svelte:head>

<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">My meters</h1>
	<p class="mt-1 text-sm text-ink-500">
		Status and latest telemetry for meters connected to your households.
	</p>
</div>

{#if data.loadError}
	<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{data.loadError}
	</div>
{/if}

<div class="mt-6 flex flex-wrap gap-3">
	<select
		bind:value={householdFilter}
		aria-label="Filter by household"
		class="rounded-xl border-ink-200 bg-white px-3 py-2 text-sm"
	>
		<option value="all">All households</option>
		{#each data.households as household (household.id)}<option value={household.id}
				>{household.name}</option
			>{/each}
	</select>
	<select
		bind:value={statusFilter}
		aria-label="Filter by status"
		class="rounded-xl border-ink-200 bg-white px-3 py-2 text-sm"
	>
		<option value="all">All statuses</option>
		<option value="active">Active</option><option value="pending">Pending</option><option
			value="inactive">Inactive</option
		><option value="faulty">Faulty</option>
	</select>
</div>

<div class="mt-5 grid gap-5 lg:grid-cols-2">
	{#each meters as meter (meter.id)}
		<article class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
			<header class="flex items-start justify-between gap-4">
				<div>
					<h2 class="font-semibold text-ink-900">{meter.household?.name || 'Household'}</h2>
					<p class="mt-1 font-mono text-xs text-ink-400">SN {meter.serial_number}</p>
				</div>
				<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusStyles[meter.status]}"
					>{meter.status}</span
				>
			</header>
			<div class="mt-5 grid gap-4 sm:grid-cols-3">
				<div>
					<p class="text-xs uppercase tracking-wide text-ink-400">Cumulative</p>
					<p class="mt-1 text-lg font-semibold text-ink-800">
						{Number(meter.latest?.cumulative_litres ?? 0).toLocaleString()} L
					</p>
				</div>
				<div>
					<p class="text-xs uppercase tracking-wide text-ink-400">Current flow</p>
					<p class="mt-1 text-lg font-semibold text-ink-800">
						{Number(meter.latest?.instant_flow_lpm ?? 0).toFixed(2)} L/min
					</p>
				</div>
				<div>
					<p class="text-xs uppercase tracking-wide text-ink-400">Credit</p>
					<p class="mt-1 text-lg font-semibold text-ink-800">
						{Number(meter.latest?.remaining_credit_litres ?? 0).toLocaleString()} L
					</p>
				</div>
			</div>
			<div class="mt-5 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
				<p class="flex items-center gap-2 text-ink-600">
					<Icon name="battery" size={16} /> Battery {meter.latest?.battery_percent == null
						? '—'
						: `${meter.latest.battery_percent}%`}
				</p>
				<p class="flex items-center gap-2 text-ink-600">
					<Icon name="signal" size={16} /> RSSI {meter.latest?.rssi ?? '—'} dBm
				</p>
				<p class="flex items-center gap-2 text-ink-600">
					<Icon name="drop" size={16} /> Valve {meter.latest?.valve_state ??
						meter.valve_state ??
						'unknown'}
				</p>
				<p class="flex items-center gap-2 text-ink-600">
					<Icon name={meter.latest?.checksum_ok === false ? 'alert' : 'check'} size={16} /> Checksum {meter
						.latest?.checksum_ok === false
						? 'failed'
						: 'OK'}
				</p>
			</div>
			<footer
				class="mt-4 flex flex-wrap justify-between gap-2 border-t border-ink-100 pt-4 text-xs text-ink-400"
			>
				<span>{meter.manufacturer || 'Unknown make'} {meter.model || ''}</span>
				<span title={meter.latest?.reading_time ? shortTime(meter.latest.reading_time) : ''}
					>{meter.latest?.reading_time ? timeAgo(meter.latest.reading_time) : 'No readings'}</span
				>
			</footer>
		</article>
	{/each}
</div>
{#if meters.length === 0 && !data.loadError}<div
		class="mt-6 rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center text-sm text-ink-400"
	>
		No meters match this filter.
	</div>{/if}
