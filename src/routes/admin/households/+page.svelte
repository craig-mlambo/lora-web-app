<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data, form } = $props();
	let query = $state('');
	let createOpen = $state(false);
	let editOpen = $state(false);
	let membersOpen = $state(false);
	/** @type {any} */
	let editing = $state(null);

	const filtered = $derived(
		data.households.filter((household) => {
			const search = query.trim().toLowerCase();
			return (
				!search ||
				household.name.toLowerCase().includes(search) ||
				household.address_line_1.toLowerCase().includes(search) ||
				household.account_number.toLowerCase().includes(search)
			);
		})
	);

	/** @param {any} household */
	function openEdit(household) {
		editing = household;
		editOpen = true;
	}

	/** @param {any} household */
	function openMembers(household) {
		editing = household;
		membersOpen = true;
	}

	/** @type {Record<string,string>} */
	const statusStyles = {
		active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
		suspended: 'bg-rose-50 text-rose-700 ring-rose-600/20',
		closed: 'bg-ink-100 text-ink-500 ring-ink-500/20'
	};
</script>

<svelte:head><title>Households · Admin · LYE Aqua Flow</title></svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Households</h1>
		<p class="mt-1 text-sm text-ink-500">
			Manage owners, prepaid accounts, addresses, and household lifecycle.
		</p>
	</div>
	<button
		type="button"
		onclick={() => (createOpen = true)}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
	>
		<Icon name="plus" size={17} /> New household
	</button>
</div>

