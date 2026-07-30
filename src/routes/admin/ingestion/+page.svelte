<script>
	import Icon from '$lib/components/Icon.svelte';
	import MiniBars from '$lib/components/MiniBars.svelte';
	import { shortTime, timeAgo } from '$lib/utils/format.js';
	import {
		ingestion,
		uplinksPerHour,
		unknownDevices as seedUnknown,
		staleMeters
	} from '$lib/data/mockAdmin.js';

	let unknown = $state(seedUnknown.map((d) => ({ ...d })));
	/** @type {string|null} */
	let registering = $state(null);

	/** @param {string} ttnDeviceId */
	async function register(ttnDeviceId) {
		registering = ttnDeviceId;
		await new Promise((r) => setTimeout(r, 700));
		unknown = unknown.filter((d) => d.ttnDeviceId !== ttnDeviceId);
		registering = null;
	}
</script>

<svelte:head><title>Ingestion · Admin · LYE Aqua Flow</title></svelte:head>

<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Ingestion</h1>
	<p class="mt-1 text-sm text-ink-500">
		Live webhook health, throughput, and devices needing attention.
	</p>
</div>

<!-- Status cards -->
<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<div class="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
		<div class="flex items-center justify-between">
			<span class="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"
				><Icon name="webhook" size={20} /></span
			>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
			>
				<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span> Live
			</span>
		</div>
		<p class="mt-4 font-semibold text-ink-900">Webhook receiver</p>
		<p class="mt-1 text-xs text-ink-400">POST /api/ingest · token configured</p>
		<p class="mt-2 text-xs text-ink-500">
			Last event {timeAgo(ingestion.lastEvent, new Date('2026-07-15T08:30:00'))}
		</p>
	</div>

	<div class="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
		<span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"
			><Icon name="zap" size={20} /></span
		>
		<p class="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
			{ingestion.uplinks24h.toLocaleString('en')}
		</p>
		<p class="mt-1 text-sm text-ink-500">Uplinks (24h)</p>
		<p class="mt-2 text-xs text-ink-400">Avg latency {ingestion.avgLatencyMs} ms</p>
	</div>

	<div class="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
		<span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"
			><Icon name="alert" size={20} /></span
		>
		<p class="mt-4 text-2xl font-semibold tracking-tight text-ink-900">{unknown.length}</p>
		<p class="mt-1 text-sm text-ink-500">Unknown devices</p>
		<p class="mt-2 text-xs text-ink-400">Sending, not registered</p>
	</div>

	<div class="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
		<span class="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600"
			><Icon name="gauge" size={20} /></span
		>
		<p class="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
			{ingestion.checksumFailRate}%
		</p>
		<p class="mt-1 text-sm text-ink-500">Checksum fail rate</p>
		<p class="mt-2 text-xs text-ink-400">
			{staleMeters.length} stale meter{staleMeters.length === 1 ? '' : 's'}
		</p>
	</div>
</div>

<!-- Throughput -->
<div class="mt-6 rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="font-semibold text-ink-900">Uplinks per hour</h2>
			<p class="text-sm text-ink-500">Last 24 hours · updated {shortTime(ingestion.lastEvent)}</p>
		</div>
	</div>
	<div class="mt-5"><MiniBars data={uplinksPerHour} height={140} unit="uplinks/h" /></div>
</div>

<!-- Unknown + stale -->
<div class="mt-6 grid gap-6 lg:grid-cols-3">
	<div
		class="rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)] lg:col-span-2"
	>
		<div class="flex items-center justify-between px-6 py-4">
			<div>
				<h2 class="font-semibold text-ink-900">Unknown devices</h2>
				<p class="text-sm text-ink-500">Uplinks received from unregistered meters</p>
			</div>
		</div>
		<div class="scroll-thin overflow-x-auto border-t border-ink-100">
			<table class="w-full min-w-[560px] text-left text-sm">
				<thead class="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
					<tr>
						<th class="px-6 py-3 font-medium">Device</th>
						<th class="px-6 py-3 text-right font-medium">Uplinks</th>
						<th class="px-6 py-3 font-medium">Last seen</th>
						<th class="px-6 py-3 text-right font-medium">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-ink-100">
					{#each unknown as d (d.ttnDeviceId)}
						<tr class="transition-colors hover:bg-ink-50">
							<td class="px-6 py-3">
								<p class="font-mono text-xs font-medium text-ink-900">{d.ttnDeviceId}</p>
								<p class="font-mono text-xs text-ink-400">{d.devEui}</p>
							</td>
							<td class="px-6 py-3 text-right font-medium text-ink-700">{d.uplinks}</td>
							<td class="px-6 py-3 text-ink-500"
								>{timeAgo(d.lastSeen, new Date('2026-07-15T08:30:00'))}</td
							>
							<td class="px-6 py-3">
								<div class="flex justify-end">
									<button
										onclick={() => register(d.ttnDeviceId)}
										disabled={registering === d.ttnDeviceId}
										class="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
									>
										{#if registering === d.ttnDeviceId}
											<span
												class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600"
											></span>
										{:else}
											<Icon name="plus" size={14} />
										{/if}
										Register
									</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if unknown.length === 0}
						<tr
							><td colspan="4" class="px-6 py-10 text-center text-sm text-ink-400">
								<Icon name="check" size={22} class="mx-auto mb-2 text-emerald-500" />
								All devices registered.
							</td></tr
						>
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	<div class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
		<h2 class="font-semibold text-ink-900">Stale meters</h2>
		<p class="text-sm text-ink-500">No uplink in over 48 hours</p>
		<ul class="mt-4 space-y-3">
			{#each staleMeters as m (m.serial)}
				<li class="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
					<div class="flex items-center gap-2">
						<Icon name="alert" size={16} class="text-rose-600" />
						<p class="text-sm font-medium text-ink-900">{m.household}</p>
					</div>
					<p class="mt-1 font-mono text-xs text-ink-500">SN {m.serial}</p>
					<p class="mt-1 text-xs text-rose-600">
						Silent for {m.gapHours}h · last {shortTime(m.lastSeen)}
					</p>
				</li>
			{/each}
			{#if staleMeters.length === 0}
				<li class="py-6 text-center text-sm text-ink-400">All meters reporting.</li>
			{/if}
		</ul>
	</div>
</div>
