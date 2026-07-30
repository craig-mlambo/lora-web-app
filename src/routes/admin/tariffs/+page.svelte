<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data, form } = $props();
	let createOpen = $state(false);
	let editOpen = $state(false);
	let bandOpen = $state(false);
	/** @type {any} */
	let editing = $state(null);
	/** @type {any} */
	let bandTariff = $state(null);

	/** @param {string | null} value */
	function dateTimeLocal(value) {
		if (!value) return '';
		const date = new Date(value);
		const offset = date.getTimezoneOffset() * 60_000;
		return new Date(date.getTime() - offset).toISOString().slice(0, 16);
	}

	/** @type {Record<string,string>} */
	const statusStyles = {
		draft: 'bg-amber-50 text-amber-700 ring-amber-600/20',
		active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		retired: 'bg-ink-100 text-ink-500 ring-ink-500/20'
	};
</script>

<svelte:head><title>Tariffs · Admin · LYE Aqua Flow</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Tariffs</h1>
		<p class="mt-1 text-sm text-ink-500">Manage effective pricing and volume bands.</p>
	</div>
	<button
		type="button"
		onclick={() => (createOpen = true)}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
	>
		<Icon name="plus" size={17} /> New tariff
	</button>
</div>

{#if form?.message || data.loadError}
	<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{form?.message ?? data.loadError}
	</div>
{:else if form}
	<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
	>
		Tariff changes saved.
	</div>
{/if}

<div class="mt-6 grid gap-5 lg:grid-cols-2">
	{#each data.tariffs as tariff (tariff.id)}
		<section class="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="flex items-center gap-2">
						<h2 class="font-semibold text-ink-900">{tariff.name}</h2>
						<span
							class="rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset {statusStyles[
								tariff.status
							]}"
						>
							{tariff.status}
						</span>
					</div>
					<p class="mt-1 text-sm text-ink-500">
						{tariff.currency} · fixed fee {tariff.fixed_fee}
					</p>
					<p class="mt-1 text-xs text-ink-400">
						From {shortTime(tariff.effective_from)}
						{tariff.effective_to ? ` to ${shortTime(tariff.effective_to)}` : ' · no end date'}
					</p>
				</div>
				<button
					type="button"
					onclick={() => {
						editing = tariff;
						editOpen = true;
					}}
					class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
					aria-label="Edit tariff"
				>
					<Icon name="edit" size={16} />
				</button>
			</div>

			<div class="mt-4 overflow-hidden rounded-xl border border-ink-100">
				<table class="w-full text-left text-xs">
					<thead class="bg-ink-50 text-ink-400">
						<tr>
							<th class="px-3 py-2 font-medium">Band</th>
							<th class="px-3 py-2 font-medium">From m³</th>
							<th class="px-3 py-2 font-medium">To m³</th>
							<th class="px-3 py-2 font-medium">Price / m³</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-100">
						{#each tariff.bands as band (band.id)}
							<tr>
								<td class="px-3 py-2">{band.band_order}</td>
								<td class="px-3 py-2">{band.from_m3}</td>
								<td class="px-3 py-2">{band.to_m3 ?? '∞'}</td>
								<td class="px-3 py-2 font-medium">{band.price_per_m3}</td>
								<td class="px-3 py-2 text-right">
									<form method="POST" action="?/deleteBand">
										<input type="hidden" name="band_id" value={band.id} />
										<button type="submit" class="text-rose-600 hover:underline">Remove</button>
									</form>
								</td>
							</tr>
						{/each}
						{#if tariff.bands.length === 0}
							<tr><td colspan="5" class="px-3 py-5 text-center text-ink-400">No bands</td></tr>
						{/if}
					</tbody>
				</table>
			</div>
			<button
				type="button"
				onclick={() => {
					bandTariff = tariff;
					bandOpen = true;
				}}
				class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
			>
				<Icon name="plus" size={13} /> Add band
			</button>
		</section>
	{/each}
</div>

{#if data.tariffs.length === 0}
	<div class="mt-6 rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-400">
		No tariffs configured.
	</div>
{/if}

<Modal bind:open={createOpen} title="New tariff">
	<form id="create-tariff-form" method="POST" action="?/create" class="space-y-4">
		<input
			name="name"
			required
			placeholder="Domestic prepaid"
			class="w-full rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
		/>
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
				name="fixed_fee"
				type="number"
				min="0"
				step="0.01"
				value="0"
				required
				aria-label="Fixed fee"
				class="rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="effective_from"
				type="datetime-local"
				required
				aria-label="Effective from"
				class="rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="effective_to"
				type="datetime-local"
				aria-label="Effective to"
				class="rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<select
			name="status"
			aria-label="Tariff status"
			class="w-full rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
		>
			<option value="draft">Draft</option>
			<option value="active">Active</option>
		</select>
	</form>
	{#snippet footer()}
		<button type="button" onclick={() => (createOpen = false)} class="px-4 py-2 text-sm">
			Cancel
		</button>
		<button
			type="submit"
			form="create-tariff-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
		>
			Create tariff
		</button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Edit tariff">
	{#if editing}
		<form id="edit-tariff-form" method="POST" action="?/update" class="space-y-4">
			<input type="hidden" name="tariff_id" value={editing.id} />
			<input
				name="name"
				value={editing.name}
				required
				aria-label="Tariff name"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 focus:border-brand-400 focus:ring-brand-400"
			/>
			<div class="grid gap-4 sm:grid-cols-2">
				<input
					name="currency"
					value={editing.currency}
					required
					aria-label="Currency"
					class="rounded-xl border-ink-200 px-3 py-2.5 uppercase"
				/>
				<input
					name="fixed_fee"
					type="number"
					min="0"
					step="0.01"
					value={editing.fixed_fee}
					required
					aria-label="Fixed fee"
					class="rounded-xl border-ink-200 px-3 py-2.5"
				/>
				<input
					name="effective_from"
					type="datetime-local"
					value={dateTimeLocal(editing.effective_from)}
					required
					aria-label="Effective from"
					class="rounded-xl border-ink-200 px-3 py-2.5"
				/>
				<input
					name="effective_to"
					type="datetime-local"
					value={dateTimeLocal(editing.effective_to)}
					aria-label="Effective to"
					class="rounded-xl border-ink-200 px-3 py-2.5"
				/>
			</div>
			<select
				name="status"
				value={editing.status}
				aria-label="Status"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5"
			>
				<option value="draft">Draft</option>
				<option value="active">Active</option>
				<option value="retired">Retired</option>
			</select>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" onclick={() => (editOpen = false)} class="px-4 py-2 text-sm">
			Cancel
		</button>
		<button
			type="submit"
			form="edit-tariff-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
		>
			Save tariff
		</button>
	{/snippet}
</Modal>

<Modal bind:open={bandOpen} title="Add tariff band" subtitle={bandTariff?.name ?? ''}>
	{#if bandTariff}
		<form id="add-band-form" method="POST" action="?/addBand" class="grid gap-4 sm:grid-cols-2">
			<input type="hidden" name="tariff_id" value={bandTariff.id} />
			<input
				name="band_order"
				type="number"
				min="1"
				value={bandTariff.bands.length + 1}
				required
				placeholder="Order"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<input
				name="from_m3"
				type="number"
				min="0"
				step="0.001"
				required
				placeholder="From m³"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<input
				name="to_m3"
				type="number"
				min="0"
				step="0.001"
				placeholder="To m³ (blank = unlimited)"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<input
				name="price_per_m3"
				type="number"
				min="0"
				step="0.0001"
				required
				placeholder="Price per m³"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" onclick={() => (bandOpen = false)} class="px-4 py-2 text-sm">
			Cancel
		</button>
		<button
			type="submit"
			form="add-band-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
		>
			Add band
		</button>
	{/snippet}
</Modal>
