import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/authorization.js';
import { isAdminRoleRows, roleCodesFromRows, rolesFromRows } from '$lib/utils/roles.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, parent }) {
	const [
		,
		{ data: profiles, error: profilesError },
		{ data: availableRoles, error: rolesError },
		{ data: households, error: householdsError },
		{ data: memberships, error: membershipsError },
		{ data: devices, error: devicesError },
		{ data: prepaidAccounts, error: accountsError }
	] = await Promise.all([
		parent(),
		locals.supabase
			.from('profiles')
			.select(
				`
				id,
				full_name,
				phone,
				account_status,
				approval_status,
				avatar_url,
				preferred_language,
				created_at,
				updated_at,
				profile_roles:profile_roles!profile_roles_profile_id_fkey(
					role_id,
					assigned_at,
					user_roles(id, code, name)
				)
				`
			)
			.order('created_at', { ascending: false })
			.limit(250),
		locals.supabase.from('user_roles').select('id, code, name, description').order('name'),
		locals.supabase
			.from('households')
			.select(
				'id, owner_profile_id, account_number, name, address_line_1, city, province, status, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(500),
		locals.supabase
			.from('household_members')
			.select('household_id, profile_id, access_level, relationship, status, joined_at')
			.limit(2000),
		locals.supabase
			.from('devices')
			.select(
				'id, household_id, assigned_profile_id, registered_by_profile_id, serial_number, manufacturer, model, status, valve_state, installed_at, last_seen_at'
			)
			.order('created_at', { ascending: false })
			.limit(1000),
		locals.supabase
			.from('prepaid_accounts')
			.select('id, household_id, currency, low_balance_threshold_litres, status, opened_at')
			.limit(500)
	]);

	const loadError =
		profilesError ??
		rolesError ??
		householdsError ??
		membershipsError ??
		devicesError ??
		accountsError;
	if (loadError) {
		console.error('Unable to load user administration data.', loadError);
		return { users: [], availableRoles: [], loadError: 'Accounts could not be loaded.' };
	}

	const householdById = new Map((households ?? []).map((household) => [household.id, household]));
	const accountByHousehold = new Map(
		(prepaidAccounts ?? []).map((account) => [account.household_id, account])
	);
	/** @type {Map<string, any[]>} */
	const membershipsByProfile = new Map();
	for (const membership of memberships ?? []) {
		const current = membershipsByProfile.get(membership.profile_id) ?? [];
		current.push({
			...membership,
			household: householdById.get(membership.household_id) ?? null,
			prepaidAccount: accountByHousehold.get(membership.household_id) ?? null
		});
		membershipsByProfile.set(membership.profile_id, current);
	}

	/** @type {Map<string, any[]>} */
	const ownedHouseholdsByProfile = new Map();
	for (const household of households ?? []) {
		const current = ownedHouseholdsByProfile.get(household.owner_profile_id) ?? [];
		current.push({
			...household,
			prepaidAccount: accountByHousehold.get(household.id) ?? null
		});
		ownedHouseholdsByProfile.set(household.owner_profile_id, current);
	}

	/** @type {Map<string, any[]>} */
	const devicesByProfile = new Map();
	for (const device of devices ?? []) {
		const relatedProfileIds = new Set(
			[device.assigned_profile_id, device.registered_by_profile_id].filter(Boolean)
		);
		for (const profileId of relatedProfileIds) {
			const current = devicesByProfile.get(profileId) ?? [];
			current.push({
				...device,
				household: householdById.get(device.household_id) ?? null,
				isAssigned: device.assigned_profile_id === profileId
			});
			devicesByProfile.set(profileId, current);
		}
	}

	const users = (profiles ?? [])
		.map((profile) => {
			const roleRows = profile.profile_roles ?? [];
			const roleCodes = roleCodesFromRows(roleRows);

			return {
				id: profile.id,
				full_name: profile.full_name,
				phone: profile.phone,
				account_status: profile.account_status,
				approval_status: profile.approval_status,
				avatar_url: profile.avatar_url,
				preferred_language: profile.preferred_language,
				created_at: profile.created_at,
				updated_at: profile.updated_at,
				roles: roleCodes.length > 0 ? roleCodes : ['house-owner'],
				roleAssignments: rolesFromRows(roleRows),
				is_admin: isAdminRoleRows(roleRows),
				memberships: membershipsByProfile.get(profile.id) ?? [],
				ownedHouseholds: ownedHouseholdsByProfile.get(profile.id) ?? [],
				devices: devicesByProfile.get(profile.id) ?? []
			};
		})
		.sort((a, b) => {
			if (a.account_status === 'invited' && b.account_status !== 'invited') return -1;
			if (a.account_status !== 'invited' && b.account_status === 'invited') return 1;
			return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
		});

	return { users, availableRoles: availableRoles ?? [], loadError: null };
}

