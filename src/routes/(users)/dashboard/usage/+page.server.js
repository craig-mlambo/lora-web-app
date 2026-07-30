const DAY_MS = 86_400_000;

/** @param {unknown} value */
function number(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** @param {Date} date */
const dateValue = (date) => date.toISOString().slice(0, 10);

/** @param {string} value */
const validDate = (value) =>
	/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** @param {string} value @param {number} days */
function addDays(value, days) {
	const date = new Date(`${value}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return dateValue(date);
}

/** @param {string} from @param {string} to */
const inclusiveDays = (from, to) =>
	Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

/** @param {string} iso */
function dateKey(iso) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Africa/Harare',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(iso));
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent, url }) {
	const { households, householdLoadError } = await parent();
	const today = dateValue(new Date());
	let from = url.searchParams.get('from') ?? addDays(today, -29);
	let to = url.searchParams.get('to') ?? today;
	let filterNotice = null;
	if (!validDate(from) || !validDate(to) || from > to) {
		from = addDays(today, -29);
		to = today;
		filterNotice = 'Invalid dates were replaced with the most recent 30 days.';
	}
	if (inclusiveDays(from, to) > 366) {
		from = addDays(to, -365);
		filterNotice = 'Usage reports are limited to 366 days.';
	}

	if (householdLoadError)
		return {
			households: [],
			devices: [],
			filters: { from, to, householdId: 'all', deviceId: 'all' },
			report: null,
			filterNotice,
			loadError: householdLoadError
		};
	if (households.length === 0)
		return {
			households,
			devices: [],
			filters: { from, to, householdId: 'all', deviceId: 'all' },
			report: null,
			filterNotice,
			loadError: null
		};

	const requestedHousehold = url.searchParams.get('household');
	const householdId = households.some((household) => household.id === requestedHousehold)
		? requestedHousehold
		: 'all';
	const scopedHouseholdIds =
		householdId === 'all' ? households.map((household) => household.id) : [householdId];
	const { data: devices, error: devicesError } = await locals.supabase
		.from('devices')
		.select('id, household_id, serial_number, status')
		.in(
			'household_id',
			households.map((household) => household.id)
		)
		.neq('status', 'retired')
		.order('serial_number');
	if (devicesError)
		return {
			households,
			devices: [],
			filters: { from, to, householdId, deviceId: 'all' },
			report: null,
			filterNotice,
			loadError: devicesError.message
		};

	const availableDevices = (devices ?? []).filter((device) =>
		scopedHouseholdIds.includes(device.household_id)
	);
	const requestedDevice = url.searchParams.get('device');
	const deviceId = availableDevices.some((device) => device.id === requestedDevice)
		? requestedDevice
		: 'all';
	const reportDevices =
		deviceId === 'all'
			? availableDevices
			: availableDevices.filter((device) => device.id === deviceId);
	const reportDeviceIds = reportDevices.map((device) => device.id);
	const enrichedDevices = (devices ?? []).map((device) => ({
		...device,
		household: households.find((household) => household.id === device.household_id) ?? null
	}));
	if (url.searchParams.get('run') !== '1') {
		return {
			households,
			devices: enrichedDevices,
			filters: { from, to, householdId, deviceId },
			report: null,
			filterNotice,
			loadError: null
		};
	}
	const toExclusive = addDays(to, 1);
	const historyFrom = addDays(from, -30);
	const { data: readings, error: readingsError } = reportDeviceIds.length
		? await locals.supabase
				.from('device_readings')
				.select(
					'id, device_id, reading_time, cumulative_litres, interval_litres, instant_flow_lpm, battery_percent, rssi, checksum_ok'
				)
				.in('device_id', reportDeviceIds)
				.gte('reading_time', `${historyFrom}T00:00:00+02:00`)
				.lt('reading_time', `${toExclusive}T00:00:00+02:00`)
				.order('reading_time', { ascending: true })
				.limit(10000)
		: { data: [], error: null };
	if (readingsError)
		return {
			households,
			devices: [],
			filters: { from, to, householdId, deviceId },
			report: null,
			filterNotice,
			loadError: readingsError.message
		};

	const householdById = new Map(households.map((household) => [household.id, household]));
	const deviceById = new Map(reportDevices.map((device) => [device.id, device]));
	const dayUsage = new Map();
	const deviceUsage = new Map(reportDevices.map((device) => [device.id, 0]));
	const householdUsage = new Map(scopedHouseholdIds.map((id) => [id, 0]));
	const previousCumulative = new Map();
	const flowValues = [];
	const reportReadings = [];
	let checksumCount = 0;
	let checksumPass = 0;

	for (const reading of readings ?? []) {
		const currentCumulative = number(reading.cumulative_litres);
		const previous = previousCumulative.get(reading.device_id);
		previousCumulative.set(reading.device_id, currentCumulative);
		const day = dateKey(reading.reading_time);
		if (day < from || day > to) continue;

		const interval =
			reading.interval_litres == null
				? previous == null
					? 0
					: Math.max(0, currentCumulative - previous)
				: Math.max(0, number(reading.interval_litres));
		const device = deviceById.get(reading.device_id);
		if (!device) continue;
		dayUsage.set(day, (dayUsage.get(day) ?? 0) + interval);
		deviceUsage.set(device.id, (deviceUsage.get(device.id) ?? 0) + interval);
		householdUsage.set(
			device.household_id,
			(householdUsage.get(device.household_id) ?? 0) + interval
		);
		reportReadings.push(reading);
		if (reading.instant_flow_lpm != null) flowValues.push(number(reading.instant_flow_lpm));
		if (reading.checksum_ok != null) {
			checksumCount += 1;
			if (reading.checksum_ok) checksumPass += 1;
		}
	}

	const daily = [];
	for (let day = from; day <= to; day = addDays(day, 1)) {
		daily.push({ day, consumption: (dayUsage.get(day) ?? 0) / 1000 });
	}
	const totalLitres = [...dayUsage.values()].reduce((total, value) => total + value, 0);
	const peakDay = daily.reduce(
		(peak, day) => (day.consumption > peak.consumption ? day : peak),
		daily[0] ?? { day: from, consumption: 0 }
	);
	const latestByDevice = new Map();
	for (const reading of reportReadings) latestByDevice.set(reading.device_id, reading);

	return {
		households,
		devices: (devices ?? []).map((device) => ({
			...device,
			household: householdById.get(device.household_id) ?? null
		})),
		filters: { from, to, householdId, deviceId },
		report: {
			daily,
			totalLitres,
			averageDailyLitres: totalLitres / inclusiveDays(from, to),
			peakDay,
			readingCount: reportReadings.length,
			averageFlowLpm: flowValues.length
				? flowValues.reduce((total, value) => total + value, 0) / flowValues.length
				: 0,
			peakFlowLpm: flowValues.length ? Math.max(...flowValues) : 0,
			checksumPassRate: checksumCount ? (checksumPass / checksumCount) * 100 : null,
			lowBatteryMeters: [...latestByDevice.values()].filter(
				(reading) => reading.battery_percent != null && number(reading.battery_percent) < 20
			).length,
			households: [...householdUsage.entries()]
				.map(([id, litres]) => ({ ...householdById.get(id), usageLitres: litres }))
				.sort((a, b) => b.usageLitres - a.usageLitres),
			devices: reportDevices
				.map((device) => ({
					...device,
					household: householdById.get(device.household_id) ?? null,
					usageLitres: deviceUsage.get(device.id) ?? 0,
					latest: latestByDevice.get(device.id) ?? null
				}))
				.sort((a, b) => b.usageLitres - a.usageLitres)
		},
		filterNotice,
		loadError: null
	};
}
