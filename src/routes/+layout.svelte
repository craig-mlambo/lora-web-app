<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getSupabaseBrowserClient } from '$lib/supabaseClient.js';

	let { data, children } = $props();

	onMount(() => {
		const supabase = getSupabaseBrowserClient();

		/**
		 * @param {import('@supabase/supabase-js').AuthChangeEvent} _event
		 * @param {import('@supabase/supabase-js').Session | null} session
		 */
		function handleAuthChange(_event, session) {
			if (session?.expires_at !== data.session?.expires_at) {
				invalidateAll();
			}
		}

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange(handleAuthChange);

		return () => subscription.unsubscribe();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
