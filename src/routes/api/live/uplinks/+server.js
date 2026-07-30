import { json } from '@sveltejs/kit';
import { fetchUplinks, LORA_API_URL } from '$lib/server/ttn.js';

/**
 * GET /api/live/uplinks?last=24h&deviceId=...&decode=true
 * Server-side proxy to the lora-api-server so the browser avoids CORS and
 * never sees the upstream host. Mirrors the Postman "Locco Water TTN Readings".
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, fetch }) {
	const last = url.searchParams.get('last') ?? '24h';
	const deviceId = url.searchParams.get('deviceId') || null;
	const decode = url.searchParams.get('decode') !== 'false';

	const result = await fetchUplinks(fetch, { last, deviceId, decode });

	if (!result.ok) {
		return json(
			{ error: result.error, detail: result.detail, source: LORA_API_URL },
			{ status: result.status }
		);
	}
	return json({ ...result.data, source: LORA_API_URL });
}
