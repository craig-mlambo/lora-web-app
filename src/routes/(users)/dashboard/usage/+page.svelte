<script>
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import UsageChart from '$lib/components/UsageChart.svelte';
	import { shortTime } from '$lib/utils/format.js';
	let { data } = $props();
	/** @param {number} value */
	function litres(value) {
		return value >= 1000
			? `${(value / 1000).toLocaleString('en', { maximumFractionDigits: 3 })} m³`
			: `${value.toLocaleString('en', { maximumFractionDigits: 1 })} L`;
	}
</script>

<svelte:head><title>Water usage · LYE Aqua Flow</title></svelte:head>
<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Water usage</h1>
	<p class="mt-1 text-sm text-ink-500">
		Explore consumption across your accessible households and meters.
	</p>
</div>
{#if data.loadError}<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
	>
		{data.loadError}
	</div>{/if}
{#if data.filterNotice}<div
		class="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
	>
		{data.filterNotice}
	</div>{/if}
<form
	method="GET"
	class="mt-6 grid gap-4 rounded-2xl border border-ink-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-5"
>
	<input type="hidden" name="run" value="1" />
	<label class="text-sm font-medium text-ink-700"
		>From<input
			name="from"
			type="date"
			value={data.filters.from}
			required
			class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2"
		/></label
	>
	<label class="text-sm font-medium text-ink-700"
		>To<input
			name="to"
			type="date"
			value={data.filters.to}
			required
			class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2"
		/></label
	>
	<label class="text-sm font-medium text-ink-700"
		>Household<select
			name="household"
			value={data.filters.householdId}
			class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2"
			><option value="all">All households</option
			>{#each data.households as household (household.id)}<option value={household.id}
					>{household.name}</option
				>{/each}</select
		></label
	>
	<label class="text-sm font-medium text-ink-700"
		>Meter<select
			name="device"
			value={data.filters.deviceId}
			class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2"
			><option value="all">All meters</option>{#each data.devices as device (device.id)}<option
					value={device.id}>{device.serial_number} · {device.household?.name}</option
				>{/each}</select
		></label
	>
	<div class="flex items-end gap-2">
		<a
			href={resolve('/dashboard/usage')}
			class="rounded-xl px-3 py-2 text-sm text-ink-500 hover:bg-ink-100">Reset</a
		><button
			class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
			><Icon name="filter" size={16} /> Apply</button
		>
	</div>
</form>
{#if data.report}
	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<StatCard
			label="Total usage"
			value={litres(data.report.totalLitres)}
			icon="drop"
			accent="brand"
		/>
		<StatCard
			label="Daily average"
			value={litres(data.report.averageDailyLitres)}
			icon="chart"
			accent="emerald"
		/>
		<StatCard
			label="Peak day"
			value={litres(data.report.peakDay.consumption * 1000)}
			icon="activity"
			accent="amber"
			hint={new Date(`${data.report.peakDay.day}T12:00:00`).toLocaleDateString()}
		/>
		<StatCard
			label="Readings analyzed"
			value={data.report.readingCount.toLocaleString()}
			icon="signal"
			accent="brand"
		/>
	</div>
	<div class="mt-6 rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
		<h2 class="font-semibold text-ink-900">Daily consumption</h2>
		<p class="text-sm text-ink-500">Cubic metres per day</p>
		<div class="mt-4"><UsageChart data={data.report.daily} /></div>
	</div>
	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<div class="rounded-2xl border border-ink-200 bg-white p-5">
			<p class="text-sm text-ink-500">Average flow</p>
			<p class="mt-2 text-xl font-semibold">{data.report.averageFlowLpm.toFixed(2)} L/min</p>
		</div>
		<div class="rounded-2xl border border-ink-200 bg-white p-5">
			<p class="text-sm text-ink-500">Peak flow</p>
			<p class="mt-2 text-xl font-semibold">{data.report.peakFlowLpm.toFixed(2)} L/min</p>
		</div>
		<div class="rounded-2xl border border-ink-200 bg-white p-5">
			<p class="text-sm text-ink-500">Checksum pass rate</p>
			<p class="mt-2 text-xl font-semibold">
				{data.report.checksumPassRate == null ? '—' : `${data.report.checksumPassRate.toFixed(1)}%`}
			</p>
		</div>
		<div class="rounded-2xl border border-ink-200 bg-white p-5">
			<p class="text-sm text-ink-500">Low-battery meters</p>
			<p class="mt-2 text-xl font-semibold">{data.report.lowBatteryMeters}</p>
		</div>
	</div>
	<div class="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
		<div class="border-b border-ink-100 px-5 py-4">
			<h2 class="font-semibold text-ink-900">Usage by meter</h2>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[620px] text-left text-sm">
				<thead class="bg-ink-50 text-xs uppercase text-ink-400"
					><tr
						><th class="px-5 py-3">Meter</th><th class="px-5 py-3">Household</th><th
							class="px-5 py-3 text-right">Usage</th
						><th class="px-5 py-3">Latest reading</th></tr
					></thead
				><tbody class="divide-y divide-ink-100"
					>{#each data.report.devices as device (device.id)}<tr
							><td class="px-5 py-3 font-medium">{device.serial_number}</td><td class="px-5 py-3"
								>{device.household?.name}</td
							><td class="px-5 py-3 text-right font-semibold">{litres(device.usageLitres)}</td><td
								class="px-5 py-3 text-ink-500"
								>{device.latest ? shortTime(device.latest.reading_time) : 'No reading'}</td
							></tr
						>{/each}{#if data.report.devices.length === 0}<tr
							><td colspan="4" class="px-5 py-10 text-center text-ink-400"
								>No meters in this selection.</td
							></tr
						>{/if}</tbody
				>
			</table>
		</div>
	</div>
{:else if !data.loadError}
	<div class="mt-6 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
		<Icon name="chart" size={30} class="mx-auto text-ink-300" />
		<p class="mt-3 font-medium text-ink-700">Choose a date range and click Apply.</p>
		<p class="mt-1 text-sm text-ink-400">
			Usage readings are fetched only when you request a report.
		</p>
	</div>
{/if}
