<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data, form } = $props();
	let createOpen = $state(false);
	let editOpen = $state(false);
	/** @type {any} */
	let editing = $state(null);

	/** @type {Record<string,string>} */
	const statusStyles = {
		active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
		suspended: 'bg-rose-50 text-rose-700 ring-rose-600/20',
		closed: 'bg-ink-100 text-ink-500 ring-ink-500/20'
	};
</script>

<svelte:head><title>Prepaid accounts · Admin · LYE Aqua Flow</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Prepaid accounts</h1>
		<p class="mt-1 text-sm text-ink-500">
			Manage each household's currency, threshold, and account lifecycle.
		</p>
	</div>
	<button
		type="button"
		onclick={() => (createOpen = true)}
		disabled={data.households.length === 0}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
	>
		<Icon name="plus" size={17} /> New account
	</button>
</div>

{#if form?.message || data.loadError}
	<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{form?.message ?? data.loadError}
	</div>
{:else if form?.created || form?.updated || form?.deleted}
	<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
	>
		Prepaid account changes saved.
	</div>
{/if}

<div
	class="mt-6 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<table class="w-full min-w-[700px] text-left text-sm">
		<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
			<tr>
				<th class="px-6 py-3 font-medium">Household</th>
				<th class="px-6 py-3 font-medium">Currency</th>
				<th class="px-6 py-3 font-medium">Low-balance threshold</th>
				<th class="px-6 py-3 font-medium">Opened</th>
				<th class="px-6 py-3 font-medium">Status</th>
				<th class="px-6 py-3 text-right font-medium">Actions</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-ink-100">
			{#each data.accounts as account (account.id)}
				<tr>
					<td class="px-6 py-3">
						<p class="font-medium text-ink-900">{account.household?.name || 'Missing household'}</p>
						<p class="font-mono text-xs text-ink-400">
							{account.household?.account_number || account.household_id}
						</p>
					</td>
					<td class="px-6 py-3 font-semibold text-ink-700">{account.currency}</td>
					<td class="px-6 py-3 text-ink-600">{account.low_balance_threshold_litres} L</td>
					<td class="px-6 py-3 text-ink-500">{shortTime(account.opened_at)}</td>
					<td class="px-6 py-3">
						<span
							class="rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset {statusStyles[
								account.status
							] ?? statusStyles.closed}"
						>
							{account.status}
						</span>
					</td>
					<td class="px-6 py-3 text-right">
						<button
							type="button"
							onclick={() => {
								editing = account;
								editOpen = true;
							}}
							class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
							aria-label="Edit prepaid account"
						>
							<Icon name="edit" size={16} />
						</button>
					</td>
				</tr>
			{/each}
			{#if data.accounts.length === 0}
				<tr>
					<td colspan="6" class="px-6 py-10 text-center text-ink-400">
						No prepaid accounts found.
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<Modal bind:open={createOpen} title="New prepaid account">
	<form id="create-account-form" method="POST" action="?/create" class="space-y-4">
		<select
			name="household_id"
			required
			aria-label="Household"
			class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
		>
			<option value="">Select household</option>
			{#each data.households as household (household.id)}
				<option value={household.id}>{household.name} · {household.account_number}</option>
			{/each}
		</select>
		<div class="grid gap-4 sm:grid-cols-2">
			<input
				name="currency"
				value="USD"
				maxlength="3"
				required
				aria-label="Currency"
				class="rounded-xl border-ink-200 px-3 py-2.5 uppercase focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="low_balance_threshold_litres"
				type="number"
				min="0"
				step="0.001"
				value="100"
				required
				aria-label="Low-balance threshold in litres"
				class="rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
	</form>
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (createOpen = false)}
			class="rounded-xl px-4 py-2 text-sm text-ink-600 hover:bg-ink-100"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="create-account-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Create account
		</button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Edit prepaid account">
	{#if editing}
		<form id="edit-account-form" method="POST" action="?/update" class="space-y-4">
			<input type="hidden" name="account_id" value={editing.id} />
			<div class="grid gap-4 sm:grid-cols-2">
				<input
					name="currency"
					value={editing.currency}
					maxlength="3"
					required
					aria-label="Currency"
					class="rounded-xl border-ink-200 px-3 py-2.5 uppercase focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="low_balance_threshold_litres"
					type="number"
					min="0"
					step="0.001"
					value={editing.low_balance_threshold_litres}
					required
					aria-label="Low-balance threshold in litres"
					class="rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
			<select
				name="status"
				value={editing.status}
				aria-label="Account status"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="pending">Pending</option>
				<option value="active">Active</option>
				<option value="suspended">Suspended</option>
				<option value="closed">Closed</option>
			</select>
		</form>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (editOpen = false)}
			class="rounded-xl px-4 py-2 text-sm text-ink-600 hover:bg-ink-100"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="edit-account-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Save changes
		</button>
	{/snippet}
</Modal>
