<script>
	/**
	 * @typedef {Object} Props
	 * @property {'light'|'dark'} [tone]  Text colour for light or dark backgrounds
	 * @property {boolean} [wordmark]
	 */

	/** @type {Props} */
	let { tone = 'dark', wordmark = true } = $props();
</script>

<span class="inline-flex items-center gap-2.5">
	<span
		class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-sm ring-1 ring-white/20"
	>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"
				fill="white"
				fill-opacity="0.95"
			/>
			<path d="M9.5 13a2.5 2.5 0 0 0 2.5 2.5" stroke="var(--color-brand-700)" stroke-width="1.6" stroke-linecap="round" />
		</svg>
	</span>
	{#if wordmark}
		<span class="text-lg font-semibold tracking-tight {tone === 'light' ? 'text-white' : 'text-ink-900'}">
			LYE <span class="font-normal text-brand-500">Aqua Flow</span>
		</span>
	{/if}
</span>
