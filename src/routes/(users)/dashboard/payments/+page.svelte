<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import { shortTime } from '$lib/utils/format.js';
	let { data, form } = $props();
	let topupOpen = $state(false);
	/** @type {Record<string, string>} */
	const statusStyles = {
		pending: 'bg-amber-50 text-amber-700',
		processing: 'bg-brand-50 text-brand-700',
		succeeded: 'bg-emerald-50 text-emerald-700',
		failed: 'bg-rose-50 text-rose-700',
		cancelled: 'bg-ink-100 text-ink-500',
		partially_refunded: 'bg-violet-50 text-violet-700',
		refunded: 'bg-violet-50 text-violet-700'
	};
	const totalBalance = $derived(
		data.accounts.reduce((total, account) => total + Number(account.ledgerBalanceLitres), 0)
	);
	const purchased = $derived(
		data.payments.reduce(
			(total, payment) =>
				total +
				Number(payment.purchase?.purchased_litres ?? 0) +
				Number(payment.purchase?.bonus_litres ?? 0),
			0
		)
	);
</script>

<svelte:head><title>Payments and credit · LYE Aqua Flow</title></svelte:head>
<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Payments & water credit</h1>
		<p class="mt-1 text-sm text-ink-500">Request top-ups and follow your prepaid water history.</p>
	</div>
	<button
		type="button"
		disabled={data.accounts.filter((account) => account.status === 'active').length === 0}
		onclick={() => (topupOpen = true)}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
		><Icon name="plus" size={17} /> Request top-up</button
	>
