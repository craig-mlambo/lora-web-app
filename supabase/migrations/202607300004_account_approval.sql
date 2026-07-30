-- New self-service signups require administrator approval.
--
-- Authentication and profile provisioning are performed by SvelteKit code.
-- This migration only establishes the safe database defaults and RLS boundary.

alter table public.profiles
  alter column account_status set default 'invited';

drop policy if exists profiles_self_create on public.profiles;
create policy profiles_self_create
  on public.profiles
  for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and account_status = 'invited'
  );

-- Authenticated users may change only these explicitly granted columns.
-- account_status is intentionally excluded, so users cannot approve themselves.

revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, preferred_language)
  on public.profiles
  to authenticated;

revoke insert on public.profiles from authenticated;
grant insert (id, full_name, phone, avatar_url, preferred_language, account_status)
  on public.profiles
  to authenticated;
