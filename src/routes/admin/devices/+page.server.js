import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/authorization.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [
		,
		{ data: devices, error: devicesError },
		{ data: households, error: householdsError },
		{ data: memberships, error: membershipsError },
		{ data: profiles, error: profilesError }
	] = await Promise.all([
		parent(),
		locals.supabase
			.from('devices')
			.select(
				'id, household_id, assigned_profile_id, serial_number, ttn_device_id, dev_eui, manufacturer, model, firmware_version, status, valve_state, last_seen_at, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(500),
		locals.supabase
			.from('households')
			.select('id, name, account_number, address_line_1, status')
			.neq('status', 'closed')
			.order('name')
			.limit(500),
		locals.supabase
			.from('household_members')
			.select('household_id, profile_id, access_level, status')
			.eq('status', 'active')
			.limit(2000),
		locals.supabase
			.from('profiles')
			.select('id, full_name, phone, account_status')
			.eq('account_status', 'active')
			.limit(1000)
	]);

	const loadError = devicesError ?? householdsError ?? membershipsError ?? profilesError;
	if (loadError) {
		console.error('Unable to load device administration data.', loadError);
		return { devices: [], households: [], members: [], loadError: loadError.message };
	}

	const householdById = new Map((households ?? []).map((household) => [household.id, household]));
	const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

	return {
		devices: (devices ?? []).map((device) => ({
			...device,
			household: householdById.get(device.household_id) ?? null,
			assignee: device.assigned_profile_id
				? (profileById.get(device.assigned_profile_id) ?? null)
				: null
		})),
		households: households ?? [],
		members: (memberships ?? []).map((membership) => ({
			...membership,
			profile: profileById.get(membership.profile_id) ?? null
		})),
		loadError: null
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');
		const assignedProfileId = String(formData.get('assigned_profile_id') ?? '');
		const serialNumber = String(formData.get('serial_number') ?? '').trim();
		const ttnDeviceId = String(formData.get('ttn_device_id') ?? '').trim();
		const devEui = String(formData.get('dev_eui') ?? '')
			.trim()
			.toUpperCase();
		const manufacturer = String(formData.get('manufacturer') ?? '').trim();
		const model = String(formData.get('model') ?? '').trim();

		if (!uuidPattern.test(householdId) || !serialNumber) {
			return fail(400, { message: 'Household and serial number are required.' });
		}
		if (assignedProfileId && !uuidPattern.test(assignedProfileId)) {
			return fail(400, { message: 'Select a valid household member.' });
		}

		const { data: device, error: deviceError } = await locals.supabase
			.from('devices')
			.insert({
				household_id: householdId,
				assigned_profile_id: assignedProfileId || null,
				registered_by_profile_id: administrator.id,
				serial_number: serialNumber,
				ttn_device_id: ttnDeviceId || null,
				dev_eui: devEui || null,
				manufacturer: manufacturer || null,
				model: model || null,
				status: 'pending',
				valve_state: 'unknown'
			})
			.select('id')
			.single();

		if (deviceError || !device) {
			return fail(500, { message: deviceError?.message ?? 'Device registration failed.' });
		}

		const { error: assignmentError } = await locals.supabase.from('device_assignments').insert({
			device_id: device.id,
			household_id: householdId,
			assigned_profile_id: assignedProfileId || null,
			assigned_by_profile_id: administrator.id,
			notes: 'Initial device registration'
		});

		if (assignmentError) {
			await locals.supabase.from('devices').delete().eq('id', device.id);
			return fail(500, { message: assignmentError.message });
		}

		return { created: true, deviceId: device.id };
	},

	update: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const deviceId = String(formData.get('device_id') ?? '');
		const householdId = String(formData.get('household_id') ?? '');
		const assignedProfileId = String(formData.get('assigned_profile_id') ?? '');
		const serialNumber = String(formData.get('serial_number') ?? '').trim();
		const ttnDeviceId = String(formData.get('ttn_device_id') ?? '').trim();
		const devEui = String(formData.get('dev_eui') ?? '')
			.trim()
			.toUpperCase();
		const manufacturer = String(formData.get('manufacturer') ?? '').trim();
		const model = String(formData.get('model') ?? '').trim();
		const firmwareVersion = String(formData.get('firmware_version') ?? '').trim();
		const status = String(formData.get('status') ?? '');
		const valveState = String(formData.get('valve_state') ?? '');

		if (!uuidPattern.test(deviceId) || !uuidPattern.test(householdId) || !serialNumber) {
			return fail(400, { message: 'Device, household, and serial number are required.' });
		}
		if (assignedProfileId && !uuidPattern.test(assignedProfileId)) {
			return fail(400, { message: 'Select a valid household member.' });
		}
		if (!['pending', 'active', 'inactive', 'faulty', 'retired'].includes(status)) {
			return fail(400, { message: 'Select a valid device status.' });
		}
		if (!['open', 'closed', 'unknown'].includes(valveState)) {
			return fail(400, { message: 'Select a valid valve state.' });
		}

		const { data: existing, error: lookupError } = await locals.supabase
			.from('devices')
			.select('household_id, assigned_profile_id')
			.eq('id', deviceId)
			.single();
		if (lookupError || !existing) {
			return fail(404, { message: lookupError?.message ?? 'Device not found.' });
		}

		const assignmentChanged =
			existing.household_id !== householdId ||
			(existing.assigned_profile_id ?? '') !== assignedProfileId;

		if (assignmentChanged) {
			const { error: closeError } = await locals.supabase
				.from('device_assignments')
				.update({ unassigned_at: new Date().toISOString() })
				.eq('device_id', deviceId)
				.is('unassigned_at', null);
			if (closeError) return fail(500, { message: closeError.message });
		}

		const { error: updateError } = await locals.supabase
			.from('devices')
			.update({
				household_id: householdId,
				assigned_profile_id: assignedProfileId || null,
				serial_number: serialNumber,
				ttn_device_id: ttnDeviceId || null,
				dev_eui: devEui || null,
				manufacturer: manufacturer || null,
				model: model || null,
				firmware_version: firmwareVersion || null,
				status,
				valve_state: valveState,
				updated_at: new Date().toISOString()
			})
			.eq('id', deviceId);
		if (updateError) return fail(500, { message: updateError.message });

		if (assignmentChanged) {
			const { error: assignmentError } = await locals.supabase.from('device_assignments').insert({
				device_id: deviceId,
				household_id: householdId,
				assigned_profile_id: assignedProfileId || null,
				assigned_by_profile_id: administrator.id,
				notes: 'Assignment updated from admin console'
			});
			if (assignmentError) return fail(500, { message: assignmentError.message });
		}

		return { updated: true, deviceId };
	},

	retire: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const deviceId = String(formData.get('device_id') ?? '');
		if (!uuidPattern.test(deviceId)) {
			return fail(400, { message: 'A valid device id is required.' });
		}

		await locals.supabase
			.from('device_assignments')
			.update({ unassigned_at: new Date().toISOString() })
			.eq('device_id', deviceId)
			.is('unassigned_at', null);
		const { error } = await locals.supabase
			.from('devices')
			.update({ status: 'retired', updated_at: new Date().toISOString() })
			.eq('id', deviceId);
		if (error) return fail(500, { message: error.message });

		return { retired: true, deviceId };
	},

	delete: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const deviceId = String(formData.get('device_id') ?? '');
		if (!uuidPattern.test(deviceId)) {
			return fail(400, { message: 'A valid device id is required.' });
		}

		const [{ count: readingCount }, { count: allocationCount }] = await Promise.all([
			locals.supabase
				.from('device_readings')
				.select('*', { count: 'exact', head: true })
				.eq('device_id', deviceId),
			locals.supabase
				.from('meter_credit_allocations')
				.select('*', { count: 'exact', head: true })
				.eq('device_id', deviceId)
		]);
		if ((readingCount ?? 0) > 0 || (allocationCount ?? 0) > 0) {
			return fail(409, { message: 'Retire this device; it has readings or credit history.' });
		}

		await locals.supabase.from('device_assignments').delete().eq('device_id', deviceId);
		const { error } = await locals.supabase.from('devices').delete().eq('id', deviceId);
		if (error) return fail(500, { message: error.message });

		return { deleted: true, deviceId };
	}
};