</div>
{#if form?.message || data.loadError}<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
	>
		{form?.message ?? data.loadError}
	</div>{:else if form?.initiated}<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
	>
		Payment request created. Credit is added after the provider or administrator confirms payment.
	</div>{:else if form?.cancelled}<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
	>
		Pending payment request cancelled.
	</div>{/if}
<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Ledger balance"
		value={`${totalBalance.toLocaleString()} L`}
		icon="drop"
		accent={totalBalance > 100 ? 'emerald' : 'amber'}
		hint="Across accessible prepaid accounts"
	/><StatCard
		label="Water purchased"
		value={`${purchased.toLocaleString()} L`}
		icon="chart"
		accent="brand"
	/><StatCard
		label="Prepaid accounts"
		value={String(data.accounts.length)}
		icon="home"
		accent="brand"
	/><StatCard
		label="Pending requests"
		value={String(data.payments.filter((payment) => payment.status === 'pending').length)}
		icon="clock"
		accent="amber"
	/>
</div>
<div class="mt-6 grid gap-4 lg:grid-cols-2">
	{#each data.accounts as account (account.id)}<article
			class="rounded-2xl border border-ink-200 bg-white p-5"
		>
			<div class="flex justify-between gap-3">
				<div>
					<h2 class="font-semibold text-ink-900">{account.household?.name || 'Household'}</h2>
					<p class="mt-1 font-mono text-xs text-ink-400">{account.household?.account_number}</p>
				</div>
				<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
					>{account.status}</span
				>
			</div>
			<div class="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
				<div>
					<p class="text-xs uppercase text-ink-400">Ledger balance</p>
					<p class="mt-1 text-2xl font-semibold">
						{Number(account.ledgerBalanceLitres).toLocaleString()} L
					</p>
				</div>
				<p class="text-sm text-ink-500">{account.currency}</p>
			</div>
		</article>{/each}
</div>
<div class="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
	<div class="border-b border-ink-100 px-5 py-4">
		<h2 class="font-semibold text-ink-900">Payment history</h2>
	</div>
	<div class="overflow-x-auto">
		<table class="w-full min-w-[820px] text-left text-sm">
			<thead class="bg-ink-50 text-xs uppercase text-ink-400"
				><tr
					><th class="px-5 py-3">Household</th><th class="px-5 py-3">Provider</th><th
						class="px-5 py-3">Amount</th
					><th class="px-5 py-3">Status</th><th class="px-5 py-3">Water credit</th><th
						class="px-5 py-3">Requested</th
					><th class="px-5 py-3"></th></tr
				></thead
			><tbody class="divide-y divide-ink-100"
				>{#each data.payments as payment (payment.id)}<tr
						><td class="px-5 py-3 font-medium">{payment.account?.household?.name}</td><td
							class="px-5 py-3"
							>{payment.provider}
							<p class="font-mono text-xs text-ink-400">
								{payment.provider_reference || 'No reference'}
							</p></td
						><td class="px-5 py-3 font-semibold"
							>{payment.currency} {Number(payment.amount).toFixed(2)}</td
						><td class="px-5 py-3"
							><span
								class="rounded-full px-2.5 py-1 text-xs font-medium {statusStyles[payment.status]}"
								>{payment.status}</span
							></td
						><td class="px-5 py-3"
							>{payment.purchase
								? `${Number(payment.purchase.purchased_litres) + Number(payment.purchase.bonus_litres)} L`
								: '—'}</td
						><td class="px-5 py-3 text-ink-500">{shortTime(payment.requested_at)}</td><td
							class="px-5 py-3 text-right"
							>{#if payment.status === 'pending' && payment.payer_profile_id === data.user.id}<form
									method="POST"
									action="?/cancel"
								>
									<input type="hidden" name="payment_id" value={payment.id} /><button
										class="text-xs font-medium text-rose-600 hover:text-rose-700">Cancel</button
									>
								</form>{/if}</td
						></tr
					>{/each}{#if data.payments.length === 0}<tr
						><td colspan="7" class="px-5 py-10 text-center text-ink-400"
							>No payment requests yet.</td
						></tr
					>{/if}</tbody
			>
		</table>
	</div>
</div>
<div class="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
	<div class="border-b border-ink-100 px-5 py-4">
		<h2 class="font-semibold text-ink-900">Water ledger</h2>
	</div>
	<div class="overflow-x-auto">
		<table class="w-full min-w-[650px] text-left text-sm">
			<thead class="bg-ink-50 text-xs uppercase text-ink-400"
				><tr
					><th class="px-5 py-3">Date</th><th class="px-5 py-3">Household</th><th class="px-5 py-3"
						>Type</th
					><th class="px-5 py-3">Description</th><th class="px-5 py-3 text-right">Litres</th></tr
				></thead
			><tbody class="divide-y divide-ink-100"
				>{#each data.ledger as entry (entry.id)}<tr
						><td class="px-5 py-3 text-ink-500">{shortTime(entry.occurred_at)}</td><td
							class="px-5 py-3">{entry.account?.household?.name}</td
						><td class="px-5 py-3 capitalize">{entry.entry_type}</td><td
							class="px-5 py-3 text-ink-600">{entry.description}</td
						><td
							class="px-5 py-3 text-right font-semibold {Number(entry.litres_delta) >= 0
								? 'text-emerald-700'
								: 'text-rose-700'}"
							>{Number(entry.litres_delta) > 0 ? '+' : ''}{Number(
								entry.litres_delta
							).toLocaleString()} L</td
						></tr
					>{/each}</tbody
			>
		</table>
	</div>
</div>
<Modal
	bind:open={topupOpen}
	title="Request a water-credit top-up"
	subtitle="This creates a pending payment for confirmation."
>
	<form id="topup-form" method="POST" action="?/initiate" class="space-y-4">
		<label class="block text-sm font-medium text-ink-700"
			>Prepaid account<select
				name="prepaid_account_id"
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				><option value="">Choose household</option
				>{#each data.accounts.filter((account) => account.status === 'active') as account (account.id)}<option
						value={account.id}>{account.household?.name} · {account.currency}</option
					>{/each}</select
			></label
		>
		<label class="block text-sm font-medium text-ink-700"
			>Payment provider<select
				name="provider"
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				><option value="">Choose provider</option><option value="mobile-money">Mobile money</option
				><option value="bank-transfer">Bank transfer</option><option value="cash-office"
					>Cash office</option
				></select
			></label
		>
		<label class="block text-sm font-medium text-ink-700"
			>Amount<input
				name="amount"
				type="number"
				min="0.01"
				step="0.01"
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
			/></label
		>
		<label class="block text-sm font-medium text-ink-700"
			>Your payment reference <span class="font-normal text-ink-400">(optional)</span><input
				name="provider_reference"
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
			/></label
		>
	</form>
	{#snippet footer()}<button
			type="button"
			onclick={() => (topupOpen = false)}
			class="rounded-xl px-4 py-2 text-sm text-ink-600">Cancel</button
		><button
			type="submit"
			form="topup-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
			>Submit request</button
		>{/snippet}
</Modal>
