<script>
	/**
	 * Lightweight inline icon set (24×24, stroke = currentColor).
	 * @typedef {Object} Props
	 * @property {string} name
	 * @property {number} [size]
	 * @property {string} [class]
	 */

	/** @type {Props} */
	let { name, size = 20, class: klass = '' } = $props();

	/** @type {Record<string, string>} */
	const paths = {
		grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
		gauge: 'M12 13l4-4M3 12a9 9 0 0 1 18 0M6.5 18a9 9 0 0 1 11 0',
		chart: 'M4 19V5M4 19h16M8 16l3-4 3 2 4-6',
		bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0',
		settings:
			'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L16 3H8l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 3 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L8 21h8l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
		search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
		drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
		battery: 'M4 8h13v8H4zM17 11h3v2h-3M7 11v2',
		signal: 'M4 20v-4M9 20v-8M14 20v-12M19 20V4',
		check: 'M20 6L9 17l-5-5',
		alert: 'M12 9v4M12 17h.01M10.3 4l-8 14A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.2l-8-14a1.5 1.5 0 0 0-2.6 0z',
		logout: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H3',
		menu: 'M4 6h16M4 12h16M4 18h16',
		user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
		mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
		lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z',
		eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
		'eye-off': 'M17.9 17.9A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.2-5.2m3-1.5A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3M3 3l18 18',
		arrow: 'M5 12h14M13 6l6 6-6 6',
		clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
		home: 'M4 11l8-7 8 7M6 10v10h12V10',
		droplets: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
		close: 'M6 6l12 12M18 6L6 18',
		plus: 'M12 5v14M5 12h14',
		edit: 'M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4',
		trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
		refresh: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M18 4v5h-5M6 20v-5h5',
		filter: 'M3 5h18l-7 8v6l-4-2v-4z',
		link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 1 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 1 0 6 6l1-1',
		dots: 'M12 6h.01M12 12h.01M12 18h.01',
		external: 'M14 4h6v6M20 4l-8 8M18 14v5H5V6h5',
		webhook:
			'M8 12a4 4 0 1 1 5 3.8M15.5 13a4 4 0 1 1-3.5 6M8.5 12a4 4 0 1 0 .5 8h6',
		zap: 'M13 3L4 14h7l-1 7 9-11h-7z',
		users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 20a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M18 20a7 7 0 0 0-4-6.3',
		activity: 'M3 12h4l3 8 4-16 3 8h4',
		chevron: 'M9 6l6 6-6 6'
	};
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={klass}
	aria-hidden="true"
>
	<path d={paths[name] ?? ''} />
</svg>
