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
		<button
			class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
			aria-label="Close"
			onclick={close}
		></button>
		<div
			class="animate-rise relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-[var(--shadow-lift)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<header
				class="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-4 py-4 sm:px-6"
			>
				<div class="min-w-0">
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

			<div class="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
				{@render children()}
			</div>

			{#if footer}
				<footer
					class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-100 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-6 sm:py-4"
				>
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
