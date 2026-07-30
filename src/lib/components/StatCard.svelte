<script>
	import Icon from './Icon.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} label
	 * @property {string} value
	 * @property {string} [icon]
	 * @property {string} [hint]
	 * @property {number} [trend]     Percentage change; sign drives colour
	 * @property {'brand'|'emerald'|'amber'|'rose'} [accent]
	 */

	/** @type {Props} */
	let { label, value, icon = 'gauge', hint = '', trend, accent = 'brand' } = $props();

	const accents = {
		brand: 'bg-brand-50 text-brand-600',
		emerald: 'bg-emerald-50 text-emerald-600',
		amber: 'bg-amber-50 text-amber-600',
		rose: 'bg-rose-50 text-rose-600'
	};
</script>

<div
	class="animate-rise rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]"
>
	<div class="flex items-start justify-between">
		<div class="grid h-10 w-10 place-items-center rounded-xl {accents[accent]}">
			<Icon name={icon} size={20} />
		</div>
		{#if trend !== undefined}
			<span
				class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {trend >= 0
					? 'bg-emerald-50 text-emerald-700'
					: 'bg-rose-50 text-rose-700'}"
			>
				{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
			</span>
		{/if}
	</div>
	<p class="mt-4 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
	<p class="mt-1 text-sm text-ink-500">{label}</p>
	{#if hint}
		<p class="mt-2 text-xs text-ink-400">{hint}</p>
	{/if}
</div>
