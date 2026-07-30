<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data, form } = $props();
	let query = $state('');
	let createOpen = $state(false);
	let editOpen = $state(false);
	let refundOpen = $state(false);
	/** @type {any} */
	let editing = $state(null);
	/** @type {any} */
	let refunding = $state(null);

	const filtered = $derived(
		data.payments.filter((payment) => {
			const search = query.trim().toLowerCase();
			return (
				!search ||
				payment.provider.toLowerCase().includes(search) ||
				(payment.provider_reference ?? '').toLowerCase().includes(search) ||
				(payment.account?.household?.name ?? '').toLowerCase().includes(search)
			);
		})
	);

	/** @type {Record<string,string>} */
	const statusStyles = {
		pending: 'bg-amber-50 text-amber-700',
		processing: 'bg-brand-50 text-brand-700',
		succeeded: 'bg-emerald-50 text-emerald-700',
		failed: 'bg-rose-50 text-rose-700',
		cancelled: 'bg-ink-100 text-ink-500',
		partially_refunded: 'bg-violet-50 text-violet-700',
		refunded: 'bg-violet-50 text-violet-700'
	};
</script>

<svelte:head><title>Payments · Admin · LYE Aqua Flow</title></svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Payments</h1>
		<p class="mt-1 text-sm text-ink-500">Manage payment records and refund requests.</p>
	</div>
	<button
		type="button"
		onclick={() => (createOpen = true)}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
	>
		<Icon name="plus" size={17} /> Record payment
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
		Payment changes saved.
	</div>
{/if}

<label class="relative mt-6 block max-w-md">
	<span class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400">
		<Icon name="search" size={17} />
	</span>
	<input
		type="search"
		bind:value={query}
		placeholder="Search provider, reference, or household…"
		class="w-full rounded-xl border-ink-200 bg-white py-2 pl-9 pr-3 text-sm"
	/>
</label>

