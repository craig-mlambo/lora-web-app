import { describe, expect, it } from 'vitest';
import {
	ADMIN_ROLE_ID,
	dashboardPathForProfile,
	isAdminRoleRows,
	roleCodesFromRows,
	rolesFromRows
} from './roles.js';

describe('role authorization', () => {
	it('recognizes admin access by the fixed role id', () => {
		const rows = [{ role_id: ADMIN_ROLE_ID, user_roles: { id: ADMIN_ROLE_ID, code: 'operator' } }];

		expect(isAdminRoleRows(rows)).toBe(true);
		expect(dashboardPathForProfile({ roleIds: [ADMIN_ROLE_ID], roles: ['operator'] })).toBe(
			'/admin'
		);
	});

	it('recognizes admin access by code and normalizes relation arrays', () => {
		const rows = [{ role_id: 'another-id', user_roles: [{ id: 'another-id', code: 'admin' }] }];

		expect(roleCodesFromRows(rows)).toEqual(['admin']);
		expect(rolesFromRows(rows)).toEqual([{ id: 'another-id', code: 'admin' }]);
		expect(isAdminRoleRows(rows)).toBe(true);
	});

	it('routes every non-admin profile to the user dashboard', () => {
		expect(dashboardPathForProfile({ roleIds: ['owner-id'], roles: ['house-owner'] })).toBe(
			'/dashboard'
		);
	});

	it('routes an unapproved profile to the approval status page', () => {
		expect(
			dashboardPathForProfile({
				account_status: 'invited',
				roleIds: [ADMIN_ROLE_ID],
				roles: ['admin']
			})
		).toBe('/pending-approval');
	});
});
