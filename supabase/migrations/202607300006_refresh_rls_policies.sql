-- Refresh the RLS policies and grants for every table listed in db.sql.
--
-- Access model:
--   * anon:
--       - CRU (no delete) on public.profiles and public.profile_roles
--       - read-only access to the seeded public.user_roles lookup
--       - profile writes remain limited to approval-pending accounts
--       - role assignments remain limited to the house-owner role
--   * authenticated:
--       - unrestricted CRUD on every public table listed in db.sql
--
-- WARNING:
-- The authenticated policies in this migration are intentionally permissive.
-- Any signed-in user can create, read, update, and delete application records,
-- including payments, readings, roles, and other users' profiles. Use this
-- policy set only for development or a fully trusted authenticated user base.
--
-- Supabase Auth identities are stored in auth.users and are managed through
-- supabase.auth. RLS policies in the public schema do not create auth users.

-- ---------------------------------------------------------------------------
-- Remove all existing policies from the tables in db.sql.
-- This anonymous DO block runs only while the migration is applied and does
-- not create a stored function, trigger, or other runtime database logic.
-- ---------------------------------------------------------------------------

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename::text = any (
        array[
          'profiles',
          'households',
          'household_members',
          'devices',
          'device_assignments',
          'prepaid_accounts',
          'tariffs',
          'tariff_bands',
          'payments',
          'payment_events',
          'payment_refunds',
          'water_credit_purchases',
          'device_readings',
          'consumption_events',
          'water_ledger_entries',
          'meter_credit_allocations',
          'user_roles',
          'profile_roles'
        ]
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table in db.sql.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.devices enable row level security;
alter table public.device_assignments enable row level security;
alter table public.prepaid_accounts enable row level security;
alter table public.tariffs enable row level security;
alter table public.tariff_bands enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.water_credit_purchases enable row level security;
alter table public.device_readings enable row level security;
alter table public.consumption_events enable row level security;
alter table public.water_ledger_entries enable row level security;
alter table public.meter_credit_allocations enable row level security;
alter table public.user_roles enable row level security;
alter table public.profile_roles enable row level security;

-- ---------------------------------------------------------------------------
-- Reset table privileges before granting the requested access.
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.households,
  public.household_members,
  public.devices,
  public.device_assignments,
  public.prepaid_accounts,
  public.tariffs,
  public.tariff_bands,
  public.payments,
  public.payment_events,
  public.payment_refunds,
  public.water_credit_purchases,
  public.device_readings,
  public.consumption_events,
  public.water_ledger_entries,
  public.meter_credit_allocations,
  public.user_roles,
  public.profile_roles
from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Anonymous signup access. user_roles is a seeded lookup, so it is read-only.

grant select, insert, update
  on table public.profiles, public.profile_roles
  to anon;

grant select
  on table public.user_roles
  to anon;

-- Authenticated users receive CRUD on all tables from db.sql.

grant select, insert, update, delete
  on table
    public.profiles,
    public.households,
    public.household_members,
    public.devices,
    public.device_assignments,
    public.prepaid_accounts,
    public.tariffs,
    public.tariff_bands,
    public.payments,
    public.payment_events,
    public.payment_refunds,
    public.water_credit_purchases,
    public.device_readings,
    public.consumption_events,
    public.water_ledger_entries,
    public.meter_credit_allocations,
    public.user_roles,
    public.profile_roles
  to authenticated;

-- Identity-backed tables may require their generated sequences during insert.

grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Anonymous signup policies.
-- ---------------------------------------------------------------------------

create policy anon_profiles_read
  on public.profiles
  for select
  to anon
  using (true);

create policy anon_profiles_create_pending
  on public.profiles
  for insert
  to anon
  with check (account_status = 'invited');

create policy anon_profiles_update_pending
  on public.profiles
  for update
  to anon
  using (account_status = 'invited')
  with check (account_status = 'invited');

create policy anon_user_roles_read
  on public.user_roles
  for select
  to anon
  using (true);

create policy anon_profile_roles_read
  on public.profile_roles
  for select
  to anon
  using (true);

create policy anon_profile_roles_create_house_owner
  on public.profile_roles
  for insert
  to anon
  with check (
    role_id in (
      select role.id
      from public.user_roles role
      where role.code = 'house-owner'
    )
  );

create policy anon_profile_roles_update_house_owner
  on public.profile_roles
  for update
  to anon
  using (
    role_id in (
      select role.id
      from public.user_roles role
      where role.code = 'house-owner'
    )
  )
  with check (
    role_id in (
      select role.id
      from public.user_roles role
      where role.code = 'house-owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Full authenticated CRUD policies.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'households',
    'household_members',
    'devices',
    'device_assignments',
    'prepaid_accounts',
    'tariffs',
    'tariff_bands',
    'payments',
    'payment_events',
    'payment_refunds',
    'water_credit_purchases',
    'device_readings',
    'consumption_events',
    'water_ledger_entries',
    'meter_credit_allocations',
    'user_roles',
    'profile_roles'
  ]
  loop
    execute format(
      'create policy authenticated_full_crud on public.%I for all to authenticated using (true) with check (true)',
      table_name
    );
  end loop;
end
$$;
