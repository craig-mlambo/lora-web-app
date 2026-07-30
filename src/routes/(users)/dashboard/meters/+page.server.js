/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const { households, householdLoadError } = await parent();
	if (householdLoadError || households.length === 0)
		return { households, meters: [], loadError: householdLoadError };

	const householdIds = households.map((household) => household.id);
	const { data: devices, error: devicesError } = await locals.supabase
		.from('devices')
		.select(
			'id, household_id, serial_number, ttn_device_id, dev_eui, manufacturer, model, firmware_version, status, valve_state, installed_at, last_seen_at'
		)
		.in('household_id', householdIds)
		.neq('status', 'retired')
		.order('serial_number');
	if (devicesError) return { households, meters: [], loadError: devicesError.message };

	const deviceIds = (devices ?? []).map((device) => device.id);
	const { data: readings, error: readingsError } = deviceIds.length
		? await locals.supabase
				.from('device_readings')
				.select(
					'id, device_id, reading_time, cumulative_litres, interval_litres, instant_flow_lpm, remaining_credit_litres, battery_percent, rssi, snr, valve_state, checksum_ok'
				)
				.in('device_id', deviceIds)
				.order('reading_time', { ascending: false })
				.limit(1000)
		: { data: [], error: null };
	if (readingsError) return { households, meters: [], loadError: readingsError.message };

	const latestByDevice = new Map();
	for (const reading of readings ?? []) {
		if (!latestByDevice.has(reading.device_id)) latestByDevice.set(reading.device_id, reading);
	}
	const householdById = new Map(households.map((household) => [household.id, household]));
	return {
		households,
		meters: (devices ?? []).map((device) => ({
			...device,
			household: householdById.get(device.household_id) ?? null,
			latest: latestByDevice.get(device.id) ?? null
		})),
		loadError: null
	};
}
