<script>
	import { resolve } from '$app/paths';
	import StatCard from '$lib/components/StatCard.svelte';
	import MeterCard from '$lib/components/MeterCard.svelte';
	import UsageChart from '$lib/components/UsageChart.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { shortTime } from '$lib/utils/format.js';
	import { toDashboardUser } from '$lib/utils/profile.js';

	let { data } = $props();
	const dashboardUser = $derived(toDashboardUser(data.profile, data.user));

	/** @type {Record<string, string>} */
	const severityStyles = {
		critical: 'bg-rose-50 text-rose-600 ring-rose-600/20',
		warning: 'bg-amber-50 text-amber-600 ring-amber-600/20',
		info: 'bg-brand-50 text-brand-600 ring-brand-600/20'
	};

	/** @param {number} litres */
	function litres(litres) {
		return litres >= 1000
			? `${(litres / 1000).toLocaleString('en', { maximumFractionDigits: 3 })} m³`
			: `${litres.toLocaleString('en', { maximumFractionDigits: 1 })} L`;
	}
</script>

<svelte:head><title>Dashboard · LYE Aqua Flow</title></svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">
			Hello, {dashboardUser.name.split(' ')[0]}
		</h1>
		<p class="mt-1 text-sm text-ink-500">
			Your household water usage and prepaid credit at a glance.
		</p>
	</div>
	<a
		href={resolve('/dashboard/payments')}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
	>
		<Icon name="plus" size={17} /> Buy water credit
	</a>
</div>

{#if data.loadError}
	<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{data.loadError}
	</div>
{/if}

{#if data.summary}
	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<StatCard
			label="Usage today"
			value={litres(data.summary.todayLitres)}
			icon="drop"
			accent="brand"
			hint="Across your accessible meters"
		/>
		<StatCard
			label="Month to date"
			value={litres(data.summary.monthLitres)}
			icon="chart"
			accent="emerald"
			hint="Meter intervals received this month"
		/>
		<StatCard
			label="Active meters"
			value={`${data.summary.activeMeters} / ${data.summary.totalMeters}`}
			icon="gauge"
			accent="brand"
			hint={`${data.households.length} accessible household${data.households.length === 1 ? '' : 's'}`}
		/>
		<StatCard
			label="Estimated credit"
			value={litres(data.summary.remainingCreditLitres)}
			icon="drop"
			accent={data.summary.remainingCreditLitres > 100 ? 'emerald' : 'amber'}
			hint="Latest balance reported by meters"
		/>
	</div>
{/if}

{#if data.households.length === 0 && !data.loadError}
	<div class="mt-6 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
		<Icon name="home" size={32} class="mx-auto text-ink-300" />
		<h2 class="mt-3 font-semibold text-ink-900">No household connected yet</h2>
		<p class="mx-auto mt-1 max-w-md text-sm text-ink-500">
			An administrator must create your household or add you as an active member before meter data
			appears here.
		</p>
	</div>
{:else}
	<div class="mt-6 grid gap-6 lg:grid-cols-3">
		<div
			class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)] lg:col-span-2"
		>
			<div class="flex items-center justify-between gap-3">
				<div>
					<h2 class="font-semibold text-ink-900">Daily consumption</h2>
					<p class="text-sm text-ink-500">Current month · cubic metres per day</p>
				</div>
				<a
					href={resolve('/dashboard/usage')}
					class="text-sm font-medium text-brand-600 hover:text-brand-700">Full report</a
				>
			</div>
			<div class="mt-4">
				{#if data.chart.length}
					<UsageChart data={data.chart} />
				{:else}
					<div class="grid h-64 place-items-center text-sm text-ink-400">
						No usage readings this month.
					</div>
				{/if}
			</div>
		</div>

		<div class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold text-ink-900">Attention needed</h2>
				<span class="text-sm text-ink-400">{data.alerts.length}</span>
			</div>
			{#if data.alerts.length}
				<ul class="mt-4 space-y-3">
					{#each data.alerts as alert, index (`${alert.title}-${alert.meter}-${index}`)}
						<li class="flex gap-3 rounded-xl border border-ink-100 p-3">
							<span
								class="grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset {severityStyles[
									alert.severity
								]}"
							>
								<Icon name={alert.severity === 'info' ? 'drop' : 'alert'} size={18} />
							</span>
							<div class="min-w-0">
								<p class="text-sm font-medium text-ink-900">{alert.title}</p>
								<p class="mt-0.5 text-xs text-ink-500">{alert.detail}</p>
								<p class="mt-1 text-xs text-ink-400">{alert.meter}</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="grid h-52 place-items-center text-center">
					<div>
						<Icon name="check" size={28} class="mx-auto text-emerald-500" />
						<p class="mt-2 text-sm font-medium text-ink-700">Everything looks healthy</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="mt-8">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold tracking-tight text-ink-900">Your meters</h2>
			<a
				href={resolve('/dashboard/meters')}
				class="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
			>
				View all <Icon name="arrow" size={16} />
			</a>
		</div>
		{#if data.meters.length}
			<div class="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
				{#each data.meters.slice(0, 3) as meter (meter.id)}
					<MeterCard {meter} />
				{/each}
			</div>
		{:else}
			<div
				class="mt-4 rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center text-sm text-ink-400"
			>
				No meters are assigned to your households.
			</div>
		{/if}
	</div>

	<div
		class="mt-8 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
	>
		<div class="flex items-center justify-between px-6 py-4">
			<h2 class="font-semibold text-ink-900">Recent readings</h2>
			<a href={resolve('/dashboard/readings')} class="text-sm font-medium text-brand-600"
				>View all</a
			>
		</div>
		<div class="scroll-thin overflow-x-auto">
			<table class="w-full min-w-[680px] text-left text-sm">
				<thead
					class="border-y border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400"
				>
					<tr>
						<th class="px-6 py-3 font-medium">Time</th>
						<th class="px-6 py-3 font-medium">Meter</th>
						<th class="px-6 py-3 text-right font-medium">Cumulative</th>
						<th class="px-6 py-3 text-right font-medium">Flow</th>
						<th class="px-6 py-3 text-center font-medium">Checksum</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-ink-100">
					{#each data.readings as reading (reading.id)}
						<tr>
							<td class="whitespace-nowrap px-6 py-3 text-ink-600"
								>{shortTime(reading.reading_time)}</td
							>
							<td class="px-6 py-3 font-medium text-ink-900">{reading.device.serial_number}</td>
							<td class="px-6 py-3 text-right font-mono text-ink-700"
								>{Number(reading.cumulative_litres).toFixed(1)} L</td
							>
							<td class="px-6 py-3 text-right font-mono text-ink-700"
								>{Number(reading.instant_flow_lpm ?? 0).toFixed(2)} L/min</td
							>
							<td class="px-6 py-3 text-center">
								<span
									class="rounded-full px-2 py-0.5 text-xs font-medium {reading.checksum_ok === false
										? 'bg-rose-50 text-rose-700'
										: 'bg-emerald-50 text-emerald-700'}"
								>
									{reading.checksum_ok === false ? 'Failed' : 'OK'}
								</span>
							</td>
						</tr>
					{/each}
					{#if data.readings.length === 0}
						<tr
							><td colspan="5" class="px-6 py-10 text-center text-ink-400"
								>No readings received yet.</td
							></tr
						>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
{/if}
