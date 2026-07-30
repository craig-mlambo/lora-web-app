<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data, form } = $props();
	let editOpen = $state(false);
	/** @type {any} */
	let editing = $state(null);

	/** @type {Record<string, string>} */
	const statusStyles = {
		active: 'bg-emerald-50 text-emerald-700',
		pending: 'bg-amber-50 text-amber-700',
		suspended: 'bg-rose-50 text-rose-700',
		closed: 'bg-ink-100 text-ink-500'
	};
</script>

<svelte:head><title>Households · LYE Aqua Flow</title></svelte:head>

<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Your households</h1>
	<p class="mt-1 text-sm text-ink-500">
		Homes you own or can access as an active household member.
	</p>
</div>

{#if form?.message || data.loadError}
	<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
		{form?.message ?? data.loadError}
	</div>
{:else if form?.updated}
	<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
	>
		Household details updated.
	</div>
{/if}

{#if data.households.length}
	<div class="mt-6 grid gap-5 lg:grid-cols-2">
		{#each data.households as household (household.id)}
			<article
				class="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]"
			>
				<header class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<h2 class="truncate text-lg font-semibold text-ink-900">{household.name}</h2>
						<p class="mt-1 font-mono text-xs text-ink-400">{household.account_number}</p>
					</div>
					<div class="flex items-center gap-2">
						<span
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusStyles[household.status]}"
							>{household.status}</span
						>
						{#if household.access_level === 'owner' || household.access_level === 'manager'}
							<button
								type="button"
								aria-label="Edit household"
								class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
								onclick={() => {
									editing = household;
									editOpen = true;
								}}
							>
								<Icon name="edit" size={16} />
							</button>
						{/if}
					</div>
				</header>

				<div class="mt-5 grid gap-4 text-sm sm:grid-cols-2">
					<div>
						<p class="text-xs uppercase tracking-wide text-ink-400">Address</p>
						<p class="mt-1 text-ink-700">
							{household.address_line_1}{household.city ? `, ${household.city}` : ''}
						</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-ink-400">Your access</p>
						<p class="mt-1 font-medium capitalize text-ink-700">{household.access_level}</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-ink-400">Prepaid account</p>
						<p class="mt-1 text-ink-700">
							{household.prepaidAccount
								? `${household.prepaidAccount.currency} · ${household.prepaidAccount.status}`
								: 'Not opened'}
						</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-ink-400">Timezone</p>
						<p class="mt-1 text-ink-700">{household.timezone}</p>
					</div>
				</div>

				<div class="mt-5 border-t border-ink-100 pt-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold text-ink-800">Members</h3>
						<span class="text-xs text-ink-400">{household.members.length}</span>
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each household.members as member (`${member.household_id}-${member.profile_id}`)}
							<span class="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600">
								{member.profile?.full_name || 'Profile'} · {member.access_level}
							</span>
						{/each}
					</div>
				</div>

				<div
					class="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 text-xs text-ink-400"
				>
					<span>{household.devices.length} meter{household.devices.length === 1 ? '' : 's'}</span>
					<span>Added {shortTime(household.created_at)}</span>
				</div>
			</article>
		{/each}
	</div>
{:else if !data.loadError}
	<div
		class="mt-6 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center text-sm text-ink-500"
	>
		No households are connected to your profile yet.
	</div>
{/if}

<Modal
	bind:open={editOpen}
	title="Edit household"
	subtitle="Owners and managers can update contact-address details."
>
	{#if editing}
		<form id="owner-household-form" method="POST" action="?/update" class="space-y-4">
			<input type="hidden" name="household_id" value={editing.id} />
			<label class="block text-sm font-medium text-ink-700"
				>Household name
				<input
					name="name"
					value={editing.name}
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				/>
			</label>
			<label class="block text-sm font-medium text-ink-700"
				>Address line 1
				<input
					name="address_line_1"
					value={editing.address_line_1}
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				/>
			</label>
			<label class="block text-sm font-medium text-ink-700"
				>Address line 2
				<input
					name="address_line_2"
					value={editing.address_line_2 ?? ''}
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				/>
			</label>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block text-sm font-medium text-ink-700"
					>Suburb<input
						name="suburb"
						value={editing.suburb ?? ''}
						class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
					/></label
				>
				<label class="block text-sm font-medium text-ink-700"
					>City<input
						name="city"
						value={editing.city ?? ''}
						class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
					/></label
				>
				<label class="block text-sm font-medium text-ink-700"
					>Province<input
						name="province"
						value={editing.province ?? ''}
						class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
					/></label
				>
				<label class="block text-sm font-medium text-ink-700"
					>Postal code<input
						name="postal_code"
						value={editing.postal_code ?? ''}
						class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
					/></label
				>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (editOpen = false)}
			class="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">Cancel</button
		>
		<button
			type="submit"
			form="owner-household-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
			>Save changes</button
		>
	{/snippet}
</Modal>
