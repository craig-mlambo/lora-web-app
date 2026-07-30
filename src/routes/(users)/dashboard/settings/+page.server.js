import { fail } from '@sveltejs/kit';
import { requireActiveProfile } from '$lib/server/authorization.js';

export const actions = {
	update: async ({ request, locals }) => {
		const { user } = await requireActiveProfile(locals);
		const formData = await request.formData();
		const fullName = String(formData.get('full_name') ?? '').trim();
		const phone = String(formData.get('phone') ?? '').trim();
		const avatarUrl = String(formData.get('avatar_url') ?? '').trim();
		if (!fullName) return fail(400, { message: 'Your full name is required.' });
		if (avatarUrl) {
			try {
				const parsed = new URL(avatarUrl);
				if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
			} catch {
				return fail(400, { message: 'Avatar URL must be a valid HTTP or HTTPS address.' });
			}
		}

		const { error } = await locals.supabase
			.from('profiles')
			.update({
				full_name: fullName,
				phone: phone || null,
				avatar_url: avatarUrl || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', user.id);
		if (error) return fail(500, { message: error.message });
		return { updated: true };
	}
};
