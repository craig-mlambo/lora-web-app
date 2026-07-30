<script>
	import Icon from '$lib/components/Icon.svelte';
	import { shortTime } from '$lib/utils/format.js';
	let { data } = $props();
</script>

<svelte:head><title>Meter readings · LYE Aqua Flow</title></svelte:head>
<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Meter readings</h1>
	<p class="mt-1 text-sm text-ink-500">
		The 250 most recent readings for the selected accessible meters.
	</p>
</div>
{#if data.loadError}<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
	>
		{data.loadError}
	</div>{/if}
<form
	method="GET"
	class="mt-6 grid gap-3 rounded-2xl border border-ink-200 bg-white p-4 sm:flex sm:flex-wrap sm:items-end"
>
	<label class="w-full text-sm font-medium text-ink-700 sm:w-auto"
		>Household
		<select
			name="household"
			value={data.filters.householdId}
			class="mt-1 block w-full rounded-xl border-ink-200 px-3 py-2 text-sm sm:w-auto"
			><option value="all">All households</option
			>{#each data.households as household (household.id)}<option value={household.id}
					>{household.name}</option
				>{/each}</select
		>
	</label>
	<label class="w-full text-sm font-medium text-ink-700 sm:w-auto"
		>Meter
		<select
			name="device"
			value={data.filters.deviceId}
			class="mt-1 block w-full rounded-xl border-ink-200 px-3 py-2 text-sm sm:w-auto"
			><option value="all">All meters</option>{#each data.devices as device (device.id)}<option
					value={device.id}>{device.serial_number} · {device.household?.name}</option
				>{/each}</select
		>
	</label>
	<button
		class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white sm:w-auto"
		><Icon name="filter" size={16} /> Apply</button
	>
</form>
<div
	class="mt-5 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<div class="scroll-thin overflow-x-auto">
		<table class="w-full min-w-[980px] text-left text-sm">
			<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400"
				><tr
					><th class="px-4 py-3">Time</th><th class="px-4 py-3">Meter</th><th
						class="px-4 py-3 text-right">Cumulative</th
					><th class="px-4 py-3 text-right">Interval</th><th class="px-4 py-3 text-right">Flow</th
					><th class="px-4 py-3 text-right">Credit</th><th class="px-4 py-3 text-right">Battery</th
					><th class="px-4 py-3 text-right">Signal</th><th class="px-4 py-3 text-center"
						>Integrity</th
					></tr
				></thead
			>
			<tbody class="divide-y divide-ink-100">
				{#each data.readings as reading (reading.id)}
					<tr
						><td class="whitespace-nowrap px-4 py-3 text-ink-500"
							>{shortTime(reading.reading_time)}</td
						><td class="px-4 py-3"
							><p class="font-medium text-ink-900">{reading.device?.serial_number || 'Unknown'}</p>
							<p class="text-xs text-ink-400">{reading.device?.household?.name}</p></td
						><td class="px-4 py-3 text-right font-mono"
							>{Number(reading.cumulative_litres).toFixed(1)} L</td
						><td class="px-4 py-3 text-right font-mono"
							>{reading.interval_litres == null
								? '—'
								: `${Number(reading.interval_litres).toFixed(2)} L`}</td
						><td class="px-4 py-3 text-right font-mono"
							>{reading.instant_flow_lpm == null
								? '—'
								: `${Number(reading.instant_flow_lpm).toFixed(2)} L/min`}</td
						><td class="px-4 py-3 text-right font-mono"
							>{reading.remaining_credit_litres == null
								? '—'
								: `${Number(reading.remaining_credit_litres).toFixed(1)} L`}</td
						><td class="px-4 py-3 text-right"
							>{reading.battery_percent == null ? '—' : `${reading.battery_percent}%`}</td
						><td class="px-4 py-3 text-right font-mono">{reading.rssi ?? '—'} dBm</td><td
							class="px-4 py-3 text-center"
							><span
								class="rounded-full px-2 py-0.5 text-xs font-medium {reading.checksum_ok === false
									? 'bg-rose-50 text-rose-700'
									: 'bg-emerald-50 text-emerald-700'}"
								>{reading.checksum_ok === false ? 'Failed' : 'OK'}</span
							></td
						></tr
					>
				{/each}
				{#if data.readings.length === 0}<tr
						><td colspan="9" class="px-4 py-12 text-center text-ink-400">No readings found.</td></tr
					>{/if}
			</tbody>
		</table>
	</div>
</div>
