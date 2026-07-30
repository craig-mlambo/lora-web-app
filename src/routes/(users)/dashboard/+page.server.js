/** @param {unknown} value */
const number = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

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
export async function load({ locals, parent }) {
	const { households, householdLoadError } = await parent();
	const householdError = householdLoadError;
	if (householdError) {
		return {
			households: [],
			meters: [],
			readings: [],
			chart: [],
			summary: null,
			alerts: [],
			loadError: householdError
		};
	}

	const householdIds = households.map((household) => household.id);
	if (householdIds.length === 0) {
		return {
			households,
			meters: [],
			readings: [],
			chart: [],
			summary: {
				todayLitres: 0,
				monthLitres: 0,
				activeMeters: 0,
				totalMeters: 0,
				remainingCreditLitres: 0
			},
			alerts: [],
			loadError: null
		};
	}

	const [{ data: devices, error: devicesError }, { data: accounts, error: accountsError }] =
		await Promise.all([
			locals.supabase
				.from('devices')
				.select('id, household_id, serial_number, ttn_device_id, status, valve_state, last_seen_at')
				.in('household_id', householdIds)
				.neq('status', 'retired')
				.order('serial_number'),
			locals.supabase
				.from('prepaid_accounts')
				.select('id, household_id, status, currency, low_balance_threshold_litres')
				.in('household_id', householdIds)
		]);

	const setupError = devicesError ?? accountsError;
	if (setupError) {
		return {
			households,
			meters: [],
			readings: [],
			chart: [],
			summary: null,
			alerts: [],
			loadError: setupError.message
		};
	}

	const deviceIds = (devices ?? []).map((device) => device.id);
	const monthStart = new Date();
	monthStart.setDate(1);
	monthStart.setHours(0, 0, 0, 0);
	const { data: readings, error: readingsError } = deviceIds.length
		? await locals.supabase
				.from('device_readings')
				.select(
					'id, device_id, frame_counter, reading_time, cumulative_litres, interval_litres, instant_flow_lpm, remaining_credit_litres, battery_percent, rssi, snr, valve_state, checksum_ok'
				)
				.in('device_id', deviceIds)
				.gte('reading_time', monthStart.toISOString())
				.order('reading_time', { ascending: true })
				.limit(3000)
		: { data: [], error: null };
	if (readingsError) {
		return {
			households,
			meters: [],
			readings: [],
			chart: [],
			summary: null,
			alerts: [],
			loadError: readingsError.message
		};
	}

	const householdById = new Map(households.map((household) => [household.id, household]));
	/** @type {Map<string, any[]>} */
	const readingsByDevice = new Map();
	for (const reading of readings ?? []) {
		const current = readingsByDevice.get(reading.device_id) ?? [];
		current.push(reading);
		readingsByDevice.set(reading.device_id, current);
	}

	const today = dateKey(new Date().toISOString());
	const dailyLitres = new Map();
	let todayLitres = 0;
	let monthLitres = 0;
	for (const reading of readings ?? []) {
		const litres = Math.max(0, number(reading.interval_litres));
		const day = dateKey(reading.reading_time);
		dailyLitres.set(day, (dailyLitres.get(day) ?? 0) + litres);
		monthLitres += litres;
		if (day === today) todayLitres += litres;
	}

	/** @type {any[]} */
	const latestReadings = [];
	const meters = (devices ?? []).map((device) => {
		const deviceReadings = readingsByDevice.get(device.id) ?? [];
		const latest = deviceReadings.at(-1) ?? null;
		if (latest) latestReadings.push({ ...latest, device });
		const signal =
			latest?.rssi == null
				? 0
				: Math.max(0, Math.min(100, Math.round((number(latest.rssi) + 120) * 2)));
		return {
			id: device.id,
			household: householdById.get(device.household_id)?.name ?? 'Household',
			serial: device.serial_number,
			ttnDeviceId: device.ttn_device_id ?? '',
			status: device.status,
			cumulative: number(latest?.cumulative_litres) / 1000,
			todayUsage:
				deviceReadings
					.filter((reading) => dateKey(reading.reading_time) === today)
					.reduce((total, reading) => total + Math.max(0, number(reading.interval_litres)), 0) /
				1000,
			battery: number(latest?.battery_percent),
			signal,
			lastSeen:
				latest?.reading_time ??
				device.last_seen_at ??
				deviceReadings.at(-1)?.reading_time ??
				new Date(0).toISOString(),
			checksumOk: latest?.checksum_ok !== false,
			spark: deviceReadings
				.slice(-12)
				.map((reading) => Math.max(0, number(reading.interval_litres) / 1000))
		};
	});

	const accountByHousehold = new Map(
		(accounts ?? []).map((account) => [account.household_id, account])
	);
	const remainingCreditLitres = latestReadings.reduce(
		(total, reading) => total + Math.max(0, number(reading.remaining_credit_litres)),
		0
	);
	const alerts = [];
	for (const meter of meters) {
		if (meter.status === 'faulty')
			alerts.push({
				severity: 'critical',
				title: 'Meter needs attention',
				detail: `${meter.serial} is marked faulty.`,
				meter: meter.serial
			});
		if (meter.battery > 0 && meter.battery < 20)
			alerts.push({
				severity: 'warning',
				title: 'Low meter battery',
				detail: `Battery is at ${meter.battery}%.`,
				meter: meter.serial
			});
		if (!meter.checksumOk)
			alerts.push({
				severity: 'warning',
				title: 'Reading integrity warning',
				detail: 'The latest checksum failed.',
				meter: meter.serial
			});
	}
	for (const household of households) {
		const account = accountByHousehold.get(household.id);
		const householdLatest = latestReadings.filter(
			(reading) => reading.device.household_id === household.id
		);
		const balance = householdLatest.reduce(
			(total, reading) => total + Math.max(0, number(reading.remaining_credit_litres)),
			0
		);
		if (account && balance <= number(account.low_balance_threshold_litres)) {
			alerts.push({
				severity: 'warning',
				title: 'Low water credit',
				detail: `${household.name} has approximately ${balance.toFixed(0)} L remaining.`,
				meter: household.account_number
			});
		}
	}

	return {
		households,
		meters,
		readings: latestReadings
			.sort((a, b) => new Date(b.reading_time).getTime() - new Date(a.reading_time).getTime())
			.slice(0, 10),
		chart: [...dailyLitres.entries()].map(([day, litres]) => ({ day, consumption: litres / 1000 })),
		summary: {
			todayLitres,
			monthLitres,
			activeMeters: meters.filter((meter) => meter.status === 'active').length,
			totalMeters: meters.length,
			remainingCreditLitres
		},
		alerts: alerts.slice(0, 6),
		loadError: null
	};
}
