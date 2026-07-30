-- Allow approval workflows through the authenticated Supabase client.
--
-- The anon key identifies the application. Supabase still evaluates these
-- policies using the signed-in user's JWT, so only an active administrator can
-- read all profiles or approve a pending profile.

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profile_roles actor_role
      join public.user_roles role
        on role.id = actor_role.role_id
      where actor_role.profile_id = (select auth.uid())
        and (
          role.id = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid
          or lower(role.code) = 'admin'
        )
    )
  );

-- Removing the broad self-update policy prevents a user from changing their
-- own approval status after account_status is granted as an update column.

drop policy if exists profiles_self_update_safe_fields on public.profiles;
drop policy if exists profiles_admin_approve on public.profiles;
create policy profiles_admin_approve
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profile_roles actor_role
      join public.user_roles role
        on role.id = actor_role.role_id
      where actor_role.profile_id = (select auth.uid())
        and (
          role.id = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid
          or lower(role.code) = 'admin'
        )
    )
  )
  with check (
    account_status in ('active', 'suspended', 'closed')
    and exists (
      select 1
      from public.profile_roles actor_role
      join public.user_roles role
        on role.id = actor_role.role_id
      where actor_role.profile_id = (select auth.uid())
        and (
          role.id = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid
          or lower(role.code) = 'admin'
        )
    )
  );

revoke update on public.profiles from authenticated;
grant update (account_status, updated_at)
  on public.profiles
  to authenticated;

revoke insert on public.profiles from authenticated;
grant insert (id, full_name, phone, avatar_url, preferred_language, account_status)
  on public.profiles
  to authenticated;
