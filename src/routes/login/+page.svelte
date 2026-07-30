<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getSupabaseBrowserClient } from '$lib/supabaseClient.js';
	import { dashboardPathForProfile, rolesFromRows } from '$lib/utils/roles.js';

	/** @type {'password'|'magic'} */
	let mode = $state('password');
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let sent = $state(false);
	let errorMessage = $state('');

	/** @param {SubmitEvent} e */
	async function handleSubmit(e) {
		e.preventDefault();
		loading = true;
		errorMessage = '';
		const supabase = getSupabaseBrowserClient();

		if (mode === 'magic') {
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: {
					emailRedirectTo: `${window.location.origin}/auth/callback`,
					shouldCreateUser: false
				}
			});
			loading = false;

			if (error) {
				errorMessage = error.message;
				return;
			}

			sent = true;
			return;
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			loading = false;
			errorMessage = error.message;
			return;
		}

		const {
			data: { user }
		} = await supabase.auth.getUser();
		const { data: profile } = user
			? await supabase.from('profiles').select('account_status').eq('id', user.id).maybeSingle()
			: { data: null };
		const { data: roleRows } = user
			? await supabase
					.from('profile_roles')
					.select('role_id, user_roles(id, code)')
					.eq('profile_id', user.id)
			: { data: null };
		const roles = rolesFromRows(roleRows);
		const destination = dashboardPathForProfile({
			account_status: profile?.account_status,
			roles: roles.flatMap((role) => (role.code ? [role.code] : [])),
			roleIds: roles.flatMap((role) => (role.id ? [role.id] : []))
		});

		loading = false;
		await goto(resolve(destination), {
			invalidateAll: true
		});
	}

	const stats = [
		{ value: '200K+', label: 'Meters managed' },
		{ value: '4.8M', label: 'Readings / day' },
		{ value: '99.9%', label: 'Ingestion uptime' }
	];
</script>

<svelte:head>
	<title>Sign in · LYE Aqua Flow</title>
</svelte:head>

<div class="grid min-h-screen min-h-dvh lg:grid-cols-2">
	<!-- Brand panel -->
	<section
		class="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-12 lg:flex lg:flex-col"
	>
		<!-- decorative blobs -->
		<div class="pointer-events-none absolute inset-0 opacity-70">
			<div class="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"></div>
			<div class="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"></div>
		</div>

		<div class="relative z-10">
			<Logo tone="light" />
		</div>

		<div class="relative z-10 my-auto max-w-md">
			<h1 class="text-4xl font-semibold leading-tight tracking-tight text-white">
				Every drop,
				<span class="bg-gradient-to-r from-brand-200 to-brand-400 bg-clip-text text-transparent">
					accounted for.
				</span>
			</h1>
			<p class="mt-4 text-lg leading-relaxed text-brand-100/80">
				Real-time ultrasonic water metering for utilities and households — readings, consumption
				trends and meter health, all in one place.
			</p>

			<dl class="mt-10 grid grid-cols-3 gap-6">
				{#each stats as s (s.label)}
					<div>
						<dt class="text-2xl font-semibold text-white">{s.value}</dt>
						<dd class="mt-1 text-sm text-brand-100/70">{s.label}</dd>
					</div>
				{/each}
			</dl>
		</div>

		<!-- wave -->
		<svg
			class="relative z-10 mt-auto text-brand-400/30"
			viewBox="0 0 500 60"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M0 30 Q 62 5 125 30 T 250 30 T 375 30 T 500 30"
				stroke="currentColor"
				stroke-width="2"
			/>
			<path
				d="M0 42 Q 62 17 125 42 T 250 42 T 375 42 T 500 42"
				stroke="currentColor"
				stroke-width="2"
				opacity="0.6"
			/>
		</svg>
	</section>

	<!-- Form panel -->
	<section class="flex items-center justify-center px-4 py-6 sm:p-12">
		<div class="w-full max-w-sm">
			<div class="lg:hidden">
				<Logo />
			</div>

			<div class="mt-8 lg:mt-0">
				<h2 class="text-2xl font-semibold tracking-tight text-ink-900">Welcome back</h2>
				<p class="mt-1.5 text-sm text-ink-500">Sign in to monitor your water meters.</p>
			</div>

			<!-- mode toggle -->
			<div class="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 text-sm font-medium">
				<button
					class="rounded-lg py-2 transition-colors {mode === 'password'
						? 'bg-white text-ink-900 shadow-sm'
						: 'text-ink-500 hover:text-ink-700'}"
					onclick={() => {
						mode = 'password';
						sent = false;
						errorMessage = '';
					}}
				>
					Password
				</button>
				<button
					class="rounded-lg py-2 transition-colors {mode === 'magic'
						? 'bg-white text-ink-900 shadow-sm'
						: 'text-ink-500 hover:text-ink-700'}"
					onclick={() => {
						mode = 'magic';
						sent = false;
						errorMessage = '';
					}}
				>
					Magic link
				</button>
			</div>

			{#if sent}
				<div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
					<div
						class="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600"
					>
						<Icon name="mail" />
					</div>
					<p class="mt-3 font-medium text-ink-900">Check your inbox</p>
					<p class="mt-1 text-sm text-ink-500">
						We sent a sign-in link to <span class="font-medium text-ink-700">{email}</span>.
					</p>
				</div>
			{:else}
				<form class="mt-6 space-y-4" onsubmit={handleSubmit}>
					{#if errorMessage}
						<div
							class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
							role="alert"
						>
							{errorMessage}
						</div>
					{/if}

					<div>
						<label for="email" class="block text-sm font-medium text-ink-700">Email address</label>
						<div class="relative mt-1.5">
							<span
								class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400"
							>
								<Icon name="mail" size={18} />
							</span>
							<input
								id="email"
								type="email"
								bind:value={email}
								required
								autocomplete="email"
								placeholder="you@example.com"
								class="w-full rounded-xl border-ink-200 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
							/>
						</div>
					</div>

					{#if mode === 'password'}
						<div>
							<div class="flex items-center justify-between">
								<label for="password" class="block text-sm font-medium text-ink-700">Password</label
								>
								<a href="#forgot" class="text-xs font-medium text-brand-600 hover:text-brand-700">
									Forgot?
								</a>
							</div>
							<div class="relative mt-1.5">
								<span
									class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400"
								>
									<Icon name="lock" size={18} />
								</span>
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									required
									autocomplete="current-password"
									placeholder="••••••••"
									class="w-full rounded-xl border-ink-200 py-2.5 pl-10 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:ring-brand-400"
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
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-70"
					>
						{#if loading}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
							></span>
							Please wait…
						{:else}
							{mode === 'magic' ? 'Send magic link' : 'Sign in'}
							<Icon name="arrow" size={18} />
						{/if}
					</button>
				</form>
			{/if}

			<p class="mt-6 text-center text-sm text-ink-500">
				Don't have an account?
				<a href={resolve('/signup')} class="font-medium text-brand-600 hover:text-brand-700">
					Create one
				</a>
			</p>
		</div>
	</section>
</div>
