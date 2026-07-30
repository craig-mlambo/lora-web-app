/** Formatting helpers shared across dashboard components. */

/** @param {number} n @param {number} [digits] */
export function m3(n, digits = 2) {
	return `${n.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits })} m³`;
}

/**
 * Relative "time ago" from an ISO string, referenced to the demo "now".
 * @param {string} iso
 * @param {Date} [now]
 */
export function timeAgo(iso, now = new Date()) {
	const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
	if (diff < 60) return 'just now';
	const mins = Math.round(diff / 60);
	if (mins < 60) return `${mins} min ago`;
	const hrs = Math.round(mins / 60);
	if (hrs < 24) return `${hrs} h ago`;
	const days = Math.round(hrs / 24);
	return `${days} d ago`;
}

/** @param {string} iso */
export function shortTime(iso) {
	return new Date(iso).toLocaleString('en', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
