/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent, url }) {
	const { households, householdLoadError } = await parent();
	if (householdLoadError || households.length === 0)
		return {
			households,
			devices: [],
			readings: [],
			filters: { householdId: 'all', deviceId: 'all' },
			loadError: householdLoadError
		};

	const householdIds = households.map((household) => household.id);
	const { data: devices, error: devicesError } = await locals.supabase
		.from('devices')
		.select('id, household_id, serial_number, ttn_device_id')
		.in('household_id', householdIds)
		.neq('status', 'retired')
		.order('serial_number');
	if (devicesError)
		return {
			households,
			devices: [],
			readings: [],
			filters: { householdId: 'all', deviceId: 'all' },
			loadError: devicesError.message
		};

	const householdId = households.some(
		(household) => household.id === url.searchParams.get('household')
	)
		? url.searchParams.get('household')
		: 'all';
	const eligibleDevices =
		householdId === 'all'
			? (devices ?? [])
			: (devices ?? []).filter((device) => device.household_id === householdId);
	const requestedDevice = url.searchParams.get('device');
	const deviceId = eligibleDevices.some((device) => device.id === requestedDevice)
		? requestedDevice
		: 'all';
	const queryIds = deviceId === 'all' ? eligibleDevices.map((device) => device.id) : [deviceId];
	const { data: readings, error: readingsError } = queryIds.length
		? await locals.supabase
				.from('device_readings')
				.select(
					'id, device_id, frame_counter, reading_time, received_at, cumulative_litres, interval_litres, instant_flow_lpm, remaining_credit_litres, battery_percent, rssi, snr, valve_state, checksum_ok'
				)
				.in('device_id', queryIds)
				.order('reading_time', { ascending: false })
				.limit(250)
		: { data: [], error: null };

	const householdById = new Map(households.map((household) => [household.id, household]));
	const deviceById = new Map(
		(devices ?? []).map((device) => [
			device.id,
			{ ...device, household: householdById.get(device.household_id) ?? null }
		])
	);
	return {
		households,
		devices: [...deviceById.values()],
		readings: (readings ?? []).map((reading) => ({
			...reading,
			device: deviceById.get(reading.device_id) ?? null
		})),
		filters: { householdId, deviceId },
		loadError: readingsError?.message ?? null
	};
}
