<script>
	import { onMount } from 'svelte';
	import { SvelteSet, SvelteURLSearchParams } from 'svelte/reactivity';
	import Icon from '$lib/components/Icon.svelte';
	import { shortTime, timeAgo } from '$lib/utils/format.js';

	const windows = [
		{ v: '3h', l: 'Last 3 hours' },
		{ v: '6h', l: 'Last 6 hours' },
		{ v: '12h', l: 'Last 12 hours' },
		{ v: '24h', l: 'Last 24 hours' },
		{ v: '48h', l: 'Last 2 days' },
		{ v: '168h', l: 'Last 7 days' },
		{ v: '720h', l: 'Last 30 days' },
		{ v: '2160h', l: 'Last 90 days' }
	];
	const skeletonRows = [0, 1, 2, 3];

	let last = $state('24h');
	let deviceId = $state('');
	let decode = $state(true);
	let autoRefresh = $state(false);

	let loading = $state(false);
	/** @type {string | null} */
	let error = $state(null);
	/** @type {string | null} */
	let errorDetail = $state(null);
	/** @type {any[]} */
	let uplinks = $state([]);
	/** @type {string | null} */
	let source = $state(null);
	/** @type {Date | null} */
	let fetchedAt = $state(null);
	const expanded = new SvelteSet();
	let requestSequence = 0;

	/**
	 * Flatten a raw TTN uplink into the fields we display.
	 * @param {any} u
	 */
	function row(u) {
		const m = u.uplink_message ?? {};
		const rx = m.rx_metadata?.[0] ?? {};
		const d = u.decoded ?? null;
		return {
			deviceId: u.end_device_ids?.device_id ?? '—',
			devEui: u.end_device_ids?.dev_eui ?? '',
			receivedAt: u.received_at ?? m.received_at ?? null,
			fcnt: m.f_cnt ?? null,
			rssi: rx.rssi ?? null,
			snr: rx.snr ?? null,
			gateway: rx.gateway_ids?.gateway_id ?? '',
			serial: d?.serial ?? null,
			meterTime: d?.meter_time ?? null,
			cumulative: d?.cumulative_flow ?? null,
			instant: d?.instant_flow ?? null,
			reverse: d?.reverse_flow ?? null,
			status: d?.status ?? null,
			checksumOk: d?.checksum_ok ?? null,
			decodeError: u.decode_error ?? null
		};
	}

	const rows = $derived(uplinks.map(row));
	const selectedWindowLabel = $derived(windows.find((window) => window.v === last)?.l ?? last);

	const summary = $derived({
		count: rows.length,
		devices: new Set(rows.map((r) => r.deviceId)).size,
		okRate: rows.length
			? Math.round((rows.filter((r) => r.checksumOk).length / rows.length) * 100)
			: 0,
		latest:
			rows
				.map((r) => r.receivedAt)
				.filter(Boolean)
				.sort()
				.at(-1) ?? null
	});

	/** @param {string} [requestedWindow] */
	async function refresh(requestedWindow = last) {
		const requestId = ++requestSequence;
		loading = true;
		error = null;
		errorDetail = null;
		try {
			const qs = new SvelteURLSearchParams({
				last: requestedWindow,
				decode: String(decode)
			});
			if (deviceId.trim()) qs.set('deviceId', deviceId.trim());
			const res = await fetch(`/api/live/uplinks?${qs.toString()}`);
			const body = await res.json();
			if (requestId !== requestSequence) return;
			if (!res.ok) {
				error = body.error ?? `Request failed (${res.status})`;
				errorDetail = body.detail ?? null;
				source = body.source ?? null;
				uplinks = [];
			} else {
				uplinks = body.uplinks ?? [];
				source = body.source ?? null;
				expanded.clear();
			}
			fetchedAt = new Date();
		} catch (e) {
			if (requestId !== requestSequence) return;
			error = 'Network error calling the proxy';
			errorDetail = e instanceof Error ? e.message : String(e);
			uplinks = [];
		} finally {
			if (requestId === requestSequence) loading = false;
		}
	}

	/** @param {string} value */
	function changeWindow(value) {
		last = value;
		refresh(value);
	}

	/** @param {number} i */
	function toggle(i) {
		if (expanded.has(i)) expanded.delete(i);
		else expanded.add(i);
	}

	// initial load (once; controls call refresh() explicitly)
	onMount(refresh);

	// auto-refresh every 30s
	$effect(() => {
		if (!autoRefresh) return;
		const id = setInterval(refresh, 30_000);
		return () => clearInterval(id);
	});
