<script>
	let { data, form } = $props();
</script>

<svelte:head><title>Profile · LYE Aqua Flow</title></svelte:head>
<div>
	<h1 class="text-2xl font-semibold tracking-tight text-ink-900">Profile settings</h1>
	<p class="mt-1 text-sm text-ink-500">Update your personal contact information.</p>
</div>
{#if form?.message}<div
		class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
	>
		{form.message}
	</div>{:else if form?.updated}<div
		class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
	>
		Profile updated successfully.
	</div>{/if}
<div
	class="mt-6 max-w-2xl rounded-2xl border border-ink-200/70 bg-white p-6 shadow-[var(--shadow-card)]"
>
	<form method="POST" action="?/update" class="space-y-5">
		<div class="grid gap-5 sm:grid-cols-2">
			<label class="block text-sm font-medium text-ink-700"
				>Full name<input
					name="full_name"
					value={data.profile?.full_name ?? ''}
					required
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				/></label
			>
			<label class="block text-sm font-medium text-ink-700"
				>Phone<input
					name="phone"
					value={data.profile?.phone ?? ''}
					class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
				/></label
			>
		</div>
		<label class="block text-sm font-medium text-ink-700"
			>Email<input
				value={data.user?.email ?? ''}
				disabled
				class="mt-1.5 w-full rounded-xl border-ink-200 bg-ink-50 px-3 py-2.5 text-ink-500"
			/><span class="mt-1 block text-xs font-normal text-ink-400"
				>Authentication email changes are not enabled here.</span
			></label
		>
		<label class="block text-sm font-medium text-ink-700"
			>Avatar URL<input
				name="avatar_url"
				type="url"
				value={data.profile?.avatar_url ?? ''}
				placeholder="https://…"
				class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5"
			/></label
		>
		<div class="border-t border-ink-100 pt-5">
			<button
				class="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
				>Save profile</button
			>
		</div>
	</form>
</div>
