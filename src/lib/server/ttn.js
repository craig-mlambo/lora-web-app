/**
 * Server-only wrapper around the `lora-api-server` TTN endpoints.
 * Base URL is configurable via the LORA_API_URL env var (defaults to the
 * local dev server on :3012, per the Postman collection).
 */
import { env } from '$env/dynamic/private';

export const LORA_API_URL = env.LORA_API_URL ?? 'https://lora-api-server.vercel.app';

/**
 * The upstream TTN endpoint accepts hour windows only. Allow callers to use a
 * day suffix for convenience, but always forward a canonical hour value.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeUplinkWindow(value) {
	if (typeof value !== 'string') return null;
	const match = value
		.trim()
		.toLowerCase()
		.match(/^(\d+)(h|d)$/);
	if (!match) return null;

	const amount = Number(match[1]);
	const hours = match[2] === 'd' ? amount * 24 : amount;
	if (!Number.isInteger(hours) || hours < 1 || hours > 2160) return null;

	return `${hours}h`;
}

/**
 * Fetch decoded uplinks from `GET /api/ttn/uplinks`.
 * @param {typeof fetch} fetchFn  SvelteKit's event fetch
 * @param {{ last?: string, deviceId?: string|null, decode?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: string, detail?: string }>}
 */
export async function fetchUplinks(fetchFn, opts = {}) {
	const { last = '24h', deviceId = null, decode = true } = opts;
	const normalizedLast = normalizeUplinkWindow(last);
	if (!normalizedLast) {
		return {
			ok: false,
			status: 400,
			error: 'Invalid time window',
			detail: 'Use an hour or day value between 1h and 90d, for example 7h, 48h, or 7d.'
		};
	}

	const qs = new URLSearchParams({ last: normalizedLast });
	if (deviceId) qs.set('deviceId', deviceId);
	if (!decode) qs.set('decode', 'false');

	const target = `${LORA_API_URL}/api/ttn/uplinks?${qs.toString()}`;

	try {
		const res = await fetchFn(target);
		const text = await res.text();
		if (!res.ok) {
			return {
				ok: false,
				status: res.status,
				error: 'Upstream API error',
				detail: text.slice(0, 500)
			};
		}
		return { ok: true, status: 200, data: JSON.parse(text) };
	} catch (err) {
		return {
			ok: false,
			status: 503,
			error: `Could not reach the LYE API at ${LORA_API_URL}`,
			detail: err instanceof Error ? err.message : String(err)
		};
	}
}
