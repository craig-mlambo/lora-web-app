<script>
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { shortTime } from '$lib/utils/format.js';

	let { data, form } = $props();
	let query = $state('');
	/** @type {'all'|'invited'|'active'|'suspended'|'closed'} */
	let statusFilter = $state('all');
	let createOpen = $state(false);
	let editOpen = $state(false);
	let detailsOpen = $state(false);
	let closeOpen = $state(false);
	/** @type {any} */
	let selectedUser = $state(null);
	/** @type {any} */
	let closeTarget = $state(null);
	let editProfileId = $state('');
	let editFullName = $state('');
	let editPhone = $state('');
	let editAvatarUrl = $state('');
	let editPreferredLanguage = $state('en');

	const filtered = $derived(
		data.users.filter((user) => {
			const matchesStatus = statusFilter === 'all' || user.account_status === statusFilter;
			const search = query.trim().toLowerCase();
			const matchesSearch =
				!search ||
				(user.full_name ?? '').toLowerCase().includes(search) ||
				(user.phone ?? '').toLowerCase().includes(search);
			return matchesStatus && matchesSearch;
		})
	);

	const pendingCount = $derived(
		data.users.filter((user) => user.account_status === 'invited').length
	);

	/** @type {Record<string, string>} */
	const statusStyles = {
		active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
		invited: 'bg-amber-50 text-amber-700 ring-amber-600/20',
		suspended: 'bg-rose-50 text-rose-700 ring-rose-600/20',
		closed: 'bg-ink-100 text-ink-500 ring-ink-500/20'
	};

	/** @param {string | null} name */
	function initials(name) {
		return (name?.trim() || 'User')
			.split(/\s+/)
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/** @param {any} user */
	function openEdit(user) {
		editProfileId = user.id;
		editFullName = user.full_name ?? '';
		editPhone = user.phone ?? '';
		editAvatarUrl = user.avatar_url ?? '';
		editPreferredLanguage = user.preferred_language ?? 'en';
		editOpen = true;
	}

	/** @param {any} user */
	function openDetails(user) {
		selectedUser = user;
		detailsOpen = true;
	}

	/** @param {any} user */
	function openClose(user) {
		closeTarget = user;
		closeOpen = true;
	}
</script>

<svelte:head><title>Users · Admin · LYE Aqua Flow</title></svelte:head>

<div
	class="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
>
	<div>
		<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Users</h1>
		<p class="mt-1 text-sm text-ink-500">
			Review registrations and approve household-owner access.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
		>
			<Icon name="clock" size={17} />
			{pendingCount} pending
		</div>
		<button
			type="button"
			onclick={() => (createOpen = true)}
			class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
		>
			<Icon name="plus" size={17} /> Add user
		</button>
	</div>
</div>

{#if form?.created || form?.approved || form?.updated || form?.statusUpdated || form?.rejected || form?.deleted || form?.roleAssigned || form?.roleRemoved}
	<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
		role="status"
	>
		User changes saved successfully.
	</div>
{:else if form?.message}
	<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
		role="alert"
	>
		{form.message}
	</div>
{/if}

{#if data.loadError}
	<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
		role="alert"
	>
		{data.loadError}
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
			placeholder="Search name or phone…"
			class="w-full rounded-xl border-ink-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-brand-400"
		/>
	</label>
	<select
		bind:value={statusFilter}
		aria-label="Filter by account status"
		class="w-full rounded-xl border-ink-200 bg-white py-2 pl-3 pr-9 text-sm text-ink-700 focus:border-brand-400 focus:ring-brand-400 sm:w-auto"
	>
		<option value="all">All statuses</option>
		<option value="invited">Pending approval</option>
		<option value="active">Active</option>
		<option value="suspended">Suspended</option>
		<option value="closed">Closed</option>
	</select>
</div>

<div
	class="mt-5 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]"
>
	<div class="scroll-thin overflow-x-auto">
		<table class="w-full min-w-[680px] text-left text-sm">
			<thead class="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
				<tr>
					<th class="px-6 py-3 font-medium">User</th>
					<th class="px-6 py-3 font-medium">Role</th>
					<th class="px-6 py-3 font-medium">Status</th>
					<th class="px-6 py-3 font-medium">Phone</th>
					<th class="px-6 py-3 font-medium">Registered</th>
					<th class="px-6 py-3 text-right font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-ink-100">
				{#each filtered as user (user.id)}
					<tr class="transition-colors hover:bg-ink-50">
						<td class="px-6 py-3">
							<div class="flex items-center gap-3">
								<span
									class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
								>
									{initials(user.full_name)}
								</span>
								<div class="min-w-0">
									<button
										type="button"
										onclick={() => openDetails(user)}
										class="block truncate text-left font-medium text-ink-900 hover:text-brand-700"
									>
										{user.full_name || 'Unnamed account'}
									</button>
									<p class="truncate text-xs text-ink-400">Profile {user.id.slice(0, 8)}</p>
								</div>
							</div>
						</td>
						<td class="px-6 py-3">
							<div class="flex max-w-56 flex-wrap items-center gap-1">
								{#each user.roleAssignments as assignment (assignment.id)}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-1 text-xs font-medium text-ink-700"
									>
										{assignment.code}
										<form method="POST" action="?/removeRole">
											<input type="hidden" name="profile_id" value={user.id} />
											<input type="hidden" name="role_id" value={assignment.id} />
											<button
												type="submit"
												class="text-ink-400 hover:text-rose-600"
												aria-label={`Remove ${assignment.code} role`}
											>
												×
											</button>
										</form>
									</span>
								{/each}
								<form method="POST" action="?/assignRole" class="flex items-center gap-1">
									<input type="hidden" name="profile_id" value={user.id} />
									<select
										name="role_id"
										aria-label="Assign role"
										class="rounded-lg border-ink-200 py-1 pl-2 pr-7 text-xs focus:border-brand-400 focus:ring-brand-400"
									>
										{#each data.availableRoles as role (role.id)}
											<option value={role.id}>{role.name}</option>
										{/each}
									</select>
									<button
										type="submit"
										class="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100"
										aria-label="Assign selected role"
									>
										<Icon name="plus" size={13} />
									</button>
								</form>
							</div>
						</td>
						<td class="px-6 py-3">
							<span
								class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset {statusStyles[
									user.account_status
								] ?? statusStyles.closed}"
							>
								{user.account_status === 'invited' ? 'Pending approval' : user.account_status}
							</span>
						</td>
						<td class="px-6 py-3 text-ink-600">{user.phone || 'Not provided'}</td>
						<td class="px-6 py-3 text-ink-500">{shortTime(user.created_at)}</td>
						<td class="px-6 py-3">
							<div class="flex justify-end gap-1">
								{#if user.account_status === 'invited'}
									<form method="POST" action="?/approve">
										<input type="hidden" name="profile_id" value={user.id} />
										<button
											type="submit"
											class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
										>
											<Icon name="check" size={14} /> Approve
										</button>
									</form>
									<form method="POST" action="?/reject">
										<input type="hidden" name="profile_id" value={user.id} />
										<button
											type="submit"
											class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
										>
											Reject
										</button>
									</form>
								{:else}
									<form method="POST" action="?/setStatus">
										<input type="hidden" name="profile_id" value={user.id} />
										<input
											type="hidden"
											name="account_status"
											value={user.account_status === 'active' ? 'suspended' : 'active'}
										/>
										<button
											type="submit"
											class="rounded-lg px-2.5 py-1.5 text-xs font-medium {user.account_status ===
											'active'
												? 'text-rose-600 hover:bg-rose-50'
												: 'text-emerald-700 hover:bg-emerald-50'}"
										>
											{user.account_status === 'active' ? 'Suspend' : 'Activate'}
										</button>
									</form>
								{/if}
								<button
									type="button"
									onclick={() => openDetails(user)}
									class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-700"
									aria-label="View profile details"
								>
									<Icon name="eye" size={15} />
								</button>
								<button
									type="button"
									onclick={() => openEdit(user)}
									class="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
									aria-label="Edit profile"
								>
									<Icon name="edit" size={15} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr>
						<td colspan="6" class="px-6 py-10 text-center text-sm text-ink-400">
							No users match your filters.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<Modal
	bind:open={createOpen}
	title="Add user"
	subtitle="Create the Supabase Auth identity, profile, and role assignments."
>
	<form
		id="create-user-form"
		method="POST"
		action="?/create"
		class="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
	>
		<div>
			<label for="create-user-name" class="block text-sm font-medium text-ink-700">
				Full name
			</label>
			<input
				id="create-user-name"
				name="full_name"
				autocomplete="name"
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="create-user-email" class="block text-sm font-medium text-ink-700">
					Email
				</label>
				<input
					id="create-user-email"
					name="email"
					type="email"
					autocomplete="email"
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
			<div>
				<label for="create-user-phone" class="block text-sm font-medium text-ink-700">
					Phone
				</label>
				<input
					id="create-user-phone"
					name="phone"
					type="tel"
					autocomplete="tel"
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="create-user-password" class="block text-sm font-medium text-ink-700">
					Temporary password
				</label>
				<input
					id="create-user-password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
			<div>
				<label for="create-user-confirm" class="block text-sm font-medium text-ink-700">
					Confirm password
				</label>
				<input
					id="create-user-confirm"
					name="confirm_password"
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
				/>
			</div>
		</div>
		<!-- Preferred language is intentionally hidden for later use.
		<div>
			<label for="create-user-language" class="block text-sm font-medium text-ink-700">
				Preferred language
			</label>
			<select
				id="create-user-language"
				name="preferred_language"
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="en">English</option>
				<option value="sn">Shona</option>
				<option value="nd">Ndebele</option>
			</select>
		</div>
		-->
		<fieldset>
			<legend class="text-sm font-medium text-ink-700">Roles</legend>
			<div class="mt-2 grid gap-2 sm:grid-cols-2">
				{#each data.availableRoles as role (role.id)}
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-3 hover:bg-ink-50"
					>
						<input
							type="checkbox"
							name="role_ids"
							value={role.id}
							checked={role.code === 'house-owner'}
							class="mt-0.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
						/>
						<span>
							<span class="block text-sm font-medium text-ink-800">{role.name}</span>
							<span class="mt-0.5 block text-xs text-ink-400">
								{role.description || role.code}
							</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
		<label class="flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
			<input
				type="checkbox"
				name="approve_immediately"
				checked
				class="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
			/>
			<span>
				<span class="block text-sm font-medium text-emerald-800">Approve immediately</span>
				<span class="mt-0.5 block text-xs text-emerald-700">
					Allow access as soon as Supabase email confirmation requirements are satisfied.
				</span>
			</span>
		</label>
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
			form="create-user-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Create user
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={detailsOpen}
	title="Profile details"
	subtitle="Profile, access, household, and meter relationships."
>
	{#if selectedUser}
		<div class="max-h-[65vh] space-y-6 overflow-y-auto pr-1">
			<section>
				<div class="flex items-start gap-4">
					{#if selectedUser.avatar_url}
						<img
							src={selectedUser.avatar_url}
							alt=""
							class="h-14 w-14 rounded-full object-cover ring-1 ring-ink-200"
						/>
					{:else}
						<span
							class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white"
						>
							{initials(selectedUser.full_name)}
						</span>
					{/if}
					<div class="min-w-0">
						<h3 class="truncate font-semibold text-ink-900">
							{selectedUser.full_name || 'Unnamed account'}
						</h3>
						<p class="mt-0.5 text-sm text-ink-500">{selectedUser.phone || 'No phone number'}</p>
						<p class="mt-1 break-all font-mono text-xs text-ink-400">{selectedUser.id}</p>
					</div>
				</div>

				<dl class="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-4 text-sm">
					<div>
						<dt class="text-xs text-ink-400">Account status</dt>
						<dd class="mt-0.5 font-medium capitalize text-ink-800">
							{selectedUser.account_status}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-ink-400">Approval</dt>
						<dd class="mt-0.5 font-medium capitalize text-ink-800">
							{selectedUser.approval_status || 'Not recorded'}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-ink-400">Language</dt>
						<dd class="mt-0.5 font-medium uppercase text-ink-800">
							{selectedUser.preferred_language || 'EN'}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-ink-400">Registered</dt>
						<dd class="mt-0.5 font-medium text-ink-800">{shortTime(selectedUser.created_at)}</dd>
					</div>
				</dl>
			</section>

			<section>
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-sm font-semibold text-ink-900">Roles</h3>
					<span class="text-xs text-ink-400">{selectedUser.roleAssignments.length} assigned</span>
				</div>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each selectedUser.roleAssignments as role (role.id)}
						<span class="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
							{role.name || role.code}
						</span>
					{:else}
						<span class="text-sm text-ink-400">No role rows assigned.</span>
					{/each}
				</div>
			</section>

			<section>
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-sm font-semibold text-ink-900">Households</h3>
					<span class="text-xs text-ink-400">{selectedUser.memberships.length} memberships</span>
				</div>
				<div class="mt-2 space-y-2">
					{#each selectedUser.memberships as membership (`${membership.household_id}-${membership.profile_id}`)}
						<div class="rounded-xl border border-ink-200 p-3">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-medium text-ink-900">
										{membership.household?.name || 'Unknown household'}
									</p>
									<p class="mt-0.5 text-xs text-ink-400">
										{membership.household?.account_number || membership.household_id}
									</p>
								</div>
								<span
									class="rounded-full bg-ink-100 px-2 py-1 text-xs font-medium capitalize text-ink-600"
								>
									{membership.access_level}
								</span>
							</div>
							<p class="mt-2 text-xs text-ink-500">
								{membership.relationship || 'Relationship not specified'} · {membership.status}
							</p>
							{#if membership.prepaidAccount}
								<p class="mt-1 text-xs text-brand-700">
									Prepaid: {membership.prepaidAccount.currency} ·
									{membership.prepaidAccount.status}
								</p>
							{/if}
						</div>
					{:else}
						<p class="rounded-xl bg-ink-50 p-3 text-sm text-ink-400">No household memberships.</p>
					{/each}
				</div>
			</section>

			<section>
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-sm font-semibold text-ink-900">Devices</h3>
					<span class="text-xs text-ink-400">{selectedUser.devices.length} related</span>
				</div>
				<div class="mt-2 space-y-2">
					{#each selectedUser.devices as device (device.id)}
						<div
							class="flex items-start justify-between gap-3 rounded-xl border border-ink-200 p-3"
						>
							<div>
								<p class="font-mono text-xs font-medium text-ink-900">{device.serial_number}</p>
								<p class="mt-1 text-xs text-ink-400">
									{device.household?.name || 'Unknown household'} ·
									{[device.manufacturer, device.model].filter(Boolean).join(' ') ||
										'Model unavailable'}
								</p>
							</div>
							<div class="text-right">
								<p class="text-xs font-medium capitalize text-ink-700">{device.status}</p>
								<p class="mt-1 text-xs text-ink-400">
									{device.isAssigned ? 'Assigned' : 'Registered by user'}
								</p>
							</div>
						</div>
					{:else}
						<p class="rounded-xl bg-ink-50 p-3 text-sm text-ink-400">
							No assigned or registered devices.
						</p>
					{/each}
				</div>
			</section>
		</div>
	{/if}

	{#snippet footer()}
		{#if selectedUser}
			<button
				type="button"
				onclick={() => openClose(selectedUser)}
				disabled={selectedUser.account_status === 'closed'}
				class="mr-auto rounded-xl px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Close account
			</button>
			<button
				type="button"
				onclick={() => openEdit(selectedUser)}
				class="rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
			>
				Edit profile
			</button>
		{/if}
		<button
			type="button"
			onclick={() => (detailsOpen = false)}
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Done
		</button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Edit profile" subtitle="Update profile contact information.">
	<form id="edit-profile-form" method="POST" action="?/updateProfile" class="space-y-4">
		<input type="hidden" name="profile_id" value={editProfileId} />
		<div>
			<label for="edit-full-name" class="block text-sm font-medium text-ink-700">Full name</label>
			<input
				id="edit-full-name"
				name="full_name"
				bind:value={editFullName}
				required
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div>
			<label for="edit-phone" class="block text-sm font-medium text-ink-700">Phone</label>
			<input
				id="edit-phone"
				name="phone"
				type="tel"
				bind:value={editPhone}
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div>
			<label for="edit-avatar-url" class="block text-sm font-medium text-ink-700">
				Avatar URL
			</label>
			<input
				id="edit-avatar-url"
				name="avatar_url"
				type="url"
				bind:value={editAvatarUrl}
				placeholder="https://example.com/avatar.jpg"
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			/>
		</div>
		<div>
			<label for="edit-language" class="block text-sm font-medium text-ink-700">
				Preferred language
			</label>
			<select
				id="edit-language"
				name="preferred_language"
				bind:value={editPreferredLanguage}
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-brand-400"
			>
				<option value="en">English</option>
				<option value="sn">Shona</option>
				<option value="nd">Ndebele</option>
			</select>
		</div>
	</form>

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
			form="edit-profile-form"
			class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
		>
			Save changes
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={closeOpen}
	title="Close user account?"
	subtitle="This is a reversible soft deletion that preserves household and payment history."
>
	{#if closeTarget}
		<p class="text-sm leading-6 text-ink-600">
			<strong class="font-semibold text-ink-900">
				{closeTarget.full_name || 'This user'}
			</strong>
			will no longer be able to access either dashboard. Their authentication identity and historical
			records will remain intact.
		</p>
		<form id="close-user-form" method="POST" action="?/delete">
			<input type="hidden" name="profile_id" value={closeTarget.id} />
		</form>
	{/if}

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (closeOpen = false)}
			class="rounded-xl px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="close-user-form"
			class="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
		>
			Close account
		</button>
	{/snippet}
</Modal>
