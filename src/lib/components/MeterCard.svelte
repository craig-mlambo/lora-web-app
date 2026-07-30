<script>
	import Icon from './Icon.svelte';
	import { m3, timeAgo } from '$lib/utils/format.js';

	/**
	 * @typedef {import('$lib/data/mock.js').Meter} Meter
	 * @typedef {Object} Props
	 * @property {Meter} meter
	 */

	/** @type {Props} */
	let { meter } = $props();

	const statusStyles = {
		pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
		active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		inactive: 'bg-ink-100 text-ink-500 ring-ink-500/20',
		faulty: 'bg-rose-50 text-rose-700 ring-rose-600/20',
		retired: 'bg-ink-100 text-ink-500 ring-ink-500/20'
	};

	/** @param {number} pct */
	const barTone = (pct) =>
		pct >= 60 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-500' : 'bg-rose-500';

	// sparkline geometry
	const sparkW = 120;
	const sparkH = 32;
	const sparkMax = $derived(Math.max(...meter.spark, 0.001));
	const sparkValues = $derived(
		meter.spark.length > 1 ? meter.spark : [meter.spark[0] ?? 0, meter.spark[0] ?? 0]
	);
	const sparkPath = $derived(
		sparkValues
			.map((v, i) => {
				const x = (i / (sparkValues.length - 1)) * sparkW;
				const y = sparkH - (v / sparkMax) * (sparkH - 4) - 2;
				return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ')
	);
</script>

<article
	class="animate-rise group flex flex-col rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]"
>
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h3 class="truncate font-semibold text-ink-900">{meter.household}</h3>
			<p class="mt-0.5 truncate font-mono text-xs text-ink-400">SN {meter.serial}</p>
		</div>
		<span
			class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset {statusStyles[
				meter.status
			]}"
		>
			{meter.status}
		</span>
	</header>

	<div class="mt-5 flex items-end justify-between">
		<div>
			<p class="text-xs font-medium uppercase tracking-wide text-ink-400">Cumulative</p>
			<p class="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{m3(meter.cumulative)}</p>
			<p class="mt-1 text-sm text-ink-500">
				<span class="font-medium text-brand-600">+{meter.todayUsage.toFixed(3)} m³</span> today
			</p>
		</div>
		<svg
			viewBox="0 0 {sparkW} {sparkH}"
			width={sparkW}
			height={sparkH}
			class="text-brand-400"
			aria-hidden="true"
		>
			<path
				d={sparkPath}
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</div>

	<div class="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-4">
		<div>
			<div class="flex items-center gap-1.5 text-xs text-ink-500">
				<Icon name="battery" size={15} /> Battery
			</div>
			<div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
				<div
					class="h-full rounded-full {barTone(meter.battery)}"
					style="width: {meter.battery}%"
				></div>
			</div>
			<p class="mt-1 text-xs font-medium text-ink-600">{meter.battery}%</p>
		</div>
		<div>
			<div class="flex items-center gap-1.5 text-xs text-ink-500">
				<Icon name="signal" size={15} /> Signal
			</div>
			<div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
				<div
					class="h-full rounded-full {barTone(meter.signal)}"
					style="width: {meter.signal}%"
				></div>
			</div>
			<p class="mt-1 text-xs font-medium text-ink-600">{meter.signal}%</p>
		</div>
	</div>

	<footer class="mt-4 flex items-center justify-between text-xs">
		<span class="inline-flex items-center gap-1.5 text-ink-400">
			<Icon name="clock" size={14} />
			{timeAgo(meter.lastSeen)}
		</span>
		{#if meter.checksumOk}
			<span class="inline-flex items-center gap-1 font-medium text-emerald-600">
				<Icon name="check" size={14} /> Checksum OK
			</span>
		{:else}
			<span class="inline-flex items-center gap-1 font-medium text-rose-600">
				<Icon name="alert" size={14} /> Checksum fail
			</span>
		{/if}
	</footer>
</article>
