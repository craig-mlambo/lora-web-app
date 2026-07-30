import { getDb } from './db.js';

/**
 * @param {import('postgres').TransactionSql} tx
 * @param {string} actorId
 */
async function assertRoleAdministrator(tx, actorId) {
	const [administrator] = await tx`
		select profile.id
		from public.profiles profile
		join public.profile_roles profile_role
		  on profile_role.profile_id = profile.id
		join public.user_roles role
		  on role.id = profile_role.role_id
		where profile.id = ${actorId}
		  and profile.account_status = 'active'
		  and (
		    role.id = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid
		    or lower(role.code) = 'admin'
		  )
	`;

	if (!administrator) throw new Error('Administrator access is required.');
}

export async function listAvailableRoles() {
	const sql = getDb();
	return sql`
		select id, code, name, description, is_system, created_at, updated_at
		from public.user_roles
		order by
		  case code
		    when 'admin' then 1
		    when 'house-owner' then 2
		    else 3
		  end,
		  name
	`;
}

/**
 * @param {{actorId:string, profileId:string, roleCode:string}} input
 */
export async function assignRoleToProfile(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertRoleAdministrator(tx, input.actorId);

		const [profile] = await tx`
			select id
			from public.profiles
			where id = ${input.profileId}
			  and account_status <> 'closed'
			for update
		`;
		if (!profile) throw new Error('Target profile was not found.');

		const [role] = await tx`
			select id, code, name
			from public.user_roles
			where code = ${input.roleCode}
			for update
		`;
		if (!role) throw new Error('Role was not found.');

		const [assignment] = await tx`
			insert into public.profile_roles (
				profile_id,
				role_id,
				assigned_by_profile_id
			)
			values (
				${input.profileId},
				${role.id},
				${input.actorId}
			)
			on conflict (profile_id, role_id)
			do update set
				assigned_by_profile_id = excluded.assigned_by_profile_id,
				assigned_at = now()
			returning *
		`;

		return { assignment, role };
	});
}

/**
 * @param {{actorId:string, profileId:string, roleCode:string}} input
 */
export async function removeRoleFromProfile(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertRoleAdministrator(tx, input.actorId);

		const [role] = await tx`
			select id, code, name
			from public.user_roles
			where code = ${input.roleCode}
			for update
		`;
		if (!role) throw new Error('Role was not found.');

		if (role.code === 'admin') {
			const [adminCount] = await tx`
				select count(*)::integer as count
				from public.profile_roles profile_role
				join public.user_roles assigned_role
				  on assigned_role.id = profile_role.role_id
				join public.profiles profile
				  on profile.id = profile_role.profile_id
				where (
				  assigned_role.id = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid
				  or lower(assigned_role.code) = 'admin'
				)
				  and profile.account_status = 'active'
			`;

			if (adminCount.count <= 1) {
				throw new Error('The final active administrator role cannot be removed.');
			}
		}

		const removed = await tx`
			delete from public.profile_roles
			where profile_id = ${input.profileId}
			  and role_id = ${role.id}
			returning *
		`;
		if (!removed[0]) throw new Error('The profile does not currently have this role.');

		return removed[0];
	});
}
