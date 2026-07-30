<script>
	import Icon from '$lib/components/Icon.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data } = $props();
	let deviceFilter = $state('all');
	/** @type {'all'|'ok'|'fail'} */
	let checksumFilter = $state('all');

	const filtered = $derived(
		data.readings.filter((reading) => {
			const matchesDevice = deviceFilter === 'all' || reading.device_id === deviceFilter;
			const matchesChecksum =
				checksumFilter === 'all' ||
				(checksumFilter === 'ok' ? reading.checksum_ok === true : reading.checksum_ok === false);
			return matchesDevice && matchesChecksum;
		})
	);
</script>

<svelte:head><title>Readings · Admin · LYE Aqua Flow</title></svelte:head>

<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Stored readings</h1>
	<p class="mt-1 text-sm text-ink-500">
		Browse the most recent 500 persisted device readings. Live streaming remains unchanged.
	</p>
</div>

{#if data.loadError}
	<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{data.loadError}
	</div>
{/if}

<div class="mt-6 flex flex-wrap items-center gap-3">
	<select
		bind:value={deviceFilter}
		class="rounded-xl border-ink-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-brand-400 focus:ring-brand-400"
	>
		<option value="all">All devices</option>
		{#each data.devices as device (device.id)}
			<option value={device.id}
				>{device.serial_number} · {device.household?.name || 'Unknown'}</option
			>
		{/each}
	</select>
	<div class="inline-flex rounded-xl bg-ink-100 p-1 text-sm font-medium">
		{#each [{ v: 'all', l: 'All' }, { v: 'ok', l: 'Checksum OK' }, { v: 'fail', l: 'Failed' }] as filter (filter.v)}
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 transition-colors {checksumFilter === filter.v
					? 'bg-white text-ink-900 shadow-sm'
					: 'text-ink-500 hover:text-ink-800'}"
				onclick={() => (checksumFilter = /** @type {'all'|'ok'|'fail'} */ (filter.v))}
			>
				{filter.l}
			</button>
		{/each}
	</div>
</div>

<div
	class="mt-4 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<div class="scroll-thin overflow-x-auto">
		<table class="w-full min-w-[1050px] text-left text-sm">
			<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
				<tr>
					<th class="px-5 py-3 font-medium">Reading time</th>
					<th class="px-5 py-3 font-medium">Device</th>
					<th class="px-5 py-3 font-medium">Household</th>
					<th class="px-5 py-3 text-right font-medium">Cumulative L</th>
					<th class="px-5 py-3 text-right font-medium">Interval L</th>
					<th class="px-5 py-3 text-right font-medium">Flow L/min</th>
					<th class="px-5 py-3 text-right font-medium">Credit L</th>
					<th class="px-5 py-3 text-right font-medium">Battery</th>
					<th class="px-5 py-3 text-right font-medium">RSSI</th>
					<th class="px-5 py-3 text-right font-medium">Frame</th>
					<th class="px-5 py-3 text-center font-medium">CRC</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-ink-100">
				{#each filtered as reading (reading.id)}
					<tr class="transition-colors hover:bg-ink-50">
						<td class="whitespace-nowrap px-5 py-3 text-ink-600">
							{shortTime(reading.reading_time)}
						</td>
						<td class="px-5 py-3">
							<p class="font-mono text-xs text-ink-700">
								{reading.device?.serial_number || reading.device_id}
							</p>
							<p class="font-mono text-xs text-ink-400">
								{reading.device?.ttn_device_id || 'No TTN ID'}
							</p>
						</td>
						<td class="px-5 py-3 text-ink-600">
							{reading.device?.household?.name || 'Unknown'}
						</td>
						<td class="px-5 py-3 text-right font-mono text-ink-700">
							{reading.cumulative_litres}
						</td>
						<td class="px-5 py-3 text-right font-mono text-ink-600">
							{reading.interval_litres ?? '—'}
						</td>
						<td class="px-5 py-3 text-right font-mono text-ink-600">
							{reading.instant_flow_lpm ?? '—'}
						</td>
						<td class="px-5 py-3 text-right font-mono text-ink-600">
							{reading.remaining_credit_litres ?? '—'}
						</td>
						<td class="px-5 py-3 text-right text-ink-600">
							{reading.battery_percent !== null ? `${reading.battery_percent}%` : '—'}
						</td>
						<td class="px-5 py-3 text-right font-mono text-ink-500">{reading.rssi ?? '—'}</td>
						<td class="px-5 py-3 text-right font-mono text-ink-400">
							{reading.frame_counter !== null ? `#${reading.frame_counter}` : '—'}
						</td>
						<td class="px-5 py-3 text-center">
							{#if reading.checksum_ok === true}
								<Icon name="check" size={16} class="mx-auto text-emerald-600" />
							{:else if reading.checksum_ok === false}
								<Icon name="alert" size={16} class="mx-auto text-rose-600" />
							{:else}
								<span class="text-ink-300">—</span>
							{/if}
						</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr>
						<td colspan="11" class="px-5 py-10 text-center text-sm text-ink-400">
							No stored readings match these filters.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
