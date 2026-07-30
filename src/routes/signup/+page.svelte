<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { form } = $props();
	let fullName = $state('');
	let email = $state('');
	let phone = $state('');
	// Preferred language is intentionally hidden for now.
	// let preferredLanguage = $state('en');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let loading = $state(false);

	/** @type {import('@sveltejs/kit').SubmitFunction} */
	function enhanceSignup() {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	}
</script>

<svelte:head>
	<title>Create account · LYE Aqua Flow</title>
	<meta
		name="description"
		content="Create your LYE Aqua Flow account to manage prepaid water usage."
	/>
</svelte:head>

<div class="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
	<section
		class="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-12 lg:flex lg:flex-col"
	>
		<div class="pointer-events-none absolute inset-0 opacity-70">
			<div class="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"></div>
			<div class="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"></div>
		</div>

		<div class="relative z-10"><Logo tone="light" /></div>

		<div class="relative z-10 my-auto max-w-md">
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-200">
				Prepaid water, made clear
			</p>
			<h1 class="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
				Know your balance. Understand every litre.
			</h1>
			<p class="mt-4 text-lg leading-relaxed text-brand-100/80">
				Create one secure account for household balances, meter readings, payments and water usage.
			</p>

			<ul class="mt-10 space-y-4 text-sm text-brand-100">
				<li class="flex items-center gap-3">
					<span class="grid h-8 w-8 place-items-center rounded-full bg-white/10">
						<Icon name="check" size={16} />
					</span>
					Track prepaid water credit transparently
				</li>
				<li class="flex items-center gap-3">
					<span class="grid h-8 w-8 place-items-center rounded-full bg-white/10">
						<Icon name="check" size={16} />
					</span>
					Review household meter consumption
				</li>
				<li class="flex items-center gap-3">
					<span class="grid h-8 w-8 place-items-center rounded-full bg-white/10">
						<Icon name="check" size={16} />
					</span>
					Keep payment and usage records together
				</li>
			</ul>
		</div>
	</section>

	<section class="flex items-center justify-center p-6 sm:p-10">
		<div class="w-full max-w-lg">
			<div class="lg:hidden"><Logo /></div>

			<div class="mt-8 lg:mt-0">
				<h2 class="text-2xl font-semibold tracking-tight text-ink-900">Create your account</h2>
				<p class="mt-1.5 text-sm text-ink-500">Your account starts with household-owner access.</p>
			</div>

			{#if form?.success}
				<div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
					<div
						class="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600"
					>
						<Icon name="mail" />
					</div>
					<p class="mt-3 font-medium text-ink-900">Your account is awaiting approval</p>
					<p class="mt-1 text-sm text-ink-500">
						{#if form.requiresEmailConfirmation}
							First confirm the email sent to
							<span class="font-medium text-ink-700">{form.email}</span>.
						{/if}
						An administrator must approve your profile before you can open the dashboard.
					</p>
					<a
						href={resolve(form.requiresEmailConfirmation ? '/login' : '/pending-approval')}
						class="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
					>
						{form.requiresEmailConfirmation ? 'Return to sign in' : 'View account status'}
						<Icon name="arrow" size={17} />
					</a>
				</div>
			{:else}
				<form method="POST" class="mt-6 space-y-4" use:enhance={enhanceSignup}>
					{#if form?.message}
						<div
							class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
							role="alert"
						>
							{form.message}
						</div>
					{/if}

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="sm:col-span-2">
							<label for="full-name" class="block text-sm font-medium text-ink-700">
								Full name
							</label>
							<div class="relative mt-1.5">
								<span
									class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400"
								>
									<Icon name="user" size={18} />
								</span>
								<input
									id="full-name"
									name="full_name"
									type="text"
									bind:value={fullName}
									required
									autocomplete="name"
									placeholder="Your full name"
									class="w-full rounded-xl border-ink-200 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
								/>
							</div>
						</div>

						<div>
							<label for="email" class="block text-sm font-medium text-ink-700">
								Email address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								bind:value={email}
								required
								autocomplete="email"
								placeholder="you@example.com"
								class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
							/>
						</div>

						<div>
							<label for="phone" class="block text-sm font-medium text-ink-700">
								Phone <span class="font-normal text-ink-400">(optional)</span>
							</label>
							<input
								id="phone"
								name="phone"
								type="tel"
								bind:value={phone}
								autocomplete="tel"
								placeholder="+263 …"
								class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
							/>
						</div>

						<!-- Preferred language is intentionally hidden for later use.
						<div class="sm:col-span-2">
							<label for="language" class="block text-sm font-medium text-ink-700">
								Preferred language
							</label>
							<select
								id="language"
								name="preferred_language"
								bind:value={preferredLanguage}
								class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-400 focus:ring-brand-400"
							>
								<option value="en">English</option>
								<option value="sn">Shona</option>
								<option value="nd">Ndebele</option>
							</select>
						</div>
						-->

						<div>
							<label for="password" class="block text-sm font-medium text-ink-700">
								Password
							</label>
							<div class="relative mt-1.5">
								<input
									id="password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									required
									minlength="8"
									autocomplete="new-password"
									placeholder="At least 8 characters"
									class="w-full rounded-xl border-ink-200 py-2.5 pl-3 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
								/>
								<button
									type="button"
									class="absolute inset-y-0 right-2 grid place-items-center px-1 text-ink-400 hover:text-ink-600"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
									onclick={() => (showPassword = !showPassword)}
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
								</button>
							</div>
						</div>

						<div>
							<label for="confirm-password" class="block text-sm font-medium text-ink-700">
								Confirm password
							</label>
							<input
								id="confirm-password"
								name="confirm_password"
								type={showPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								required
								minlength="8"
								autocomplete="new-password"
								placeholder="Repeat your password"
								class="mt-1.5 w-full rounded-xl border-ink-200 px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-70"
					>
						{#if loading}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
							></span>
							Creating account…
						{:else}
							Create account <Icon name="arrow" size={18} />
						{/if}
					</button>
				</form>
			{/if}

			<p class="mt-6 text-center text-sm text-ink-500">
				Already have an account?
				<a href={resolve('/login')} class="font-medium text-brand-600 hover:text-brand-700">
					Sign in
				</a>
			</p>
		</div>
	</section>
</div>
