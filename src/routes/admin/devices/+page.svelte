<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { timeAgo } from '$lib/utils/format.js';

	let { data, form } = $props();
	let query = $state('');
	/** @type {'all'|'pending'|'active'|'inactive'|'faulty'|'retired'} */
	let statusFilter = $state('all');
	let createOpen = $state(false);
	let editOpen = $state(false);
	let createHouseholdId = $state('');
	let editHouseholdId = $state('');
	/** @type {any} */
	let editing = $state(null);

	const filtered = $derived(
		data.devices.filter((device) => {
			const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
			const search = query.trim().toLowerCase();
			const matchesSearch =
				!search ||
				device.serial_number.toLowerCase().includes(search) ||
				(device.ttn_device_id ?? '').toLowerCase().includes(search) ||
				(device.dev_eui ?? '').toLowerCase().includes(search) ||
				(device.household?.name ?? '').toLowerCase().includes(search);
			return matchesStatus && matchesSearch;
		})
	);

	/** @param {string} householdId */
	function membersFor(householdId) {
		return data.members.filter((member) => member.household_id === householdId);
	}

	/** @param {any} device */
	function openEdit(device) {
		editing = device;
		editHouseholdId = device.household_id;
		editOpen = true;
	}

	/** @type {Record<string,string>} */
	const statusStyles = {
		pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
		active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		inactive: 'bg-ink-100 text-ink-600 ring-ink-500/20',
		faulty: 'bg-rose-50 text-rose-700 ring-rose-600/20',
		retired: 'bg-ink-100 text-ink-400 ring-ink-400/20'
	};
</script>

<svelte:head><title>Devices · Admin · LYE Aqua Flow</title></svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Devices</h1>
		<p class="mt-1 text-sm text-ink-500">
			Register prepaid meters and maintain household assignment history.
		</p>
	</div>
	<button
		type="button"
		onclick={() => (createOpen = true)}
		class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
	>
		<Icon name="plus" size={17} /> Register meter
	</button>
</div>

