import { describe, expect, it } from 'vitest';
import { normalizeUplinkWindow } from './ttn.js';

describe('normalizeUplinkWindow', () => {
	it('keeps valid hour windows in the upstream format', () => {
		expect(normalizeUplinkWindow('7h')).toBe('7h');
		expect(normalizeUplinkWindow('2160h')).toBe('2160h');
	});

	it('converts day windows to hours', () => {
		expect(normalizeUplinkWindow('2d')).toBe('48h');
		expect(normalizeUplinkWindow('7d')).toBe('168h');
		expect(normalizeUplinkWindow('90d')).toBe('2160h');
	});

	it('rejects unsupported or excessive windows', () => {
		expect(normalizeUplinkWindow('10m')).toBeNull();
		expect(normalizeUplinkWindow('91d')).toBeNull();
		expect(normalizeUplinkWindow('anything')).toBeNull();
	});
});
