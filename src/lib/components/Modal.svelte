<script>
	import Icon from './Icon.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {boolean} open
	 * @property {string} title
	 * @property {string} [subtitle]
	 * @property {import('svelte').Snippet} children
	 * @property {import('svelte').Snippet} [footer]
	 */

	/** @type {Props} */
	let { open = $bindable(), title, subtitle = '', children, footer } = $props();

	function close() {
		open = false;
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
		<button class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" aria-label="Close" onclick={close}
		></button>
		<div
			class="animate-rise relative w-full max-w-lg rounded-t-2xl bg-white shadow-[var(--shadow-lift)] sm:rounded-2xl"
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<header class="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
				<div>
					<h2 class="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
					{#if subtitle}
						<p class="mt-0.5 text-sm text-ink-500">{subtitle}</p>
					{/if}
				</div>
				<button
					class="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-600"
					aria-label="Close dialog"
					onclick={close}
				>
					<Icon name="close" size={18} />
				</button>
			</header>

			<div class="px-6 py-5">
				{@render children()}
			</div>

			{#if footer}
				<footer class="flex justify-end gap-3 border-t border-ink-100 px-6 py-4">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
