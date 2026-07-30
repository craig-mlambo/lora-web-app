<script>
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import UsageChart from '$lib/components/UsageChart.svelte';
	import { shortTime } from '$lib/utils/format.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	/** @param {number | null} value @param {number} [digits] */
	function number(value, digits = 1) {
		if (value === null) return '—';
		return value.toLocaleString('en', {
			minimumFractionDigits: 0,
			maximumFractionDigits: digits
		});
	}

	/** @param {number} litres */
	function litres(litres) {
		if (Math.abs(litres) >= 1000) return `${number(litres / 1000, 3)} m³`;
		return `${number(litres, 1)} L`;
	}

	function exportDeviceCsv() {
		if (!data.report) return;
		const rows = [
			[
				'Household',
				'Device serial',
				'TTN device ID',
				'Usage litres',
				'Readings',
				'Average flow L/min',
				'Peak flow L/min',
				'Latest reading',
				'Latest RSSI',
				'Meter resets'
			],
			...data.report.deviceBreakdown.map((device) => [
				device.householdName,
				device.serialNumber,
				device.ttnDeviceId ?? '',
				device.usageLitres,
				device.readings,
				device.averageFlowLpm,
				device.peakFlowLpm,
				device.latestReadingAt ?? '',
				device.latestRssi ?? '',
				device.meterResets
			])
		];
		const csv = rows
			.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
			.join('\n');
		const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = downloadUrl;
		link.download = `water-usage-${data.filters.from}-to-${data.filters.to}.csv`;
		link.click();
		URL.revokeObjectURL(downloadUrl);
	}
</script>

<svelte:head>
	<title>Water usage reports · Admin · LYE Aqua Flow</title>
	<meta
		name="description"
		content="Administrative water usage, meter health, and household reporting."
	/>
</svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Water usage reports</h1>
		<p class="mt-1 text-sm text-ink-500">
			Consumption, flow, data quality, and meter health derived from stored device readings.
		</p>
	</div>
	<button
		type="button"
		onclick={exportDeviceCsv}
		disabled={!data.report || data.report.deviceBreakdown.length === 0}
		class="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 shadow-sm hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<Icon name="external" size={16} /> Export device CSV
	</button>
</div>

<form
	method="GET"
	class="mt-6 rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]"