{#if form?.message || data.loadError}
	<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
		role="alert"
	>
		{form?.message ?? data.loadError}
	</div>
{:else if form?.created || form?.updated || form?.retired || form?.deleted}
	<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
		role="status"
	>
		Device changes saved.
	</div>
{/if}

<div class="mt-6 flex flex-wrap items-center gap-3">
	<label class="relative w-full min-w-0 sm:min-w-[220px] sm:flex-1">
		<span
			class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400"
		>
			<Icon name="search" size={17} />
		</span>
		<input
			type="search"
			bind:value={query}
			placeholder="Search device ID, serial, EUI, or household…"
			class="w-full rounded-xl border-ink-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-brand-400"
		/>
	</label>
	<select
		bind:value={statusFilter}
		aria-label="Filter device status"
		class="w-full rounded-xl border-ink-200 bg-white py-2 pl-3 pr-9 text-sm focus:border-brand-400 focus:ring-brand-400 sm:w-auto"
	>
		<option value="all">All statuses</option>
		<option value="pending">Pending</option>
		<option value="active">Active</option>
		<option value="inactive">Inactive</option>
		<option value="faulty">Faulty</option>
		<option value="retired">Retired</option>
	</select>
</div>

<div
	class="mt-5 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<div class="scroll-thin overflow-x-auto">
		<table class="w-full min-w-[900px] text-left text-sm">
			<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
				<tr>
					<th class="px-6 py-3 font-medium">Device</th>
					<th class="px-6 py-3 font-medium">Household</th>
					<th class="px-6 py-3 font-medium">Assignee</th>
					<th class="px-6 py-3 font-medium">Status</th>
					<th class="px-6 py-3 font-medium">Valve</th>
					<th class="px-6 py-3 font-medium">Last seen</th>
					<th class="px-6 py-3 text-right font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-ink-100">
				{#each filtered as device (device.id)}
					<tr class="transition-colors hover:bg-ink-50">
						<td class="px-6 py-3">
							<p class="font-mono text-xs font-medium text-ink-900">
								{device.serial_number}
							</p>
							<p class="font-mono text-xs text-ink-400">
								{device.ttn_device_id || 'No TTN ID'} · {device.dev_eui || 'No DevEUI'}
							</p>
							<p class="mt-0.5 text-xs text-ink-400">
								{[device.manufacturer, device.model, device.firmware_version]
									.filter(Boolean)
									.join(' · ') || 'No model details'}
							</p>
						</td>
						<td class="px-6 py-3">
							<p class="font-medium text-ink-700">
								{device.household?.name || 'Missing household'}
							</p>
							<p class="text-xs text-ink-400">{device.household?.account_number || ''}</p>
						</td>
						<td class="px-6 py-3 text-ink-600">
							{device.assignee?.full_name || 'Household-wide'}
						</td>
						<td class="px-6 py-3">
							<span
								class="rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset {statusStyles[
									device.status
								] ?? statusStyles.inactive}"
							>
								{device.status}
							</span>
						</td>
						<td class="px-6 py-3 text-ink-600">{device.valve_state || 'unknown'}</td>
						<td class="px-6 py-3 text-ink-500">
							{device.last_seen_at ? timeAgo(device.last_seen_at, new Date()) : 'Never'}
						</td>
						<td class="px-6 py-3">
							<div class="flex justify-end gap-1">
								{#if device.status !== 'retired'}
									<form method="POST" action="?/retire">
										<input type="hidden" name="device_id" value={device.id} />
										<button
											type="submit"
											class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
										>
											Retire
										</button>
									</form>
								{/if}
								<button
									type="button"
									onclick={() => openEdit(device)}
									class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
									aria-label="Edit device"
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
							No devices match your filters.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<Modal
	bind:open={createOpen}
	title="Register meter"
	subtitle="A household is required by the devices table."
>
	<form id="create-device-form" method="POST" action="?/create" class="space-y-4">
		<div>
			<label for="create-device-household" class="block text-sm font-medium text-ink-700">
				Household
			</label>
			<select
				id="create-device-household"
				name="household_id"
				bind:value={createHouseholdId}
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="">Select household</option>
				{#each data.households as household (household.id)}
					<option value={household.id}>{household.name} · {household.account_number}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="create-device-assignee" class="block text-sm font-medium text-ink-700">
				Assigned member <span class="font-normal text-ink-400">(optional)</span>
			</label>
			<select
				id="create-device-assignee"
				name="assigned_profile_id"
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="">Household-wide meter</option>
				{#each membersFor(createHouseholdId) as member (`${member.household_id}-${member.profile_id}`)}
					<option value={member.profile_id}>
						{member.profile?.full_name || member.profile_id} · {member.access_level}
					</option>
				{/each}
			</select>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<input
				name="serial_number"
				required
				placeholder="Serial number"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 font-mono text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="ttn_device_id"
				placeholder="TTN device ID"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 font-mono text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="dev_eui"
				placeholder="DevEUI"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 font-mono text-sm uppercase focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="manufacturer"
				placeholder="Manufacturer"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
			<input
				name="model"
				placeholder="Model"
				class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
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
			form="create-device-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Register meter
		</button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Edit meter" subtitle="Updates metadata and assignment history.">
	{#if editing}
		<form id="edit-device-form" method="POST" action="?/update" class="space-y-4">
			<input type="hidden" name="device_id" value={editing.id} />
			<div class="grid gap-4 sm:grid-cols-2">
				<select
					name="household_id"
					bind:value={editHouseholdId}
					required
					aria-label="Household"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				>
					{#each data.households as household (household.id)}
						<option value={household.id}>{household.name}</option>
					{/each}
				</select>
				<select
					name="assigned_profile_id"
					value={editing.assigned_profile_id ?? ''}
					aria-label="Assigned member"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				>
					<option value="">Household-wide meter</option>
					{#each membersFor(editHouseholdId) as member (`${member.household_id}-${member.profile_id}`)}
						<option value={member.profile_id}
							>{member.profile?.full_name || member.profile_id}</option
						>
					{/each}
				</select>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<input
					name="serial_number"
					value={editing.serial_number}
					required
					aria-label="Serial number"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 font-mono text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="ttn_device_id"
					value={editing.ttn_device_id ?? ''}
					placeholder="TTN device ID"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 font-mono text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="dev_eui"
					value={editing.dev_eui ?? ''}
					placeholder="DevEUI"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 font-mono text-sm uppercase focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="manufacturer"
					value={editing.manufacturer ?? ''}
					placeholder="Manufacturer"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="model"
					value={editing.model ?? ''}
					placeholder="Model"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
				<input
					name="firmware_version"
					value={editing.firmware_version ?? ''}
					placeholder="Firmware"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<select
					name="status"
					value={editing.status}
					aria-label="Device status"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				>
					<option value="pending">Pending</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
					<option value="faulty">Faulty</option>
					<option value="retired">Retired</option>
				</select>
				<select
					name="valve_state"
					value={editing.valve_state ?? 'unknown'}
					aria-label="Valve state"
					class="w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				>
					<option value="unknown">Valve unknown</option>
					<option value="open">Valve open</option>
					<option value="closed">Valve closed</option>
				</select>
			</div>
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
			form="edit-device-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Save changes
		</button>
	{/snippet}
</Modal>
