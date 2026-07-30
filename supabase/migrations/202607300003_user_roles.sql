-- Normalized application roles.
--
-- Runtime role assignment and authorization are handled by SvelteKit server
-- code. This migration creates only tables, constraints, seed data, RLS, and
-- least-privilege grants.

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.user_roles (id) on delete restrict,
  assigned_by_profile_id uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create index if not exists profile_roles_role_idx
  on public.profile_roles (role_id, profile_id);
create index if not exists profile_roles_assigned_by_idx
  on public.profile_roles (assigned_by_profile_id);

insert into public.user_roles (id, code, name, description, is_system)
values
  (
    gen_random_uuid(),
    'house-owner',
    'House owner',
    'Owns or is the primary account holder for one or more households.',
    true
  ),
  (
    '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid,
    'admin',
    'Administrator',
    'Has full administrative access through authorized SvelteKit server workflows.',
    true
  ),
  (
    gen_random_uuid(),
    'household-manager',
    'Household manager',
    'Can manage permitted household details, members, and meter access.',
    true
  ),
  (
    gen_random_uuid(),
    'household-viewer',
    'Household viewer',
    'Has read-only access to permitted household usage and account information.',
    true
  ),
  (
    gen_random_uuid(),
    'meter-operator',
    'Meter operator',
    'Can register, assign, inspect, and maintain prepaid water meters.',
    true
  ),
  (
    gen_random_uuid(),
    'billing-officer',
    'Billing officer',
    'Can review payments, tariffs, refunds, and prepaid-water credit records.',
    true
  )
on conflict (code)
do update set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

alter table public.user_roles enable row level security;
alter table public.profile_roles enable row level security;

drop policy if exists user_roles_authenticated_read on public.user_roles;
create policy user_roles_authenticated_read
  on public.user_roles
  for select
  to authenticated
  using (true);

drop policy if exists profile_roles_self_read on public.profile_roles;
create policy profile_roles_self_read
  on public.profile_roles
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

-- Profile creation happens in SvelteKit. A signed-in user may attach only the
-- harmless default house-owner role to their own profile. Every other role is
-- assigned through an administrator-authorized server transaction.

drop policy if exists profile_roles_self_default_create on public.profile_roles;
create policy profile_roles_self_default_create
  on public.profile_roles
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and role_id in (
      select role.id
      from public.user_roles role
      where role.code = 'house-owner'
    )
  );

revoke all on public.user_roles, public.profile_roles from anon;
revoke all on public.user_roles, public.profile_roles from authenticated;

grant select on public.user_roles, public.profile_roles to authenticated;
grant insert (profile_id, role_id)
  on public.profile_roles
  to authenticated;