export const actions = {
	create: async ({ request, locals, url }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const fullName = String(formData.get('full_name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const phone = String(formData.get('phone') ?? '').trim();
		// Preferred-language provisioning is intentionally paused for now.
		// const preferredLanguage = String(formData.get('preferred_language') ?? 'en');
		const password = String(formData.get('password') ?? '');
		const confirmPassword = String(formData.get('confirm_password') ?? '');
		const approveImmediately = formData.get('approve_immediately') === 'on';
		const requestedRoleIds = [
			...new Set(formData.getAll('role_ids').map((roleId) => String(roleId)))
		];

		if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { message: 'Full name and a valid email address are required.' });
		}
		if (password.length < 8) {
			return fail(400, { message: 'The temporary password must contain at least 8 characters.' });
		}
		if (password !== confirmPassword) {
			return fail(400, { message: 'The temporary passwords do not match.' });
		}
		// if (!['en', 'sn', 'nd'].includes(preferredLanguage)) {
		// 	return fail(400, { message: 'Select a supported preferred language.' });
		// }
		if (
			requestedRoleIds.length === 0 ||
			requestedRoleIds.some((roleId) => !uuidPattern.test(roleId))
		) {
			return fail(400, { message: 'Select at least one valid user role.' });
		}

		const { data: selectedRoles, error: rolesError } = await locals.supabase
			.from('user_roles')
			.select('id, code')
			.in('id', requestedRoleIds);
		if (rolesError) return fail(500, { message: rolesError.message });
		if ((selectedRoles ?? []).length !== requestedRoleIds.length) {
			return fail(400, { message: 'One or more selected roles are not configured.' });
		}

		// Use an isolated client so signUp cannot replace the administrator's
		// cookie-backed session when email confirmation is disabled.
		const provisioningClient = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		});
		const { data: signup, error: signupError } = await provisioningClient.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`,
				data: {
					full_name: fullName,
					phone: phone || null,
					// preferred_language: preferredLanguage,
					provisioned_by_profile_id: administrator.id
				}
			}
		});
		if (signupError) return fail(400, { message: signupError.message });
		if (!signup.user) {
			return fail(500, { message: 'Supabase did not return the new authentication user.' });
		}
		if (Array.isArray(signup.user.identities) && signup.user.identities.length === 0) {
			return fail(409, { message: 'A Supabase authentication account already uses this email.' });
		}
		const newUserId = signup.user.id;

		const accountStatus = approveImmediately ? 'active' : 'invited';
		const approvalStatus = approveImmediately ? 'approved' : 'pending';
		const { error: profileError } = await locals.supabase.from('profiles').insert({
			id: newUserId,
			full_name: fullName,
			phone: phone || null,
			// preferred_language: preferredLanguage,
			account_status: accountStatus,
			approval_status: approvalStatus
		});
		if (profileError) {
			console.error(
				'Authentication user created, but admin profile provisioning failed.',
				profileError
			);
			return fail(500, {
				message:
					'The authentication account was created, but its profile could not be created. Check for an existing email/profile before retrying.'
			});
		}

		const { error: assignmentError } = await locals.supabase.from('profile_roles').insert(
			requestedRoleIds.map((roleId) => ({
				profile_id: newUserId,
				role_id: roleId,
				assigned_by_profile_id: administrator.id
			}))
		);
		if (assignmentError) {
			console.error('New profile created, but role assignment failed.', assignmentError);
			return fail(500, {
				message:
					'The account and profile were created, but roles could not be assigned. Assign them from the user row.'
			});
		}

		return {
			created: true,
			profileId: newUserId,
			requiresEmailConfirmation: !signup.session
		};
	},

	approve: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');

		if (!uuidPattern.test(profileId)) {
			return fail(400, { message: 'A valid profile id is required.' });
		}

		const { data: approved, error } = await locals.supabase
			.from('profiles')
			.update({
				account_status: 'active',
				approval_status: 'approved',
				updated_at: new Date().toISOString()
			})
			.eq('id', profileId)
			.eq('account_status', 'invited')
			.select('id')
			.maybeSingle();

		if (error) {
			console.error('Unable to approve profile.', error);
			return fail(500, { message: 'The account could not be approved.' });
		}
		if (!approved) {
			return fail(409, { message: 'The account is not pending approval.' });
		}

		return { approved: true, profileId: approved.id };
	},

	updateProfile: async ({ request, locals }) => {
		await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');
		const fullName = String(formData.get('full_name') ?? '').trim();
		const phone = String(formData.get('phone') ?? '').trim();
		const avatarUrl = String(formData.get('avatar_url') ?? '').trim();
		const preferredLanguage = String(formData.get('preferred_language') ?? 'en');

		if (!uuidPattern.test(profileId) || !fullName) {
			return fail(400, { message: 'A profile and full name are required.' });
		}
		if (!['en', 'sn', 'nd'].includes(preferredLanguage)) {
			return fail(400, { message: 'Select a supported preferred language.' });
		}
		if (avatarUrl) {
			try {
				new URL(avatarUrl);
			} catch {
				return fail(400, { message: 'Avatar URL must be a valid URL.' });
			}
		}

		const { error } = await locals.supabase
			.from('profiles')
			.update({
				full_name: fullName,
				phone: phone || null,
				avatar_url: avatarUrl || null,
				preferred_language: preferredLanguage,
				updated_at: new Date().toISOString()
			})
			.eq('id', profileId);

		if (error) {
			console.error('Unable to update profile.', error);
			return fail(500, { message: error.message });
		}

		return { updated: true, profileId };
	},

	setStatus: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');
		const accountStatus = String(formData.get('account_status') ?? '');

		if (!uuidPattern.test(profileId)) {
			return fail(400, { message: 'A valid profile id is required.' });
		}
		if (!['invited', 'active', 'suspended', 'closed'].includes(accountStatus)) {
			return fail(400, { message: 'Select a valid account status.' });
		}
		if (administrator.id === profileId && accountStatus !== 'active') {
			return fail(400, { message: 'You cannot deactivate your own administrator account.' });
		}

		const update = {
			account_status: accountStatus,
			updated_at: new Date().toISOString(),
			...(accountStatus === 'active' ? { approval_status: 'approved' } : {}),
			...(accountStatus === 'invited' ? { approval_status: 'pending' } : {})
		};
		const { error } = await locals.supabase.from('profiles').update(update).eq('id', profileId);

		if (error) {
			console.error('Unable to update account status.', error);
			return fail(500, { message: error.message });
		}

		return { statusUpdated: true, profileId };
	},

	reject: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');

		if (!uuidPattern.test(profileId)) {
			return fail(400, { message: 'A valid profile id is required.' });
		}
		if (administrator.id === profileId) {
			return fail(400, { message: 'You cannot reject your own administrator account.' });
		}

		const { data: rejected, error } = await locals.supabase
			.from('profiles')
			.update({
				account_status: 'closed',
				approval_status: 'rejected',
				updated_at: new Date().toISOString()
			})
			.eq('id', profileId)
			.eq('account_status', 'invited')
			.select('id')
			.maybeSingle();
		if (error) return fail(500, { message: error.message });
		if (!rejected) return fail(409, { message: 'The account is not pending approval.' });

		return { rejected: true, profileId };
	},

	delete: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');

		if (!uuidPattern.test(profileId)) {
			return fail(400, { message: 'A valid profile id is required.' });
		}
		if (administrator.id === profileId) {
			return fail(400, { message: 'You cannot close your own administrator account.' });
		}

		const { data: profile, error: lookupError } = await locals.supabase
			.from('profiles')
			.select('approval_status')
			.eq('id', profileId)
			.maybeSingle();
		if (lookupError) return fail(500, { message: lookupError.message });
		if (!profile) return fail(404, { message: 'The profile was not found.' });

		const { error } = await locals.supabase
			.from('profiles')
			.update({
				account_status: 'closed',
				...(profile.approval_status === 'pending' ? { approval_status: 'rejected' } : {}),
				updated_at: new Date().toISOString()
			})
			.eq('id', profileId);
		if (error) return fail(500, { message: error.message });

		return { deleted: true, profileId };
	},

	assignRole: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');
		const roleId = String(formData.get('role_id') ?? '');

		if (!uuidPattern.test(profileId) || !uuidPattern.test(roleId)) {
			return fail(400, { message: 'Select a valid profile and role.' });
		}

		const { error } = await locals.supabase.from('profile_roles').upsert(
			{
				profile_id: profileId,
				role_id: roleId,
				assigned_by_profile_id: administrator.id,
				assigned_at: new Date().toISOString()
			},
			{ onConflict: 'profile_id,role_id' }
		);

		if (error) {
			console.error('Unable to assign role.', error);
			return fail(500, { message: error.message });
		}

		return { roleAssigned: true, profileId };
	},

	removeRole: async ({ request, locals }) => {
		const { user: administrator } = await requireAdmin(locals);
		const formData = await request.formData();
		const profileId = String(formData.get('profile_id') ?? '');
		const roleId = String(formData.get('role_id') ?? '');

		if (!uuidPattern.test(profileId) || !uuidPattern.test(roleId)) {
			return fail(400, { message: 'Select a valid profile and role.' });
		}

		const { data: role } = await locals.supabase
			.from('user_roles')
			.select('code')
			.eq('id', roleId)
			.maybeSingle();
		if (administrator.id === profileId && role?.code === 'admin') {
			return fail(400, { message: 'You cannot remove your own administrator role.' });
		}

		const { error } = await locals.supabase
			.from('profile_roles')
			.delete()
			.eq('profile_id', profileId)
			.eq('role_id', roleId);

		if (error) {
			console.error('Unable to remove role.', error);
			return fail(500, { message: error.message });
		}

		return { roleRemoved: true, profileId };
	}
};
