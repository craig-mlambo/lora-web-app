<script>
	/**
	 * Compact bar chart for throughput-style series. Pure SVG.
	 * @typedef {Object} Props
	 * @property {number[]} data
	 * @property {number} [height]
	 * @property {string} [unit]
	 */

	/** @type {Props} */
	let { data, height = 120, unit = '' } = $props();

	const W = 720;
	const gap = 4;
	const max = $derived(Math.max(...data) * 1.1 || 1);
	const barW = $derived((W - gap * (data.length - 1)) / data.length);
	/** @param {number} v */
	const h = (v) => (v / max) * (height - 6);
</script>

<svg viewBox="0 0 {W} {height}" class="h-auto w-full" role="img" aria-label="Throughput chart">
	<defs>
		<linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--color-brand-400)" />
			<stop offset="100%" stop-color="var(--color-brand-600)" />
		</linearGradient>
	</defs>
	{#each data as v, i (i)}
		<rect
			x={i * (barW + gap)}
			y={height - h(v)}
			width={barW}
			height={h(v)}
			rx="3"
			fill="url(#barFill)"
			opacity={i === data.length - 1 ? '1' : '0.85'}
		>
			<title>{v.toLocaleString('en')}{unit ? ' ' + unit : ''}</title>
		</rect>
	{/each}
</svg>
