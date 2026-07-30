import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/authorization.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {FormData} formData */
function tariffInput(formData) {
	const name = String(formData.get('name') ?? '').trim();
	const currency = String(formData.get('currency') ?? '')
		.trim()
		.toUpperCase();
	const fixedFee = Number(formData.get('fixed_fee'));
	const effectiveFrom = new Date(String(formData.get('effective_from') ?? ''));
	const effectiveToRaw = String(formData.get('effective_to') ?? '');
	const effectiveTo = effectiveToRaw ? new Date(effectiveToRaw) : null;
	const status = String(formData.get('status') ?? 'draft');

	if (
		!name ||
		!/^[A-Z]{3}$/.test(currency) ||
		!Number.isFinite(fixedFee) ||
		fixedFee < 0 ||
		Number.isNaN(effectiveFrom.getTime()) ||
		(effectiveTo && Number.isNaN(effectiveTo.getTime())) ||
		!['draft', 'active', 'retired'].includes(status)
	) {
		return null;
	}

	return {
		name,
		currency,
		fixed_fee: fixedFee,
		effective_from: effectiveFrom.toISOString(),
		effective_to: effectiveTo?.toISOString() ?? null,
		status
	};
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [, { data: tariffs, error: tariffsError }, { data: bands, error: bandsError }] =
		await Promise.all([
			parent(),
			locals.supabase
				.from('tariffs')
				.select('id, name, currency, fixed_fee, effective_from, effective_to, status')
				.order('effective_from', { ascending: false })
				.limit(200),
			locals.supabase
				.from('tariff_bands')
				.select('id, tariff_id, band_order, from_m3, to_m3, price_per_m3')
				.order('band_order')
				.limit(1000)
		]);

	const loadError = tariffsError ?? bandsError;
	if (loadError) return { tariffs: [], loadError: loadError.message };

	const bandsByTariff = new Map();
	for (const band of bands ?? []) {
		const current = bandsByTariff.get(band.tariff_id) ?? [];
		current.push(band);
		bandsByTariff.set(band.tariff_id, current);
	}

	return {
		tariffs: (tariffs ?? []).map((tariff) => ({
			...tariff,
			bands: bandsByTariff.get(tariff.id) ?? []
		})),
		loadError: null
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const input = tariffInput(await request.formData());
		if (!input) return fail(400, { message: 'Complete the tariff fields with valid values.' });

		const { data: tariff, error } = await locals.supabase
			.from('tariffs')
			.insert({ ...input, created_by_profile_id: administrator.id })
			.select('id')
			.single();
		if (error || !tariff) {
			return fail(500, { message: error?.message ?? 'Tariff creation failed.' });
		}
		return { created: true, tariffId: tariff.id };
	},

	update: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const tariffId = String(formData.get('tariff_id') ?? '');
		const input = tariffInput(formData);
		if (!uuidPattern.test(tariffId) || !input) {
			return fail(400, { message: 'Complete the tariff fields with valid values.' });
		}

		const { error } = await locals.supabase.from('tariffs').update(input).eq('id', tariffId);
		if (error) return fail(500, { message: error.message });
		return { updated: true, tariffId };
	},

	delete: async ({ request, locals }) => {
		await requireAdmin(locals);
		const tariffId = String((await request.formData()).get('tariff_id') ?? '');
		if (!uuidPattern.test(tariffId)) {
			return fail(400, { message: 'A valid tariff id is required.' });
		}

		const { count } = await locals.supabase
			.from('water_credit_purchases')
			.select('*', { count: 'exact', head: true })
			.eq('tariff_id', tariffId);
		if ((count ?? 0) > 0) {
			return fail(409, { message: 'Retire this tariff; water purchases already reference it.' });
		}

		const { error } = await locals.supabase.from('tariffs').delete().eq('id', tariffId);
		if (error) return fail(500, { message: error.message });
		return { deleted: true, tariffId };
	},

	addBand: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const tariffId = String(formData.get('tariff_id') ?? '');
		const bandOrder = Number(formData.get('band_order'));
		const fromM3 = Number(formData.get('from_m3'));
		const toRaw = String(formData.get('to_m3') ?? '');
		const toM3 = toRaw === '' ? null : Number(toRaw);
		const pricePerM3 = Number(formData.get('price_per_m3'));

		if (
			!uuidPattern.test(tariffId) ||
			!Number.isInteger(bandOrder) ||
			bandOrder <= 0 ||
			!Number.isFinite(fromM3) ||
			fromM3 < 0 ||
			(toM3 !== null && (!Number.isFinite(toM3) || toM3 <= fromM3)) ||
			!Number.isFinite(pricePerM3) ||
			pricePerM3 < 0
		) {
			return fail(400, { message: 'Enter a valid tariff band.' });
		}

		const { error } = await locals.supabase.from('tariff_bands').insert({
			tariff_id: tariffId,
			band_order: bandOrder,
			from_m3: fromM3,
			to_m3: toM3,
			price_per_m3: pricePerM3
		});
		if (error) return fail(500, { message: error.message });
		return { bandAdded: true, tariffId };
	},

	deleteBand: async ({ request, locals }) => {
		await requireAdmin(locals);
		const bandId = String((await request.formData()).get('band_id') ?? '');
		if (!uuidPattern.test(bandId)) {
			return fail(400, { message: 'A valid tariff band id is required.' });
		}

		const { error } = await locals.supabase.from('tariff_bands').delete().eq('id', bandId);
		if (error) return fail(500, { message: error.message });
		return { bandDeleted: true, bandId };
	}
};
