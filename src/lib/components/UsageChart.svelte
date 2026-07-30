<script>
	/**
	 * Area + line chart for daily consumption. Pure SVG, no dependencies.
	 * @typedef {Object} Props
	 * @property {{day:string, consumption:number}[]} data
	 */

	/** @type {Props} */
	let { data } = $props();

	// viewBox geometry (scales to container width via CSS)
	const W = 720;
	const H = 260;
	const pad = { top: 16, right: 16, bottom: 28, left: 36 };
	const innerW = W - pad.left - pad.right;
	const innerH = H - pad.top - pad.bottom;

	const values = $derived(data.map((d) => d.consumption));
	const max = $derived(Math.max(1, ...values) * 1.15);
	const min = 0;

	/** @param {number} i */
	const x = (i) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
	/** @param {number} v */
	const y = (v) => pad.top + innerH - ((v - min) / (max - min)) * innerH;

	const linePath = $derived(
		data
			.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.consumption).toFixed(1)}`)
			.join(' ')
	);
	const areaPath = $derived(
		`${linePath} L ${x(data.length - 1).toFixed(1)} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`
	);

	// 4 horizontal gridlines
	const gridlines = $derived(
		Array.from({ length: 4 }, (_, i) => {
			const v = (max / 3) * (3 - i);
			return { v, y: y(v) };
		})
	);

	// sparse x labels (~6)
	const step = $derived(Math.max(1, Math.round(data.length / 6)));
</script>

<figure class="w-full">
	<svg
		viewBox="0 0 {W} {H}"
		class="h-auto w-full"
		role="img"
		aria-label="Daily water consumption chart"
	>
		<defs>
			<linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--color-brand-400)" stop-opacity="0.35" />
				<stop offset="100%" stop-color="var(--color-brand-400)" stop-opacity="0" />
			</linearGradient>
		</defs>

		<!-- gridlines + y labels -->
		{#each gridlines as g (g.v)}
			<line
				x1={pad.left}
				x2={W - pad.right}
				y1={g.y}
				y2={g.y}
				stroke="var(--color-ink-200)"
				stroke-width="1"
			/>
			<text x={pad.left - 8} y={g.y + 3} text-anchor="end" class="fill-ink-400 text-[10px]">
				{g.v.toFixed(1)}
			</text>
		{/each}

		<!-- area + line -->
		<path d={areaPath} fill="url(#usageFill)" />
		<path
			d={linePath}
			fill="none"
			stroke="var(--color-brand-500)"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>

		<!-- points + hover targets -->
		{#each data as d, i (d.day)}
			<circle cx={x(i)} cy={y(d.consumption)} r="2.5" fill="var(--color-brand-600)" />
			<rect
				x={x(i) - innerW / data.length / 2}
				y={pad.top}
				width={innerW / data.length}
				height={innerH}
				fill="transparent"
			>
				<title>{d.day}: {d.consumption.toFixed(3)} m³</title>
			</rect>
		{/each}

		<!-- x labels -->
		{#each data as d, i (d.day)}
			{#if i % step === 0}
				<text x={x(i)} y={H - 8} text-anchor="middle" class="fill-ink-400 text-[10px]">
					{new Date(d.day).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
				</text>
			{/if}
		{/each}
	</svg>
</figure>