{#if form?.message || data.loadError}
	<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
		role="alert"
	>
		{form?.message ?? data.loadError}
	</div>
{:else if form?.created || form?.updated || form?.statusUpdated || form?.deleted || form?.memberSaved || form?.memberRemoved}
	<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
		role="status"
	>
		Household changes saved.
	</div>
{/if}

<label class="relative mt-6 block max-w-md">
	<span class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400">
		<Icon name="search" size={17} />
	</span>
	<input
		type="search"
		bind:value={query}
		placeholder="Search address, name or account number…"
		class="w-full rounded-xl border-ink-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-brand-400"
	/>
</label>

<div
	class="mt-5 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<div class="scroll-thin overflow-x-auto">
		<table class="w-full min-w-[900px] text-left text-sm">
			<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
				<tr>
					<th class="px-6 py-3 font-medium">Household</th>
					<th class="px-6 py-3 font-medium">Account</th>
					<th class="px-6 py-3 font-medium">Owner</th>
					<th class="px-6 py-3 font-medium">Prepaid account</th>
					<th class="px-6 py-3 font-medium">Meters</th>
					<th class="px-6 py-3 font-medium">Status</th>
					<th class="px-6 py-3 text-right font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-ink-100">
				{#each filtered as household (household.id)}
					<tr class="transition-colors hover:bg-ink-50">
						<td class="px-6 py-3">
							<p class="font-medium text-ink-900">{household.name}</p>
							<p class="text-xs text-ink-400">
								{household.address_line_1}{household.city ? `, ${household.city}` : ''}
							</p>
						</td>
						<td class="px-6 py-3">
							<p class="font-mono text-xs text-ink-700">{household.account_number}</p>
							<p class="mt-0.5 text-xs text-ink-400">{shortTime(household.created_at)}</p>
						</td>
						<td class="px-6 py-3">
							<p class="font-medium text-ink-700">
								{household.owner?.full_name || 'Unknown profile'}
							</p>
							<p class="text-xs text-ink-400">
								{household.members.length} member{household.members.length === 1 ? '' : 's'}
							</p>
						</td>
						<td class="px-6 py-3">
							{#if household.prepaidAccount}
								<p class="text-xs font-medium text-ink-700">
									{household.prepaidAccount.currency} · {household.prepaidAccount.status}
								</p>
								<p class="text-xs text-ink-400">
									Low balance: {household.prepaidAccount.low_balance_threshold_litres} L
								</p>
							{:else}
								<span class="text-xs text-rose-600">Missing</span>
							{/if}
						</td>
						<td class="px-6 py-3">
							{#if household.devices.length}
								{#each household.devices as device (device.id)}
									<p class="font-mono text-xs text-ink-700">{device.serial_number}</p>
								{/each}
							{:else}
								<span class="text-xs text-ink-400">No meters</span>
							{/if}
						</td>
						<td class="px-6 py-3">
							<span
								class="rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset {statusStyles[
									household.status
								] ?? statusStyles.closed}"
							>
								{household.status}
							</span>
						</td>
						<td class="px-6 py-3">
							<div class="flex justify-end gap-1">
								<button
									type="button"
									onclick={() => openMembers(household)}
									class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
								>
									Members
								</button>
								<form method="POST" action="?/setStatus">
									<input type="hidden" name="household_id" value={household.id} />
									<input
										type="hidden"
										name="status"
										value={household.status === 'active' ? 'suspended' : 'active'}
									/>
									<button
										type="submit"
										class="rounded-lg px-2.5 py-1.5 text-xs font-medium {household.status ===
										'active'
											? 'text-rose-600 hover:bg-rose-50'
											: 'text-emerald-700 hover:bg-emerald-50'}"
									>
										{household.status === 'active' ? 'Suspend' : 'Activate'}
									</button>
								</form>
								<button
									type="button"
									onclick={() => openEdit(household)}
									class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
									aria-label="Edit household"
								>
									<Icon name="edit" size={16} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr>
						<td colspan="7" class="px-6 py-10 text-center text-sm text-ink-400">
							No households match your search.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<Modal
	bind:open={createOpen}
	title="New household"
	subtitle="Creates the household, owner membership, and prepaid account."
>
	<form id="create-household-form" method="POST" action="?/create" class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="create-household-name" class="block text-sm font-medium text-ink-700">
					Name
				</label>
				<input
					id="create-household-name"
					name="name"
					required
					placeholder="Acacia Residence"
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
			<div>
				<label for="create-account-number" class="block text-sm font-medium text-ink-700">
					Account number
				</label>
				<input
					id="create-account-number"
					name="account_number"
					required
					placeholder="ACC-100600"
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
		</div>
		<div>
			<label for="create-address" class="block text-sm font-medium text-ink-700">Address</label>
			<input
				id="create-address"
				name="address_line_1"
				required
				placeholder="14 Acacia Street"
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<input
				name="city"
				placeholder="City"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="province"
				placeholder="Province"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div class="grid gap-4 sm:grid-cols-[1fr_8rem]">
			<div>
				<label for="create-owner" class="block text-sm font-medium text-ink-700">Owner</label>
				<select
					id="create-owner"
					name="owner_profile_id"
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				>
					<option value="">Select owner</option>
					{#each data.owners as owner (owner.id)}
						<option value={owner.id}>{owner.full_name || owner.id}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="create-currency" class="block text-sm font-medium text-ink-700">
					Currency
				</label>
				<input
					id="create-currency"
					name="currency"
					value="USD"
					maxlength="3"
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm uppercase focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
		</div>
	</form>

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (createOpen = false)}
			class="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="create-household-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Create household
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={membersOpen}
	title={`Household members${editing ? ` · ${editing.name}` : ''}`}
	subtitle="Add profiles and manage their household access."
>
	{#if editing}
		<div class="space-y-5">
			{#if editing.members.length}
				<div class="space-y-3">
					{#each editing.members as member (`${member.household_id}-${member.profile_id}`)}
						<form
							method="POST"
							action="?/updateMember"
							class="rounded-xl border border-ink-200 p-3"
						>
							<input type="hidden" name="household_id" value={editing.id} />
							<input type="hidden" name="profile_id" value={member.profile_id} />
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p class="text-sm font-medium text-ink-900">
										{member.profile?.full_name || member.profile_id}
									</p>
									<p class="text-xs text-ink-400">{member.profile?.phone || 'No phone'}</p>
								</div>
								{#if editing.owner_profile_id !== member.profile_id}
									<button
										type="submit"
										formaction="?/removeMember"
										class="text-xs font-medium text-rose-600 hover:text-rose-700"
									>
										Remove
									</button>
								{:else}
									<span class="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">
										Primary owner
									</span>
								{/if}
							</div>
							<div class="mt-3 grid gap-2 sm:grid-cols-3">
								<select
									name="access_level"
									value={member.access_level}
									aria-label="Access level"
									class="rounded-lg border-ink-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:ring-brand-400"
								>
									<option value="owner">Owner</option>
									<option value="manager">Manager</option>
									<option value="viewer">Viewer</option>
								</select>
								<select
									name="member_status"
									value={member.status}
									aria-label="Membership status"
									class="rounded-lg border-ink-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:ring-brand-400"
								>
									<option value="invited">Invited</option>
									<option value="active">Active</option>
									<option value="revoked">Revoked</option>
								</select>
								<input
									name="relationship"
									value={member.relationship ?? ''}
									placeholder="Relationship"
									aria-label="Relationship"
									class="rounded-lg border-ink-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:ring-brand-400"
								/>
							</div>
							<button
								type="submit"
								class="mt-2 text-xs font-medium text-brand-700 hover:text-brand-800"
							>
								Save membership
							</button>
						</form>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-ink-400">This household has no membership records.</p>
			{/if}

			<form
				id="add-household-member-form"
				method="POST"
				action="?/addMember"
				class="border-t border-ink-100 pt-4"
			>
				<input type="hidden" name="household_id" value={editing.id} />
				<p class="mb-3 text-sm font-medium text-ink-800">Add or restore a member</p>
				<div class="grid gap-3 sm:grid-cols-2">
					<select
						name="profile_id"
						required
						aria-label="Profile"
						class="rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400"
					>
						<option value="">Select profile</option>
						{#each data.owners as profile (profile.id)}
							<option value={profile.id}>{profile.full_name || profile.id}</option>
						{/each}
					</select>
					<select
						name="access_level"
						aria-label="Access level"
						class="rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400"
					>
						<option value="viewer">Viewer</option>
						<option value="manager">Manager</option>
						<option value="owner">Owner</option>
					</select>
					<input
						name="relationship"
						placeholder="Relationship (optional)"
						class="rounded-xl border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-brand-400 sm:col-span-2"
					/>
				</div>
			</form>
		</div>
	{/if}

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (membersOpen = false)}
			class="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
		>
			Close
		</button>
		<button
			type="submit"
			form="add-household-member-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Add member
		</button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Edit household" subtitle="Update ownership and address details.">
	{#if editing}
		<form id="edit-household-form" method="POST" action="?/update" class="space-y-4">
			<input type="hidden" name="household_id" value={editing.id} />
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="edit-household-name" class="block text-sm font-medium text-ink-700">
						Name
					</label>
					<input
						id="edit-household-name"
						name="name"
						value={editing.name}
						required
						class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
					/>
				</div>
				<div>
					<label for="edit-account-number" class="block text-sm font-medium text-ink-700">
						Account number
					</label>
					<input
						id="edit-account-number"
						name="account_number"
						value={editing.account_number}
						required
						class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
					/>
				</div>
			</div>
			<input
				name="address_line_1"
				value={editing.address_line_1}
				required
				aria-label="Address"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
			<div class="grid gap-4 sm:grid-cols-2">
				<input
					name="city"
					value={editing.city ?? ''}
					placeholder="City"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="province"
					value={editing.province ?? ''}
					placeholder="Province"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
			<select
				name="owner_profile_id"
				value={editing.owner_profile_id}
				required
				aria-label="Owner"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				{#each data.owners as owner (owner.id)}
					<option value={owner.id}>{owner.full_name || owner.id}</option>
				{/each}
			</select>
		</form>
	{/if}

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (editOpen = false)}
			class="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="edit-household-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Save changes
		</button>
	{/snippet}
</Modal>