</script>

<svelte:head><title>Live data · Admin · LYE Aqua Flow</title></svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Live data</h1>
		<p class="mt-1 text-sm text-ink-500">
			Decoded CJ/T 188 uplinks straight from the LYE ingestion API.
		</p>
	</div>
	<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
		<label
			class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700"
		>
			<input
				type="checkbox"
				bind:checked={autoRefresh}
				class="rounded border-ink-300 text-brand-600 focus:ring-brand-400"
			/>
			Auto-refresh
		</label>
		<button
			onclick={() => refresh()}
			disabled={loading}
			class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
		>
			<Icon name="refresh" size={16} class={loading ? 'animate-spin' : ''} />
			Refresh
		</button>
	</div>
</div>

<!-- Controls -->
<div class="mt-6 rounded-2xl border border-ink-200/70 bg-white p-4 shadow-[var(--shadow-card)]">
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<label for="live-window" class="text-xs font-medium uppercase tracking-wide text-ink-400">
				Window
			</label>
			<select
				id="live-window"
				value={last}
				onchange={(event) => changeWindow(event.currentTarget.value)}
				disabled={loading}
				class="rounded-xl border-ink-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-ink-700 focus:border-brand-400 focus:ring-brand-400 disabled:opacity-60"
			>
				{#each windows as window (window.v)}
					<option value={window.v}>{window.l}</option>
				{/each}
			</select>
		</div>

		<label class="relative w-full min-w-0 sm:min-w-[220px] sm:flex-1">
			<span
				class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400"
			>
				<Icon name="search" size={17} />
			</span>
			<input
				type="text"
				bind:value={deviceId}
				onkeydown={(e) => e.key === 'Enter' && refresh()}
				placeholder="Filter by TTN device ID (optional)"
				class="w-full rounded-xl border-ink-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</label>

		<label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
			<input
				type="checkbox"
				bind:checked={decode}
				onchange={() => refresh()}
				class="rounded border-ink-300 text-brand-600 focus:ring-brand-400"
			/>
			Decode payload
		</label>
	</div>

	<!-- status line -->
	<div
		class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-xs text-ink-400"
	>
		{#if source}
			<span class="inline-flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full {error ? 'bg-rose-500' : 'bg-emerald-500'}"></span>
				<span class="font-mono">{source}</span>
			</span>
		{/if}
		{#if fetchedAt}
			<span>Updated {fetchedAt.toLocaleTimeString('en')}</span>
		{/if}
		{#if autoRefresh}
			<span class="inline-flex items-center gap-1 text-brand-600"
				><Icon name="activity" size={13} /> auto-refreshing every 30s</span
			>
		{/if}
	</div>
</div>

{#if error}
	<!-- Error state -->
	<div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-6">
		<div class="flex items-start gap-3">
			<span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600"
				><Icon name="alert" size={20} /></span
			>
			<div class="min-w-0">
				<p class="font-semibold text-ink-900">{error}</p>
				{#if errorDetail}
					<p class="mt-1 break-words text-sm text-ink-500">{errorDetail}</p>
				{/if}
				<p class="mt-3 text-sm text-ink-600">
					Make sure the <span class="font-medium">lora-api-server</span> is running and reachable:
				</p>
				<pre
					class="scroll-thin mt-2 overflow-x-auto rounded-lg bg-ink-900 px-3 py-2 text-xs text-ink-100"><code
						>cd C:\Svelte\lora-api-server
npm run dev   # serves https://lora-api-server.vercel.app</code
					></pre>
				<p class="mt-2 text-xs text-ink-400">
					Override the target with the <span class="font-mono">LORA_API_URL</span> environment variable.
				</p>
			</div>
		</div>
	</div>
{:else}
	<!-- Summary tiles -->
	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		{#each [{ label: 'Uplinks', value: String(summary.count), icon: 'zap', accent: 'bg-brand-50 text-brand-600' }, { label: 'Devices', value: String(summary.devices), icon: 'gauge', accent: 'bg-emerald-50 text-emerald-600' }, { label: 'Checksum OK', value: summary.okRate + '%', icon: 'check', accent: 'bg-emerald-50 text-emerald-600' }, { label: 'Latest uplink', value: summary.latest ? timeAgo(summary.latest, new Date()) : '—', icon: 'clock', accent: 'bg-amber-50 text-amber-600' }] as tile (tile.label)}
			<div class="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
				<span class="grid h-10 w-10 place-items-center rounded-xl {tile.accent}"
					><Icon name={tile.icon} size={20} /></span
				>
				<p class="mt-4 text-2xl font-semibold tracking-tight text-ink-900">{tile.value}</p>
				<p class="mt-1 text-sm text-ink-500">{tile.label}</p>
			</div>
		{/each}
	</div>

	<!-- Table -->
	<div
		class="mt-6 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
	>
		<div class="flex items-center justify-between px-6 py-4">
			<h2 class="font-semibold text-ink-900">
				Uplinks <span class="text-ink-400">({summary.count})</span>
			</h2>
			<span class="text-sm text-ink-400">
				{selectedWindowLabel}{deviceId.trim() ? ` · ${deviceId.trim()}` : ''}
			</span>
		</div>

		{#if loading && rows.length === 0}
			<div class="space-y-2 px-6 pb-6">
				{#each skeletonRows as i (i)}
					<div class="h-12 animate-pulse rounded-lg bg-ink-100"></div>
				{/each}
			</div>
		{:else if rows.length === 0}
			<div class="px-6 py-16 text-center">
				<Icon name="activity" size={26} class="mx-auto mb-3 text-ink-300" />
				<p class="text-sm font-medium text-ink-700">No uplinks in this window</p>
				<p class="mt-1 text-sm text-ink-400">
					Try a longer time window or clear the device filter.
				</p>
			</div>
		{:else}
			<div class="scroll-thin overflow-x-auto border-t border-ink-100">
				<table class="w-full min-w-[900px] text-left text-sm">
					<thead class="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
						<tr>
							<th class="px-5 py-3 font-medium">Device</th>
							<th class="px-5 py-3 font-medium">Meter time</th>
							<th class="px-5 py-3 text-right font-medium">Cumulative</th>
							<th class="px-5 py-3 text-right font-medium">Instant</th>
							<th class="px-5 py-3 text-right font-medium">Frame</th>
							<th class="px-5 py-3 text-right font-medium">RSSI / SNR</th>
							<th class="px-5 py-3 text-center font-medium">CRC</th>
							<th class="px-5 py-3"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-100">
						{#each rows as r, i (i)}
							<tr class="transition-colors hover:bg-ink-50">
								<td class="px-5 py-3">
									<p class="font-mono text-xs font-medium text-ink-900">{r.deviceId}</p>
									<p class="font-mono text-xs text-ink-400">
										{r.serial ? 'SN ' + r.serial : r.devEui}
									</p>
								</td>
								<td class="whitespace-nowrap px-5 py-3 text-ink-600">
									{r.meterTime
										? shortTime(r.meterTime)
										: r.receivedAt
											? shortTime(r.receivedAt)
											: '—'}
								</td>
								<td class="whitespace-nowrap px-5 py-3 text-right font-mono text-ink-700">
									{r.cumulative ? `${r.cumulative.value} ${r.cumulative.unit}` : '—'}
								</td>
								<td class="whitespace-nowrap px-5 py-3 text-right font-mono text-ink-700">
									{r.instant ? r.instant.value : '—'}
								</td>
								<td class="px-5 py-3 text-right font-mono text-ink-400">{r.fcnt ?? '—'}</td>
								<td class="whitespace-nowrap px-5 py-3 text-right font-mono text-ink-500">
									{r.rssi ?? '—'}{r.snr != null ? ` / ${r.snr}` : ''}
								</td>
								<td class="px-5 py-3 text-center">
									{#if r.decodeError}
										<span title={r.decodeError}
											><Icon name="alert" size={16} class="mx-auto text-amber-500" /></span
										>
									{:else if r.checksumOk}
										<Icon name="check" size={16} class="mx-auto text-emerald-600" />
									{:else if r.checksumOk === false}
										<Icon name="alert" size={16} class="mx-auto text-rose-600" />
									{:else}
										<span class="text-ink-300">—</span>
									{/if}
								</td>
								<td class="px-5 py-3 text-right">
									<button
										onclick={() => toggle(i)}
										class="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
										aria-label="Toggle raw JSON"
									>
										<Icon name="chevron" size={16} class={expanded.has(i) ? 'rotate-90' : ''} />
									</button>
								</td>
							</tr>
							{#if expanded.has(i)}
								<tr class="bg-ink-50/60">
									<td colspan="8" class="px-5 py-3">
										<pre
											class="scroll-thin max-h-72 overflow-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-100"><code
												>{JSON.stringify(uplinks[i], null, 2)}</code
											></pre>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}
