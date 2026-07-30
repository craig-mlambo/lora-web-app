/**
 * Mock admin-console data. Shapes mirror the `profiles` / `households` /
 * `devices` / `readings` tables in system-design.md so these can be swapped
 * for real Supabase queries later.
 */

export const adminUser = {
	name: 'Craig Mlambo',
	email: 'craig.admin@lye.co',
	initials: 'SN'
};

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {'admin'|'owner'} role
 * @property {'active'|'invited'|'disabled'} status
 * @property {number} households
 * @property {string} lastActive
 */

/** @type {User[]} */
export const users = [
	{ id: 'u1', name: 'Sipho Ndlovu', email: 'sipho.admin@lye.co', role: 'admin', status: 'active', households: 0, lastActive: '2026-07-15T07:40:00' },
	{ id: 'u2', name: 'Thandiwe Moyo', email: 'thandiwe@example.com', role: 'owner', status: 'active', households: 3, lastActive: '2026-07-15T06:12:00' },
	{ id: 'u3', name: 'Farai Chikera', email: 'farai@example.com', role: 'owner', status: 'active', households: 1, lastActive: '2026-07-14T18:03:00' },
	{ id: 'u4', name: 'Nomsa Dube', email: 'nomsa@example.com', role: 'owner', status: 'invited', households: 0, lastActive: '' },
	{ id: 'u5', name: 'Blessing Ncube', email: 'blessing@example.com', role: 'owner', status: 'disabled', households: 1, lastActive: '2026-06-30T09:20:00' }
];

/**
 * @typedef {Object} Household
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {string} accountNumber
 * @property {string|null} owner
 * @property {string|null} meterSerial    Assigned meter serial, or null
 * @property {string} createdAt
 */

/** @type {Household[]} */
export const households = [
	{ id: 'h1', name: 'Acacia Residence', address: '14 Acacia Street', accountNumber: 'ACC-100240', owner: 'Thandiwe Moyo', meterSerial: '25033150000240', createdAt: '2026-03-02' },
	{ id: 'h2', name: 'Marula House', address: '7 Marula Close', accountNumber: 'ACC-100318', owner: 'Thandiwe Moyo', meterSerial: '25033150000318', createdAt: '2026-03-02' },
	{ id: 'h3', name: 'Baobab Villa', address: '22 Baobab Avenue', accountNumber: 'ACC-100415', owner: 'Thandiwe Moyo', meterSerial: '25033150000415', createdAt: '2026-03-05' },
	{ id: 'h4', name: 'Msasa Cottage', address: '3 Msasa Lane', accountNumber: 'ACC-100501', owner: 'Farai Chikera', meterSerial: null, createdAt: '2026-05-11' },
	{ id: 'h5', name: 'Jacaranda Flat 2B', address: '2B Jacaranda Court', accountNumber: 'ACC-100566', owner: null, meterSerial: null, createdAt: '2026-06-20' }
];

/**
 * @typedef {Object} Device
 * @property {string} id
 * @property {string} ttnDeviceId
 * @property {string} devEui
 * @property {string} serial
 * @property {string|null} household     Assigned household address, or null
 * @property {'active'|'inactive'|'faulty'} status
 * @property {number} battery
 * @property {number} signal
 * @property {string} lastSeen
 */

/** @type {Device[]} */
export const devices = [
	{ id: 'd1', ttnDeviceId: 'lye-yellow-device-5000240', devEui: '70B3D57ED0050240', serial: '25033150000240', household: '14 Acacia Street', status: 'active', battery: 88, signal: 76, lastSeen: '2026-07-15T08:10:41' },
	{ id: 'd2', ttnDeviceId: 'lye-yellow-device-5000318', devEui: '70B3D57ED0050318', serial: '25033150000318', household: '7 Marula Close', status: 'active', battery: 64, signal: 52, lastSeen: '2026-07-15T07:52:03' },
	{ id: 'd3', ttnDeviceId: 'lye-yellow-device-5000415', devEui: '70B3D57ED0050415', serial: '25033150000415', household: '22 Baobab Avenue', status: 'faulty', battery: 19, signal: 24, lastSeen: '2026-07-12T23:41:12' },
	{ id: 'd4', ttnDeviceId: 'lye-yellow-device-5000587', devEui: '70B3D57ED0050587', serial: '25033150000587', household: null, status: 'inactive', battery: 100, signal: 61, lastSeen: '2026-07-15T05:15:00' },
	{ id: 'd5', ttnDeviceId: 'lye-yellow-device-5000602', devEui: '70B3D57ED0050602', serial: '25033150000602', household: null, status: 'inactive', battery: 97, signal: 48, lastSeen: '2026-07-14T22:31:00' }
];

