/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [
		,
		{ data: readings, error: readingsError },
		{ data: devices, error: devicesError },
		{ data: households, error: householdsError }
	] = await Promise.all([
		parent(),
		locals.supabase
			.from('device_readings')
			.select(
				'id, device_id, source_message_id, frame_counter, reading_time, received_at, cumulative_litres, interval_litres, instant_flow_lpm, remaining_credit_litres, battery_percent, rssi, snr, valve_state, checksum_ok'
			)
			.order('reading_time', { ascending: false })
			.limit(500),
		locals.supabase
			.from('devices')
			.select('id, household_id, serial_number, ttn_device_id, dev_eui'),
		locals.supabase.from('households').select('id, name, account_number')
	]);

	const loadError = readingsError ?? devicesError ?? householdsError;
	if (loadError) return { readings: [], devices: [], loadError: loadError.message };

	const householdById = new Map((households ?? []).map((household) => [household.id, household]));
	const deviceById = new Map(
		(devices ?? []).map((device) => [
			device.id,
			{ ...device, household: householdById.get(device.household_id) ?? null }
		])
	);

	return {
		readings: (readings ?? []).map((reading) => ({
			...reading,
			device: deviceById.get(reading.device_id) ?? null
		})),
		devices: [...deviceById.values()],
		loadError: null
	};
}