<div
	class="mt-5 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<div class="scroll-thin overflow-x-auto">
		<table class="w-full min-w-[920px] text-left text-sm">
			<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
				<tr>
					<th class="px-5 py-3 font-medium">Household</th>
					<th class="px-5 py-3 font-medium">Provider</th>
					<th class="px-5 py-3 font-medium">Amount</th>
					<th class="px-5 py-3 font-medium">Status</th>
					<th class="px-5 py-3 font-medium">Water credit</th>
					<th class="px-5 py-3 font-medium">Refunds</th>
					<th class="px-5 py-3 font-medium">Requested</th>
					<th class="px-5 py-3 text-right font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-ink-100">
				{#each filtered as payment (payment.id)}
					<tr>
						<td class="px-5 py-3">
							<p class="font-medium text-ink-900">
								{payment.account?.household?.name || 'Unknown household'}
							</p>
							<p class="font-mono text-xs text-ink-400">
								{payment.account?.household?.account_number || payment.prepaid_account_id}
							</p>
						</td>
						<td class="px-5 py-3">
							<p class="text-ink-700">{payment.provider}</p>
							<p class="font-mono text-xs text-ink-400">
								{payment.provider_reference || 'No reference'}
							</p>
						</td>
						<td class="px-5 py-3 font-semibold text-ink-800">
							{payment.currency}
							{Number(payment.amount).toFixed(2)}
						</td>
						<td class="px-5 py-3">
							<span
								class="rounded-full px-2.5 py-1 text-xs font-medium {statusStyles[payment.status] ??
									statusStyles.cancelled}"
							>
								{payment.status}
							</span>
						</td>
						<td class="px-5 py-3 text-ink-600">
							{payment.purchase
								? `${payment.purchase.purchased_litres + payment.purchase.bonus_litres} L`
								: 'None'}
						</td>
						<td class="px-5 py-3 text-ink-600">{payment.refunds.length}</td>
						<td class="px-5 py-3 text-ink-500">{shortTime(payment.requested_at)}</td>
						<td class="px-5 py-3">
							<div class="flex justify-end gap-1">
								{#if payment.status === 'succeeded'}
									<button
										type="button"
										onclick={() => {
											refunding = payment;
											refundOpen = true;
										}}
										class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
									>
										Refund
									</button>
								{/if}
								<button
									type="button"
									onclick={() => {
										editing = payment;
										editOpen = true;
									}}
									class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
									aria-label="Edit payment"
								>
									<Icon name="edit" size={16} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr
						><td colspan="8" class="px-5 py-10 text-center text-ink-400">No payments found.</td></tr
					>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<Modal bind:open={createOpen} title="Record payment" subtitle="Creates a pending payment record.">
	<form id="create-payment-form" method="POST" action="?/create" class="space-y-4">
		<select
			name="prepaid_account_id"
			required
			aria-label="Prepaid account"
			class="w-full rounded-xl border-ink-200 px-3 py-2.5"
		>
			<option value="">Select prepaid account</option>
			{#each data.accounts as account (account.id)}
				<option value={account.id}>
					{account.household?.name || account.id} · {account.currency}
				</option>
			{/each}
		</select>
		<select
			name="payer_profile_id"
			aria-label="Payer profile"
			class="w-full rounded-xl border-ink-200 px-3 py-2.5"
		>
			<option value="">Current administrator</option>
			{#each data.profiles as profile (profile.id)}
				<option value={profile.id}>{profile.full_name || profile.id}</option>
			{/each}
		</select>
		<div class="grid gap-4 sm:grid-cols-2">
			<input
				name="provider"
				required
				placeholder="Provider"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<input
				name="provider_reference"
				placeholder="Provider reference"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<input
				name="amount"
				type="number"
				min="0.01"
				step="0.01"
				required
				placeholder="Amount"
				class="rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<input
				name="currency"
				value="USD"
				maxlength="3"
				required
				aria-label="Currency"
				class="rounded-xl border-ink-200 px-3 py-2.5 uppercase"
			/>
		</div>
	</form>
	{#snippet footer()}
		<button type="button" onclick={() => (createOpen = false)} class="px-4 py-2 text-sm">
			Cancel
		</button>
		<button
			type="submit"
			form="create-payment-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
		>
			Record payment
		</button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Update payment">
	{#if editing}
		<form id="edit-payment-form" method="POST" action="?/update" class="space-y-4">
			<input type="hidden" name="payment_id" value={editing.id} />
			<select
				name="status"
				value={editing.status}
				aria-label="Payment status"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5"
			>
				<option value="pending">Pending</option>
				<option value="processing">Processing</option>
				<option value="succeeded">Succeeded</option>
				<option value="failed">Failed</option>
				<option value="cancelled">Cancelled</option>
				<option value="partially_refunded">Partially refunded</option>
				<option value="refunded">Refunded</option>
			</select>
			<input
				name="provider_reference"
				value={editing.provider_reference ?? ''}
				placeholder="Provider reference"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<div class="grid gap-4 sm:grid-cols-2">
				<input
					name="failure_code"
					value={editing.failure_code ?? ''}
					placeholder="Failure code"
					class="rounded-xl border-ink-200 px-3 py-2.5"
				/>
				<input
					name="failure_message"
					value={editing.failure_message ?? ''}
					placeholder="Failure message"
					class="rounded-xl border-ink-200 px-3 py-2.5"
				/>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" onclick={() => (editOpen = false)} class="px-4 py-2 text-sm">
			Cancel
		</button>
		<button
			type="submit"
			form="edit-payment-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
		>
			Save payment
		</button>
	{/snippet}
</Modal>

<Modal bind:open={refundOpen} title="Request refund">
	{#if refunding}
		<form id="refund-form" method="POST" action="?/refund" class="space-y-4">
			<input type="hidden" name="payment_id" value={refunding.id} />
			<input
				name="amount"
				type="number"
				min="0.01"
				max={refunding.amount}
				step="0.01"
				required
				placeholder="Refund amount"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5"
			/>
			<textarea
				name="reason"
				rows="3"
				placeholder="Reason"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5"></textarea>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" onclick={() => (refundOpen = false)} class="px-4 py-2 text-sm">
			Cancel
		</button>
		<button
			type="submit"
			form="refund-form"
			class="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
		>
			Create refund
		</button>
	{/snippet}
</Modal>