/** Devices sending uplinks but not yet registered (from ingestion §4.1 step 3). */
export const unknownDevices = [
	{ ttnDeviceId: 'lye-yellow-device-5000711', devEui: '70B3D57ED0050711', uplinks: 42, firstSeen: '2026-07-14T11:02:00', lastSeen: '2026-07-15T08:04:00' },
	{ ttnDeviceId: 'lye-yellow-device-5000712', devEui: '70B3D57ED0050712', uplinks: 17, firstSeen: '2026-07-14T19:44:00', lastSeen: '2026-07-15T07:58:00' },
	{ ttnDeviceId: 'lye-green-device-4000090', devEui: '70B3D57ED0040090', uplinks: 5, firstSeen: '2026-07-15T02:15:00', lastSeen: '2026-07-15T06:20:00' }
];

/** Meters with no uplink in > 48h. */
export const staleMeters = [
	{ serial: '25033150000415', household: '22 Baobab Avenue', lastSeen: '2026-07-12T23:41:12', gapHours: 56 }
];

/** Cross-device readings feed for the admin browse view. */
export const adminReadings = [
	{ time: '2026-07-15T08:10:41', device: 'lye-...5000240', household: '14 Acacia Street', cumulative: 482.16, instant: 0.0, fcnt: 215, rssi: -74, checksumOk: true },
	{ time: '2026-07-15T07:58:00', device: 'lye-...5000711', household: '— unknown —', cumulative: 3.02, instant: 0.0, fcnt: 42, rssi: -96, checksumOk: true },
	{ time: '2026-07-15T07:52:03', device: 'lye-...5000318', household: '7 Marula Close', cumulative: 1290.74, instant: 0.12, fcnt: 4021, rssi: -81, checksumOk: true },
	{ time: '2026-07-15T07:09:58', device: 'lye-...5000240', household: '14 Acacia Street', cumulative: 482.11, instant: 0.0, fcnt: 214, rssi: -75, checksumOk: true },
	{ time: '2026-07-15T06:40:19', device: 'lye-...5000318', household: '7 Marula Close', cumulative: 1290.62, instant: 0.31, fcnt: 4020, rssi: -83, checksumOk: true },
	{ time: '2026-07-12T23:41:12', device: 'lye-...5000415', household: '22 Baobab Avenue', cumulative: 96.02, instant: 0.0, fcnt: 880, rssi: -104, checksumOk: false }
];

/** Uplinks per hour over the last 24h (for the ingestion throughput chart). */
export const uplinksPerHour = [
	3810, 3625, 3402, 3190, 3050, 2980, 3120, 3480, 4021, 4560, 4880, 5010,
	4990, 4870, 4760, 4810, 4900, 5020, 4780, 4300, 4020, 3900, 3820, 3760
];

export const ingestion = {
	webhookConnected: true,
	tokenConfigured: true,
	lastEvent: '2026-07-15T08:10:41',
	uplinks24h: 98240,
	unknownCount: unknownDevices.length,
	checksumFailRate: 0.4, // %
	staleCount: staleMeters.length,
	avgLatencyMs: 180
};

/** Recent admin activity feed for the overview page. */
export const activity = [
	{ id: 'ac1', who: 'Sipho Ndlovu', action: 'triggered a 720h backfill for', target: 'lye-...5000240', time: '2026-07-15T07:30:00' },
	{ id: 'ac2', who: 'System', action: 'auto-registered unknown device', target: 'lye-...5000587', time: '2026-07-15T05:15:00' },
	{ id: 'ac3', who: 'Sipho Ndlovu', action: 'assigned a meter to', target: '3 Msasa Lane', time: '2026-07-14T16:02:00' },
	{ id: 'ac4', who: 'Sipho Ndlovu', action: 'invited owner', target: 'nomsa@example.com', time: '2026-07-14T12:20:00' }
];

export const adminSummary = {
	households: households.length,
	registeredMeters: devices.length,
	activeOwners: users.filter((u) => u.role === 'owner' && u.status === 'active').length,
	unassignedMeters: devices.filter((d) => !d.household).length,
	unknownDevices: unknownDevices.length
};
