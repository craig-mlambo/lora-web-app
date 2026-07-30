import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const authResponseHeaders = new Headers();

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
				for (const [name, value] of Object.entries(headers)) {
					authResponseHeaders.set(name, value);
				}
			}
		}
	});

	/** @type {ReturnType<App.Locals['safeGetSession']> | undefined} */
	let safeSessionPromise;
	event.locals.safeGetSession = () => {
		// Authentication is needed by layouts and server actions in the same
		// request. Share the verified result instead of contacting Auth twice.
		safeSessionPromise ??= (async () => {
			const {
				data: { user },
				error
			} = await event.locals.supabase.auth.getUser();

			if (error || !user) return { session: null, user: null };

			const { data: claimsData } = await event.locals.supabase.auth.getClaims();
			const expiresAt =
				typeof claimsData?.claims?.exp === 'number' ? claimsData.claims.exp : undefined;

			return { session: { expires_at: expiresAt }, user };
		})();

		return safeSessionPromise;
	};

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});

	for (const [name, value] of authResponseHeaders) {
		response.headers.set(name, value);
	}

	return response;
}
