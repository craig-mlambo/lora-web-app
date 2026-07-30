const PAGE_SIZE = 1000;
const MAX_READINGS = 20_000;
const DEFAULT_TIMEZONE = 'Africa/Harare';

/** @param {number} value */
function round(value, digits = 3) {
	const factor = 10 ** digits;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** @param {unknown} value */
function numberOrNull(value) {
	if (value === null || value === undefined || value === '') return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

/** @param {Date} date */
function dateInputValue(date) {
	return date.toISOString().slice(0, 10);
}

/** @param {string} value */
function validDateInput(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** @param {string} value @param {number} days */
function addDays(value, days) {
	const date = new Date(`${value}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return dateInputValue(date);
}

/** @param {string} from @param {string} to */
function inclusiveDays(from, to) {
	return (
		Math.floor(
			(new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000
		) + 1
	);
}

/** @param {string} iso @param {string | null | undefined} timezone */
function localDateKey(iso, timezone) {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone || DEFAULT_TIMEZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(new Date(iso));
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${values.year}-${values.month}-${values.day}`;
	} catch {
		return iso.slice(0, 10);
	}
}

/**
 * @param {App.Locals['supabase']} supabase
 * @param {string} fromIso
 * @param {string} toExclusiveIso
 * @param {string[]} deviceIds
 */
async function fetchReadings(supabase, fromIso, toExclusiveIso, deviceIds) {
	/** @type {any[]} */
	const readings = [];
	let offset = 0;
	let truncated = false;

	while (offset < MAX_READINGS) {
		let query = supabase
			.from('device_readings')
			.select(
				'id, device_id, reading_time, received_at, cumulative_litres, interval_litres, instant_flow_lpm, reverse_flow_litres, remaining_credit_litres, battery_percent, rssi, snr, valve_state, checksum_ok'
			)
			.gte('reading_time', fromIso)
			.lt('reading_time', toExclusiveIso)
			.order('reading_time', { ascending: true })
			.range(offset, offset + PAGE_SIZE - 1);

		if (deviceIds.length > 0) query = query.in('device_id', deviceIds);

		const { data, error } = await query;
		if (error) return { readings: [], truncated: false, error };

		const page = data ?? [];
		readings.push(...page);
		if (page.length < PAGE_SIZE) break;

		offset += PAGE_SIZE;
		if (offset >= MAX_READINGS) truncated = true;
	}

	return { readings, truncated, error: null };
}

/**
 * @param {App.Locals['supabase']} supabase
 * @param {string[]} deviceIds
 * @param {string} beforeIso
 */
async function fetchBaselines(supabase, deviceIds, beforeIso) {
	const results = await Promise.all(
		deviceIds.map((deviceId) =>
			supabase
				.from('device_readings')
				.select('device_id, cumulative_litres, reverse_flow_litres, reading_time')
				.eq('device_id', deviceId)
				.lt('reading_time', beforeIso)
				.order('reading_time', { ascending: false })
				.limit(1)
				.maybeSingle()
		)
	);

	const error = results.find((result) => result.error)?.error ?? null;
	const baselines = new Map(
		results.flatMap((result) => (result.data ? [[result.data.device_id, result.data]] : []))
	);
	return { baselines, error };
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url, parent }) {
	const accessPromise = parent();

	const today = new Date();
	const defaultTo = dateInputValue(today);
	const defaultFrom = dateInputValue(new Date(today.getTime() - 29 * 86_400_000));
	let from = url.searchParams.get('from') ?? defaultFrom;
	let to = url.searchParams.get('to') ?? defaultTo;
	let filterNotice = null;

	if (!validDateInput(from) || !validDateInput(to) || from > to) {
		from = defaultFrom;
		to = defaultTo;
		filterNotice = 'Invalid date range was replaced with the most recent 30 days.';
	}
	if (inclusiveDays(from, to) > 366) {
		from = addDays(to, -365);
		filterNotice = 'Reports are limited to 366 days; the start date was adjusted.';
	}

	const householdId = url.searchParams.get('household') ?? 'all';
	const requestedDeviceId = url.searchParams.get('device') ?? 'all';

	const [, { data: households, error: householdsError }, { data: devices, error: devicesError }] =
		await Promise.all([
			accessPromise,
			locals.supabase
				.from('households')
				.select('id, name, account_number, timezone, status')
				.order('name'),
			locals.supabase
				.from('devices')
				.select(
					'id, household_id, serial_number, ttn_device_id, dev_eui, status, valve_state, last_seen_at'
				)
				.order('serial_number')
		]);

	const setupError = householdsError ?? devicesError;
	if (setupError) {
		return {
			filters: { from, to, householdId: 'all', deviceId: 'all' },
			households: [],
			devices: [],
			report: null,
			loadError: setupError.message,
			filterNotice
		};
	}

	const householdById = new Map((households ?? []).map((household) => [household.id, household]));
	const enrichedDevices = (devices ?? []).map((device) => ({
		...device,
		household: householdById.get(device.household_id) ?? null
	}));
	const validHouseholdId = householdById.has(householdId) ? householdId : 'all';
	const householdDevices =
		validHouseholdId === 'all'
			? enrichedDevices
			: enrichedDevices.filter((device) => device.household_id === validHouseholdId);
	const validDeviceId = householdDevices.some((device) => device.id === requestedDeviceId)
		? requestedDeviceId
		: 'all';
	const reportDevices =
		validDeviceId === 'all'
			? householdDevices
			: householdDevices.filter((device) => device.id === validDeviceId);
	const reportDeviceIds = reportDevices.map((device) => device.id);
	if (url.searchParams.get('run') !== '1') {
		return {
			filters: {
				from,
				to,
				householdId: validHouseholdId,
				deviceId: validDeviceId
			},
			households: households ?? [],
			devices: enrichedDevices,
			report: null,
			loadError: null,
			filterNotice
		};
	}

	// Date inputs are interpreted in the application's Zimbabwe timezone.
	const fromIso = `${from}T00:00:00+02:00`;
	const toExclusiveIso = `${addDays(to, 1)}T00:00:00+02:00`;
	const [{ readings, truncated, error: readingsError }, { baselines, error: baselineError }] =
		reportDeviceIds.length > 0
			? await Promise.all([
					fetchReadings(locals.supabase, fromIso, toExclusiveIso, reportDeviceIds),
					fetchBaselines(locals.supabase, reportDeviceIds, fromIso)
				])
			: [
					{ readings: [], truncated: false, error: null },
					{ baselines: new Map(), error: null }
				];

	const loadError = readingsError ?? baselineError;
	if (loadError) {
		return {
			filters: {
				from,
				to,
				householdId: validHouseholdId,
				deviceId: validDeviceId
			},
			households: households ?? [],
			devices: enrichedDevices,
			report: null,
			loadError: loadError.message,
			filterNotice
		};
	}

	/** @type {Map<string, any[]>} */
	const readingsByDevice = new Map();
	for (const reading of readings) {
		const current = readingsByDevice.get(reading.device_id) ?? [];
		current.push(reading);
		readingsByDevice.set(reading.device_id, current);
	}

	const dayCount = inclusiveDays(from, to);
	const dailyUsage = new Map();
	for (let index = 0; index < dayCount; index += 1) {
		dailyUsage.set(addDays(from, index), 0);
	}

	const householdUsage = new Map();
	/** @type {any[]} */
	const deviceBreakdown = [];
	let totalUsageLitres = 0;
	let meterResetCount = 0;

	for (const device of reportDevices) {
		const deviceReadings = readingsByDevice.get(device.id) ?? [];
		const baseline = baselines.get(device.id);
		let previousCumulative = numberOrNull(baseline?.cumulative_litres);
		let deviceUsage = 0;
		let deviceResets = 0;

		for (const reading of deviceReadings) {
			const cumulative = numberOrNull(reading.cumulative_litres) ?? 0;
			const interval = numberOrNull(reading.interval_litres);
			let consumed = 0;

			if (interval !== null && interval >= 0) {
				consumed = interval;
			} else if (previousCumulative !== null) {
				const delta = cumulative - previousCumulative;
				if (delta >= 0) {
					consumed = delta;
				} else {
					// Treat a lower cumulative value as a meter reset. The new
					// cumulative value represents consumption after the reset.
					consumed = cumulative;
					deviceResets += 1;
				}
			}

			deviceUsage += consumed;
			const day = localDateKey(reading.reading_time, device.household?.timezone);
			dailyUsage.set(day, (dailyUsage.get(day) ?? 0) + consumed);
			previousCumulative = cumulative;
		}

		const flowValues = deviceReadings
			.map((reading) => numberOrNull(reading.instant_flow_lpm))
			.filter((value) => value !== null);
		const latest = deviceReadings.at(-1) ?? null;
		totalUsageLitres += deviceUsage;
		meterResetCount += deviceResets;
		householdUsage.set(
			device.household_id,
			(householdUsage.get(device.household_id) ?? 0) + deviceUsage
		);

		deviceBreakdown.push({
			id: device.id,
			serialNumber: device.serial_number,
			ttnDeviceId: device.ttn_device_id,
			status: device.status,
			householdId: device.household_id,
			householdName: device.household?.name ?? 'Unknown household',
			usageLitres: round(deviceUsage),
			readings: deviceReadings.length,
			averageFlowLpm: round(
				flowValues.length
					? flowValues.reduce((total, value) => total + value, 0) / flowValues.length
					: 0
			),
			peakFlowLpm: round(flowValues.length ? Math.max(...flowValues) : 0),
			latestReadingAt: latest?.reading_time ?? null,
			latestBatteryPercent: numberOrNull(latest?.battery_percent),
			latestRssi: numberOrNull(latest?.rssi),
			meterResets: deviceResets
		});
	}

	deviceBreakdown.sort((a, b) => b.usageLitres - a.usageLitres);
	const daily = [...dailyUsage].map(([day, litres]) => ({
		day,
		litres: round(litres),
		consumption: round(litres / 1000, 6)
	}));
	const peakDay = daily.reduce((peak, day) => (day.litres > peak.litres ? day : peak), {
		day: from,
		litres: 0,
		consumption: 0
	});

	const allFlowValues = readings
		.map((reading) => numberOrNull(reading.instant_flow_lpm))
		.filter((value) => value !== null);
	const allRssiValues = readings
		.map((reading) => numberOrNull(reading.rssi))
		.filter((value) => value !== null);
	const allSnrValues = readings
		.map((reading) => numberOrNull(reading.snr))
		.filter((value) => value !== null);
	const checksumValues = readings
		.map((reading) => reading.checksum_ok)
		.filter((value) => value !== null);
	const checksumPassed = checksumValues.filter(Boolean).length;
	const latestByDevice = reportDevices.flatMap((device) => {
		const latest = (readingsByDevice.get(device.id) ?? []).at(-1);
		return latest ? [{ deviceId: device.id, reading: latest }] : [];
	});
	const lowBatteryDevices = latestByDevice.filter(({ reading }) => {
		const battery = numberOrNull(reading.battery_percent);
		return battery !== null && battery < 20;
	}).length;
	const reverseFlowLitres = reportDevices.reduce((total, device) => {
		const values = (readingsByDevice.get(device.id) ?? [])
			.map((reading) => numberOrNull(reading.reverse_flow_litres))
			.filter((value) => value !== null);
		const baseline = numberOrNull(baselines.get(device.id)?.reverse_flow_litres);
		if (values.length === 0) return total;
		const first = baseline ?? values[0];
		const latest = values.at(-1) ?? first;
		return total + Math.max(0, latest - first);
	}, 0);

	const householdBreakdown = [...householdUsage]
		.map(([id, usageLitres]) => {
			const household = householdById.get(id);
			return {
				id,
				name: household?.name ?? 'Unknown household',
				accountNumber: household?.account_number ?? '',
				usageLitres: round(usageLitres),
				devices: reportDevices.filter((device) => device.household_id === id).length
			};
		})
		.sort((a, b) => b.usageLitres - a.usageLitres);

	return {
		filters: {
			from,
			to,
			householdId: validHouseholdId,
			deviceId: validDeviceId
		},
		households: households ?? [],
		devices: enrichedDevices,
		report: {
			metrics: {
				totalUsageLitres: round(totalUsageLitres),
				averageDailyLitres: round(totalUsageLitres / dayCount),
				peakDailyLitres: peakDay.litres,
				peakDay: peakDay.day,
				readings: readings.length,
				reportingDevices: readingsByDevice.size,
				selectedDevices: reportDevices.length,
				averageFlowLpm: round(
					allFlowValues.length
						? allFlowValues.reduce((total, value) => total + value, 0) / allFlowValues.length
						: 0
				),
				peakFlowLpm: round(allFlowValues.length ? Math.max(...allFlowValues) : 0),
				reverseFlowLitres: round(reverseFlowLitres),
				checksumPassRate: checksumValues.length
					? round((checksumPassed / checksumValues.length) * 100, 1)
					: null,
				averageRssi: allRssiValues.length
					? round(
							allRssiValues.reduce((total, value) => total + value, 0) / allRssiValues.length,
							1
						)
					: null,
				averageSnr: allSnrValues.length
					? round(allSnrValues.reduce((total, value) => total + value, 0) / allSnrValues.length, 1)
					: null,
				lowBatteryDevices,
				meterResetCount
			},
			daily,
			deviceBreakdown,
			householdBreakdown,
			truncated
		},
		loadError: null,
		filterNotice
	};
}
