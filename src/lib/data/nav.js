/** Sidebar navigation configs for each role. */

/**
 * @typedef {'/dashboard' | '/dashboard/households' | '/dashboard/meters' | '/dashboard/usage' | '/dashboard/payments' | '/dashboard/readings' | '/dashboard/settings' | '/admin' | '/admin/users' | '/admin/households' | '/admin/devices' | '/admin/accounts' | '/admin/tariffs' | '/admin/payments' | '/admin/readings' | '/admin/reports' | '/admin/live' | '/admin/ingestion'} DashboardHref
 * @typedef {{label:string, href:DashboardHref, icon:string, badge?:number}} NavItem
 */

/** @type {NavItem[]} */
export const ownerNav = [
	{ label: 'Overview', href: '/dashboard', icon: 'grid' },
	{ label: 'Households', href: '/dashboard/households', icon: 'home' },
	{ label: 'My meters', href: '/dashboard/meters', icon: 'gauge' },
	{ label: 'Usage', href: '/dashboard/usage', icon: 'chart' },
	{ label: 'Payments & credit', href: '/dashboard/payments', icon: 'drop' },
	{ label: 'Readings', href: '/dashboard/readings', icon: 'activity' },
	{ label: 'Profile', href: '/dashboard/settings', icon: 'settings' }
];

/** @type {NavItem[]} */
export const adminNav = [
	{ label: 'Overview', href: '/admin', icon: 'grid' },
	{ label: 'Users', href: '/admin/users', icon: 'user' },
	{ label: 'Households', href: '/admin/households', icon: 'home' },
	{ label: 'Devices', href: '/admin/devices', icon: 'gauge' },
	{ label: 'Prepaid accounts', href: '/admin/accounts', icon: 'drop' },
	{ label: 'Tariffs', href: '/admin/tariffs', icon: 'chart' },
	{ label: 'Payments', href: '/admin/payments', icon: 'activity' },
	{ label: 'Readings', href: '/admin/readings', icon: 'chart' },
	{ label: 'Reports', href: '/admin/reports', icon: 'chart' },
	{ label: 'Live data', href: '/admin/live', icon: 'activity' },
	{ label: 'Ingestion', href: '/admin/ingestion', icon: 'signal', badge: 3 }
];
