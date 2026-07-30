import { fail, redirect } from '@sveltejs/kit';
import { dashboardPathForProfile } from '$lib/utils/roles.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ parent }) {
	const { user, profile } = await parent();
	if (user) redirect(303, dashboardPathForProfile(profile));
}

export const actions = {
	default: async ({ request, locals, url }) => {
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

		if (!fullName || !email) {
			return fail(400, { message: 'Your full name and email address are required.' });
		}
		if (password.length < 8) {
			return fail(400, { message: 'Use at least 8 characters for your password.' });
		}
		if (password !== confirmPassword) {
			return fail(400, { message: 'The passwords do not match.' });
		}
		// if (!['en', 'sn', 'nd'].includes(preferredLanguage)) {
		// 	return fail(400, { message: 'Select a supported preferred language.' });
		// }

		const { data, error: signupError } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`,
				data: {
					full_name: fullName,
					phone: phone || null
					// preferred_language: preferredLanguage
				}
			}
		});

		if (signupError) {
			return fail(400, { message: signupError.message });
		}
		if (!data.user) {
			return fail(500, { message: 'The authentication account could not be created.' });
		}
		const { error: profileError } = await locals.supabase.from('profiles').insert({
			id: data.user.id,
			full_name: fullName,
			phone: phone || null,
			// preferred_language: preferredLanguage,
			account_status: 'invited',
			approval_status: 'pending'
		});

		if (profileError && profileError.code !== '23505') {
			console.error('Unable to create signup profile.', profileError);
			return fail(500, {
				message:
					'Your authentication account was created, but its profile could not be provisioned. Apply migration 202607300006_refresh_rls_policies.sql.'
			});
		}

		const { data: houseOwnerRole, error: roleLookupError } = await locals.supabase
			.from('user_roles')
			.select('id')
			.eq('code', 'house-owner')
			.single();

		if (roleLookupError || !houseOwnerRole) {
			console.error('Unable to find house-owner role.', roleLookupError);
			return fail(500, {
				message: 'The house-owner role is not configured. Apply the user-roles migration.'
			});
		}

		const { error: roleAssignmentError } = await locals.supabase
			.from('profile_roles')
			.insert({ profile_id: data.user.id, role_id: houseOwnerRole.id });

		if (roleAssignmentError && roleAssignmentError.code !== '23505') {
			console.error('Unable to assign house-owner role.', roleAssignmentError);
			return fail(500, {
				message:
					'Your profile was created, but its house-owner role could not be assigned. Apply migration 202607300006_refresh_rls_policies.sql.'
			});
		}

		return {
			success: true,
			email,
			requiresEmailConfirmation: !data.session
		};
	}
};
