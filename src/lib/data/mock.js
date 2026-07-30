/**
 * Mock owner-dashboard data.
 *
 * Shapes mirror the `devices` / `readings` / `daily_consumption` tables in
 * system-design.md so these can later be swapped for real Supabase `load`
 * results without touching the components.
 */

/**
 * @typedef {Object} Meter
 * @property {string} id
 * @property {string} serial            Decoded CJ/T 188 serial
 * @property {string} ttnDeviceId
 * @property {string} household         House / address label
 * @property {'active'|'inactive'|'faulty'} status
 * @property {number} cumulative        Latest cumulative flow (m³)
 * @property {number} todayUsage        Today's consumption (m³)
 * @property {number} battery           Battery %
 * @property {number} signal            Signal quality 0-100 (from rssi/snr)
 * @property {string} lastSeen          ISO timestamp of last uplink
 * @property {boolean} checksumOk
 * @property {number[]} spark           Last 7 days consumption, for sparkline
 */

/** @type {Meter[]} */
export const meters = [
	{
		id: 'd-2401',
		serial: '25033150000240',
		ttnDeviceId: 'lye-yellow-device-5000240',
		household: '14 Acacia Street',
		status: 'active',
		cumulative: 482.16,
		todayUsage: 0.312,
		battery: 88,
		signal: 76,
		lastSeen: '2026-07-14T08:10:41',
		checksumOk: true,
		spark: [0.28, 0.31, 0.26, 0.4, 0.35, 0.29, 0.31]
	},
	{
		id: 'd-2402',
		serial: '25033150000318',
		ttnDeviceId: 'lye-yellow-device-5000318',
		household: '7 Marula Close',
		status: 'active',
		cumulative: 1290.74,
		todayUsage: 0.845,
		battery: 64,
		signal: 52,
		lastSeen: '2026-07-14T07:52:03',
		checksumOk: true,
		spark: [0.7, 0.9, 1.1, 0.8, 0.95, 0.6, 0.85]
	},
	{
		id: 'd-2403',
		serial: '25033150000415',
		ttnDeviceId: 'lye-yellow-device-5000415',
		household: '22 Baobab Avenue',
		status: 'faulty',
		cumulative: 96.02,
		todayUsage: 0,
		battery: 19,
		signal: 24,
		lastSeen: '2026-07-11T23:41:12',
		checksumOk: false,
		spark: [0.2, 0.18, 0.15, 0.0, 0.0, 0.0, 0.0]
	}
];

/** Daily consumption for the primary meter — 30 days (from `daily_consumption`). */
export const dailyConsumption = [
	0.29, 0.34, 0.31, 0.27, 0.42, 0.38, 0.3, 0.33, 0.36, 0.4, 0.28, 0.31, 0.45,
	0.52, 0.39, 0.35, 0.3, 0.33, 0.29, 0.41, 0.37, 0.44, 0.48, 0.36, 0.32, 0.3,
	0.35, 0.38, 0.34, 0.31
].map((value, i) => ({
	day: new Date(2026, 5, 15 + i).toISOString().slice(0, 10),
	consumption: value
}));

/** @type {{id:string, meter:string, severity:'critical'|'warning'|'info', title:string, detail:string, time:string}[]} */
export const alerts = [
	{
		id: 'a1',
		meter: '22 Baobab Avenue',
		severity: 'critical',
		title: 'Meter offline',
		detail: 'No uplink received for 62 hours. Last checksum failed.',
		time: '2026-07-12T00:10:00'
	},
	{
		id: 'a2',
		meter: '22 Baobab Avenue',
		severity: 'warning',
		title: 'Low battery',
		detail: 'Battery at 19% — schedule a replacement visit.',
		time: '2026-07-13T09:22:00'
	},
	{
		id: 'a3',
		meter: '7 Marula Close',
		severity: 'info',
		title: 'Higher than usual usage',
		detail: "Today's usage is 34% above your 7-day average.",
		time: '2026-07-14T06:40:00'
	}
];

/** Recent decoded readings (from `readings`). */
export const recentReadings = [
	{
		time: '2026-07-14T08:10:41',
		meter: '14 Acacia Street',
		cumulative: 482.16,
		instant: 0.0,
		fcnt: 215,
		checksumOk: true
	},
	{
		time: '2026-07-14T07:52:03',
		meter: '7 Marula Close',
		cumulative: 1290.74,
		instant: 0.12,
		fcnt: 4021,
		checksumOk: true
	},
	{
		time: '2026-07-14T07:09:58',
		meter: '14 Acacia Street',
		cumulative: 482.11,
		instant: 0.0,
		fcnt: 214,
		checksumOk: true
	},
	{
		time: '2026-07-14T06:40:19',
		meter: '7 Marula Close',
		cumulative: 1290.62,
		instant: 0.31,
		fcnt: 4020,
		checksumOk: true
	},
	{
		time: '2026-07-11T23:41:12',
		meter: '22 Baobab Avenue',
		cumulative: 96.02,
		instant: 0.0,
		fcnt: 880,
		checksumOk: false
	}
];

export const owner = {
	name: 'Thandiwe Moyo',
	email: 'thandiwe@example.com',
	initials: 'TM'
};

/** Derived summary tiles for the top of the dashboard. */
export const summary = {
	todayUsage: meters.reduce((s, m) => s + m.todayUsage, 0),
	monthToDate: 9.84,
	activeMeters: meters.filter((m) => m.status === 'active').length,
	totalMeters: meters.length,
	openAlerts: alerts.filter((a) => a.severity !== 'info').length
};
