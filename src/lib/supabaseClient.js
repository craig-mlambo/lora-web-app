import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/** @type {import('@supabase/supabase-js').SupabaseClient | undefined} */
let client;

export function getSupabaseBrowserClient() {
	if (!client) {
		client = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	}

	return client;
}