>
	<input type="hidden" name="run" value="1" />
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1.4fr_auto]">
		<div>
			<label
				for="report-from"
				class="block text-xs font-medium uppercase tracking-wide text-ink-400"
			>
				From
			</label>
			<input
				id="report-from"
				name="from"
				type="date"
				value={data.filters.from}
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div>
			<label for="report-to" class="block text-xs font-medium uppercase tracking-wide text-ink-400">
				To
			</label>
			<input
				id="report-to"
				name="to"
				type="date"
				value={data.filters.to}
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div>
			<label
				for="report-household"
				class="block text-xs font-medium uppercase tracking-wide text-ink-400"
			>
				Household
			</label>
			<select
				id="report-household"
				name="household"
				value={data.filters.householdId}
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="all">All households</option>
				{#each data.households as household (household.id)}
					<option value={household.id}>
						{household.name} · {household.account_number}
					</option>
				{/each}
			</select>
		</div>
		<div>
			<label
				for="report-device"
				class="block text-xs font-medium uppercase tracking-wide text-ink-400"
			>
				Device
			</label>
			<select
				id="report-device"
				name="device"
				value={data.filters.deviceId}
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="all">All devices</option>
				{#each data.devices as device (device.id)}
					<option value={device.id}>
						{device.serial_number} · {device.household?.name || 'Unknown'}
					</option>
				{/each}
			</select>
		</div>
		<div class="flex items-end gap-2">
			<a
				href={resolve('/admin/reports')}
				class="rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-100"
			>
				Reset
			</a>
			<button
				type="submit"
				class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
			>
				<Icon name="filter" size={15} /> Apply
			</button>
		</div>
	</div>
</form>

{#if data.filterNotice}
	<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
		{data.filterNotice}
	</div>
{/if}

{#if data.loadError}
	<div class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{data.loadError}
	</div>
{:else if data.report}
	{#if data.report.truncated}
		<div
			class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
		>
			This report reached the 20,000-reading safety limit. Narrow the dates, household, or device
			for complete totals.
		</div>
	{/if}

	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<StatCard
			label="Total consumption"
			value={litres(data.report.metrics.totalUsageLitres)}
			icon="drop"
			accent="brand"
			hint={`${data.report.metrics.readings.toLocaleString('en')} readings`}
		/>
		<StatCard
			label="Daily average"
			value={litres(data.report.metrics.averageDailyLitres)}
			icon="chart"
			accent="emerald"
			hint={`${data.filters.from} to ${data.filters.to}`}
		/>
		<StatCard
			label="Peak day"
			value={litres(data.report.metrics.peakDailyLitres)}
			icon="activity"
			accent="amber"
			hint={data.report.metrics.peakDay}
		/>
		<StatCard
			label="Reporting meters"
			value={`${data.report.metrics.reportingDevices}/${data.report.metrics.selectedDevices}`}
			icon="gauge"
			accent="brand"
			hint="Meters with readings in range"
		/>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
		<section class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="font-semibold text-ink-900">Daily water consumption</h2>
					<p class="mt-0.5 text-sm text-ink-500">
						Cumulative-meter deltas, displayed in cubic metres
					</p>
				</div>
				<span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
					{data.report.daily.length} days
				</span>
			</div>
			{#if data.report.metrics.readings > 0}
				<div class="mt-5">
					<UsageChart data={data.report.daily} />
				</div>
			{:else}
				<div class="grid min-h-64 place-items-center text-center">
					<div>
						<Icon name="chart" size={28} class="mx-auto text-ink-300" />
						<p class="mt-3 text-sm font-medium text-ink-700">No readings in this range</p>
						<p class="mt-1 text-sm text-ink-400">Try a wider date range or another meter.</p>
					</div>
				</div>
			{/if}
		</section>

		<section class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
			<h2 class="font-semibold text-ink-900">Flow and data quality</h2>
			<dl class="mt-4 divide-y divide-ink-100">
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Average flow</dt>
					<dd class="font-medium text-ink-900">
						{number(data.report.metrics.averageFlowLpm, 3)} L/min
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Peak flow</dt>
					<dd class="font-medium text-ink-900">
						{number(data.report.metrics.peakFlowLpm, 3)} L/min
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Reverse flow</dt>
					<dd class="font-medium text-ink-900">
						{litres(data.report.metrics.reverseFlowLitres)}
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Checksum pass rate</dt>
					<dd class="font-medium text-ink-900">
						{data.report.metrics.checksumPassRate === null
							? '—'
							: `${number(data.report.metrics.checksumPassRate)}%`}
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Average RSSI</dt>
					<dd class="font-medium text-ink-900">
						{number(data.report.metrics.averageRssi)} dBm
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Average SNR</dt>
					<dd class="font-medium text-ink-900">
						{number(data.report.metrics.averageSnr)} dB
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Low-battery meters</dt>
					<dd class="font-medium text-ink-900">{data.report.metrics.lowBatteryDevices}</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-sm text-ink-500">Detected meter resets</dt>
					<dd class="font-medium text-ink-900">{data.report.metrics.meterResetCount}</dd>
				</div>
			</dl>
		</section>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-2">
		<section
			class="overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
		>
			<div class="px-6 py-4">
				<h2 class="font-semibold text-ink-900">Usage by household</h2>
				<p class="mt-0.5 text-sm text-ink-500">Ranked by consumption in the selected period</p>
			</div>
			<div class="scroll-thin overflow-x-auto border-t border-ink-100">
				<table class="w-full min-w-[520px] text-left text-sm">
					<thead class="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
						<tr>
							<th class="px-5 py-3 font-medium">Household</th>
							<th class="px-5 py-3 text-right font-medium">Meters</th>
							<th class="px-5 py-3 text-right font-medium">Consumption</th>
							<th class="px-5 py-3 text-right font-medium">Share</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-100">
						{#each data.report.householdBreakdown as household (household.id)}
							<tr>
								<td class="px-5 py-3">
									<p class="font-medium text-ink-900">{household.name}</p>
									<p class="text-xs text-ink-400">{household.accountNumber}</p>
								</td>
								<td class="px-5 py-3 text-right text-ink-600">{household.devices}</td>
								<td class="px-5 py-3 text-right font-medium text-ink-800">
									{litres(household.usageLitres)}
								</td>
								<td class="px-5 py-3 text-right text-ink-500">
									{data.report.metrics.totalUsageLitres > 0
										? `${number(
												(household.usageLitres / data.report.metrics.totalUsageLitres) * 100
											)}%`
										: '0%'}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="px-5 py-10 text-center text-ink-400">
									No household usage is available.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section
			class="overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
		>
			<div class="px-6 py-4">
				<h2 class="font-semibold text-ink-900">Usage by device</h2>
				<p class="mt-0.5 text-sm text-ink-500">Consumption and meter health summary</p>
			</div>
			<div class="scroll-thin overflow-x-auto border-t border-ink-100">
				<table class="w-full min-w-[680px] text-left text-sm">
					<thead class="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
						<tr>
							<th class="px-5 py-3 font-medium">Device</th>
							<th class="px-5 py-3 text-right font-medium">Consumption</th>
							<th class="px-5 py-3 text-right font-medium">Readings</th>
							<th class="px-5 py-3 text-right font-medium">Peak flow</th>
							<th class="px-5 py-3 text-right font-medium">Latest</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-100">
						{#each data.report.deviceBreakdown as device (device.id)}
							<tr>
								<td class="px-5 py-3">
									<p class="font-mono text-xs font-medium text-ink-900">
										{device.serialNumber}
									</p>
									<p class="text-xs text-ink-400">{device.householdName}</p>
								</td>
								<td class="px-5 py-3 text-right font-medium text-ink-800">
									{litres(device.usageLitres)}
								</td>
								<td class="px-5 py-3 text-right text-ink-600">{device.readings}</td>
								<td class="px-5 py-3 text-right text-ink-600">
									{number(device.peakFlowLpm, 3)} L/min
								</td>
								<td class="whitespace-nowrap px-5 py-3 text-right text-ink-500">
									{device.latestReadingAt ? shortTime(device.latestReadingAt) : '—'}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="px-5 py-10 text-center text-ink-400">
									No device usage is available.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>

	<p class="mt-5 text-xs leading-5 text-ink-400">
		Consumption uses interval litres when present; otherwise it is derived from consecutive
		cumulative readings. Negative cumulative changes are treated as meter resets. Daily buckets use
		the household timezone, defaulting to Africa/Harare.
	</p>
{:else}
	<div class="mt-6 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
		<Icon name="chart" size={30} class="mx-auto text-ink-300" />
		<p class="mt-3 font-medium text-ink-700">Choose the report filters and click Apply.</p>
		<p class="mt-1 text-sm text-ink-400">Readings are loaded only when a report is requested.</p>
	</div>
{/if}
