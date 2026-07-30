-- LYE prepaid water schema.
--
-- This migration intentionally contains no runtime triggers, stored procedures,
-- payment logic, meter-processing logic, or admin authorization logic.
-- All business workflows run in the SvelteKit server codebase.
--
-- Supabase remains responsible only for:
--   * durable tables and relationships
--   * data-shape constraints and indexes
--   * authenticated household read boundaries
--   * safe self-service profile creation/update

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core identity and household records
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  account_status text not null default 'invited'
    check (account_status in ('invited', 'active', 'suspended', 'closed')),
  avatar_url text,
  preferred_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists account_status text not null default 'invited',
  add column if not exists avatar_url text,
  add column if not exists preferred_language text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles (id) on delete restrict,
  account_number text not null unique,
  name text not null,
  address_line_1 text not null,
  address_line_2 text,
  suburb text,
  city text,
  province text,
  postal_code text,
  timezone text not null default 'Africa/Harare',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists households_owner_profile_idx
  on public.households (owner_profile_id);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  access_level text not null default 'viewer'
    check (access_level in ('owner', 'manager', 'viewer')),
  relationship text,
  status text not null default 'active'
    check (status in ('invited', 'active', 'revoked')),
  joined_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);

create index if not exists household_members_profile_idx
  on public.household_members (profile_id, status);

-- ---------------------------------------------------------------------------
-- Physical meters and assignment history
-- ---------------------------------------------------------------------------

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  assigned_profile_id uuid,
  registered_by_profile_id uuid references public.profiles (id) on delete set null,
  serial_number text not null unique,
  ttn_device_id text unique,
  dev_eui text unique,
  manufacturer text,
  model text,
  firmware_version text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive', 'faulty', 'retired')),
  valve_state text
    check (valve_state is null or valve_state in ('open', 'closed', 'unknown')),
  installed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_assignee_is_household_member
    foreign key (household_id, assigned_profile_id)
    references public.household_members (household_id, profile_id)
    on update cascade
    on delete restrict
);

create index if not exists devices_household_idx
  on public.devices (household_id);
create index if not exists devices_assigned_profile_idx
  on public.devices (assigned_profile_id);

create table if not exists public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete restrict,
  assigned_profile_id uuid,
  assigned_by_profile_id uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  notes text,
  check (unassigned_at is null or unassigned_at >= assigned_at),
  constraint device_assignments_assignee_is_member
    foreign key (household_id, assigned_profile_id)
    references public.household_members (household_id, profile_id)
    on update cascade
    on delete restrict
);

create unique index if not exists one_current_assignment_per_device_idx
  on public.device_assignments (device_id)
  where unassigned_at is null;

create index if not exists device_assignments_household_idx
  on public.device_assignments (household_id, assigned_at desc);

-- ---------------------------------------------------------------------------
-- Prepaid accounts, tariffs, payments, and water purchases
-- ---------------------------------------------------------------------------

create table if not exists public.prepaid_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  low_balance_threshold_litres numeric(18, 3) not null default 100
    check (low_balance_threshold_litres >= 0),
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_at is null or closed_at >= opened_at)
);

create table if not exists public.tariffs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  fixed_fee numeric(14, 2) not null default 0 check (fixed_fee >= 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  status text not null default 'active'
    check (status in ('draft', 'active', 'retired')),
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  unique (name, effective_from)
);

create table if not exists public.tariff_bands (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references public.tariffs (id) on delete cascade,
  band_order smallint not null check (band_order > 0),
  from_m3 numeric(14, 3) not null check (from_m3 >= 0),
  to_m3 numeric(14, 3),
  price_per_m3 numeric(14, 4) not null check (price_per_m3 >= 0),
  check (to_m3 is null or to_m3 > from_m3),
  unique (tariff_id, band_order),
  unique (tariff_id, from_m3)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  prepaid_account_id uuid not null references public.prepaid_accounts (id) on delete restrict,
  payer_profile_id uuid references public.profiles (id) on delete set null,
  provider text not null,
  provider_reference text,
  idempotency_key text not null unique,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'succeeded',
        'failed',
        'cancelled',
        'partially_refunded',
        'refunded'
      )
    ),
  failure_code text,
  failure_message text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference),
  check (paid_at is null or paid_at >= requested_at)
);

create index if not exists payments_account_created_idx
  on public.payments (prepaid_account_id, created_at desc);
create index if not exists payments_payer_created_idx
  on public.payments (payer_profile_id, created_at desc);

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments (id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, provider_event_id)
);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  provider_reference text,
  amount numeric(14, 2) not null check (amount > 0),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  requested_by_profile_id uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (payment_id, provider_reference),
  check (completed_at is null or completed_at >= requested_at)
);

create table if not exists public.water_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  prepaid_account_id uuid not null references public.prepaid_accounts (id) on delete restrict,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  tariff_id uuid not null references public.tariffs (id) on delete restrict,
  paid_amount numeric(14, 2) not null check (paid_amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  purchased_litres numeric(18, 3) not null check (purchased_litres > 0),
  bonus_litres numeric(18, 3) not null default 0 check (bonus_litres >= 0),
  purchased_at timestamptz not null default now(),
  pricing_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists credit_purchases_account_idx
  on public.water_credit_purchases (prepaid_account_id, purchased_at desc);

-- ---------------------------------------------------------------------------
-- Meter readings, consumption, and the litres ledger
-- ---------------------------------------------------------------------------

create table if not exists public.device_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete restrict,
  source_message_id text unique,
  frame_counter bigint,
  reading_time timestamptz not null,
  received_at timestamptz not null default now(),
  cumulative_litres numeric(20, 3) not null check (cumulative_litres >= 0),
  interval_litres numeric(18, 3) check (interval_litres is null or interval_litres >= 0),
  instant_flow_lpm numeric(14, 3),
  reverse_flow_litres numeric(20, 3),
  remaining_credit_litres numeric(18, 3),
  battery_percent numeric(5, 2)
    check (battery_percent is null or battery_percent between 0 and 100),
  rssi integer,
  snr numeric(8, 3),
  valve_state text
    check (valve_state is null or valve_state in ('open', 'closed', 'unknown')),
  checksum_ok boolean,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (device_id, reading_time, cumulative_litres)
);

create index if not exists device_readings_device_time_idx
  on public.device_readings (device_id, reading_time desc);

create table if not exists public.consumption_events (
  id uuid primary key default gen_random_uuid(),
  prepaid_account_id uuid not null references public.prepaid_accounts (id) on delete restrict,
  device_id uuid not null references public.devices (id) on delete restrict,
  from_reading_id bigint references public.device_readings (id) on delete restrict,
  to_reading_id bigint not null unique references public.device_readings (id) on delete restrict,
  consumed_litres numeric(18, 3) not null check (consumed_litres >= 0),
  started_at timestamptz,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (started_at is null or ended_at >= started_at),
  check (from_reading_id is null or from_reading_id <> to_reading_id)
);

create index if not exists consumption_events_account_time_idx
  on public.consumption_events (prepaid_account_id, ended_at desc);
create index if not exists consumption_events_device_time_idx
  on public.consumption_events (device_id, ended_at desc);

create table if not exists public.water_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  prepaid_account_id uuid not null references public.prepaid_accounts (id) on delete restrict,
  entry_type text not null
    check (
      entry_type in (
        'opening',
        'purchase',
        'consumption',
        'adjustment',
        'refund',
        'reversal',
        'expiry'
      )
    ),
  litres_delta numeric(18, 3) not null check (litres_delta <> 0),
  purchase_id uuid unique references public.water_credit_purchases (id) on delete restrict,
  consumption_event_id uuid unique references public.consumption_events (id) on delete restrict,
  reversal_of_id uuid references public.water_ledger_entries (id) on delete restrict,
  description text not null,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (
    (
      entry_type = 'purchase'
      and purchase_id is not null
      and consumption_event_id is null
      and reversal_of_id is null
      and litres_delta > 0
    )
    or (
      entry_type = 'consumption'
      and purchase_id is null
      and consumption_event_id is not null
      and reversal_of_id is null
      and litres_delta < 0
    )
    or (
      entry_type = 'reversal'
      and purchase_id is null
      and consumption_event_id is null
      and reversal_of_id is not null
    )
    or (
      entry_type in ('opening', 'adjustment', 'refund', 'expiry')
      and purchase_id is null
      and consumption_event_id is null
      and reversal_of_id is null
    )
  )
);

create index if not exists water_ledger_account_time_idx
  on public.water_ledger_entries (prepaid_account_id, occurred_at desc, id);
create unique index if not exists one_reversal_per_ledger_entry_idx
  on public.water_ledger_entries (reversal_of_id)
  where reversal_of_id is not null;

create table if not exists public.meter_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.water_credit_purchases (id) on delete restrict,
  device_id uuid not null references public.devices (id) on delete restrict,
  litres numeric(18, 3) not null check (litres > 0),
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'acknowledged', 'failed', 'cancelled')),
  command_reference text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  failure_message text,
  device_balance_after_litres numeric(18, 3),
  metadata jsonb not null default '{}'::jsonb,
  check (sent_at is null or sent_at >= queued_at),
  check (acknowledged_at is null or acknowledged_at >= coalesce(sent_at, queued_at))
);

create index if not exists meter_allocations_device_time_idx
  on public.meter_credit_allocations (device_id, queued_at desc);

-- Read-only reporting views. security_invoker keeps underlying RLS active.

create or replace view public.prepaid_account_balances
with (security_invoker = true)
as
select
  account.id as prepaid_account_id,
  account.household_id,
  account.currency,
  account.status,
  account.low_balance_threshold_litres,
  coalesce(sum(ledger.litres_delta), 0::numeric) as available_litres,
  coalesce(
    sum(ledger.litres_delta) filter (where ledger.litres_delta > 0),
    0::numeric
  ) as total_credited_litres,
  coalesce(
    sum(-ledger.litres_delta) filter (where ledger.entry_type = 'consumption'),
    0::numeric
  ) as total_consumed_litres,
  coalesce(sum(ledger.litres_delta), 0::numeric)
    <= account.low_balance_threshold_litres as is_low_balance,
  max(ledger.occurred_at) as last_ledger_activity_at
from public.prepaid_accounts account
left join public.water_ledger_entries ledger
  on ledger.prepaid_account_id = account.id
group by
  account.id,
  account.household_id,
  account.currency,
  account.status,
  account.low_balance_threshold_litres;

create or replace view public.daily_water_usage
with (security_invoker = true)
as
select
  consumption.prepaid_account_id,
  account.household_id,
  consumption.device_id,
  (consumption.ended_at at time zone household.timezone)::date as usage_date,
  sum(consumption.consumed_litres) as consumed_litres,
  min(consumption.started_at) as first_interval_started_at,
  max(consumption.ended_at) as last_interval_ended_at
from public.consumption_events consumption
join public.prepaid_accounts account
  on account.id = consumption.prepaid_account_id
join public.households household
  on household.id = account.household_id
group by
  consumption.prepaid_account_id,
  account.household_id,
  consumption.device_id,
  (consumption.ended_at at time zone household.timezone)::date;

-- ---------------------------------------------------------------------------
-- Remove runtime database logic from earlier drafts, if those drafts ran.
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists sync_household_owner_membership on public.households;
drop trigger if exists validate_credit_purchase on public.water_credit_purchases;
drop trigger if exists validate_consumption_event on public.consumption_events;
drop trigger if exists validate_ledger_entry on public.water_ledger_entries;
drop trigger if exists validate_meter_credit_allocation on public.meter_credit_allocations;
drop trigger if exists water_credit_purchases_immutable on public.water_credit_purchases;
drop trigger if exists device_readings_immutable on public.device_readings;
drop trigger if exists consumption_events_immutable on public.consumption_events;
drop trigger if exists water_ledger_entries_immutable on public.water_ledger_entries;

-- Remove all policies from earlier drafts before removing their helper
-- functions and replacing them with function-free policies.

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_admin_read on public.profiles;
drop policy if exists profiles_shared_household_read on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

drop policy if exists households_member_read on public.households;
drop policy if exists households_admin_write on public.households;
drop policy if exists households_admin_insert on public.households;
drop policy if exists households_admin_update on public.households;
drop policy if exists households_admin_delete on public.households;

drop policy if exists household_members_member_read on public.household_members;
drop policy if exists household_members_admin_write on public.household_members;
drop policy if exists household_members_admin_insert on public.household_members;
drop policy if exists household_members_admin_update on public.household_members;
drop policy if exists household_members_admin_delete on public.household_members;

drop policy if exists devices_household_read on public.devices;
drop policy if exists devices_admin_write on public.devices;
drop policy if exists devices_admin_insert on public.devices;
drop policy if exists devices_admin_update on public.devices;
drop policy if exists devices_admin_delete on public.devices;

drop policy if exists assignments_household_read on public.device_assignments;
drop policy if exists assignments_admin_write on public.device_assignments;
drop policy if exists assignments_admin_insert on public.device_assignments;
drop policy if exists assignments_admin_update on public.device_assignments;
drop policy if exists assignments_admin_delete on public.device_assignments;

drop policy if exists prepaid_accounts_household_read on public.prepaid_accounts;
drop policy if exists prepaid_accounts_admin_write on public.prepaid_accounts;
drop policy if exists prepaid_accounts_admin_insert on public.prepaid_accounts;
drop policy if exists prepaid_accounts_admin_update on public.prepaid_accounts;
drop policy if exists prepaid_accounts_admin_delete on public.prepaid_accounts;

drop policy if exists tariffs_authenticated_read on public.tariffs;
drop policy if exists tariffs_admin_write on public.tariffs;
drop policy if exists tariffs_admin_insert on public.tariffs;
drop policy if exists tariffs_admin_update on public.tariffs;
drop policy if exists tariffs_admin_delete on public.tariffs;

drop policy if exists tariff_bands_authenticated_read on public.tariff_bands;
drop policy if exists tariff_bands_admin_write on public.tariff_bands;
drop policy if exists tariff_bands_admin_insert on public.tariff_bands;
drop policy if exists tariff_bands_admin_update on public.tariff_bands;
drop policy if exists tariff_bands_admin_delete on public.tariff_bands;

drop policy if exists payments_household_read on public.payments;
drop policy if exists payments_admin_write on public.payments;
drop policy if exists payments_member_insert on public.payments;
drop policy if exists payment_events_admin_read on public.payment_events;
drop policy if exists refunds_household_read on public.payment_refunds;
drop policy if exists refunds_admin_write on public.payment_refunds;
drop policy if exists refunds_member_insert on public.payment_refunds;
drop policy if exists purchases_household_read on public.water_credit_purchases;
drop policy if exists readings_household_read on public.device_readings;
drop policy if exists consumption_household_read on public.consumption_events;
drop policy if exists ledger_household_read on public.water_ledger_entries;
drop policy if exists allocations_household_read on public.meter_credit_allocations;

drop function if exists public.handle_new_auth_user();
drop function if exists public.sync_household_owner_membership();
drop function if exists public.validate_credit_purchase();
drop function if exists public.validate_consumption_event();
drop function if exists public.validate_ledger_entry();
drop function if exists public.validate_meter_credit_allocation();
drop function if exists public.reject_ledger_mutation();
drop function if exists public.reject_immutable_record_mutation();
drop function if exists public.apply_successful_payment_credit(uuid, uuid, numeric, numeric);
drop function if exists public.record_water_consumption(
  uuid,
  uuid,
  bigint,
  bigint,
  numeric,
  timestamptz,
  timestamptz
);
drop function if exists public.record_water_consumption(uuid, uuid, bigint, bigint);
drop function if exists public.can_access_household(uuid);
drop function if exists public.is_admin();

-- ---------------------------------------------------------------------------
-- Function-free RLS read boundaries
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

create policy profiles_self_read
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_self_create
  on public.profiles
  for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and account_status = 'invited'
  );

create policy profiles_self_update_safe_fields
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy household_members_self_read
  on public.household_members
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    and status = 'active'
  );

create policy households_member_read
  on public.households
  for select
  to authenticated
  using (
    owner_profile_id = (select auth.uid())
    or id in (
      select membership.household_id
      from public.household_members membership
      where membership.profile_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create policy devices_household_read
  on public.devices
  for select
  to authenticated
  using (
    household_id in (
      select household.id
      from public.households household
    )
  );

create policy assignments_household_read
  on public.device_assignments
  for select
  to authenticated
  using (
    household_id in (
      select household.id
      from public.households household
    )
  );

create policy prepaid_accounts_household_read
  on public.prepaid_accounts
  for select
  to authenticated
  using (
    household_id in (
      select household.id
      from public.households household
    )
  );

create policy tariffs_authenticated_read
  on public.tariffs
  for select
  to authenticated
  using (true);

create policy tariff_bands_authenticated_read
  on public.tariff_bands
  for select
  to authenticated
  using (true);

create policy payments_household_read
  on public.payments
  for select
  to authenticated
  using (
    prepaid_account_id in (
      select account.id
      from public.prepaid_accounts account
    )
  );

-- Raw provider webhook payloads are never exposed through the browser API.

create policy refunds_household_read
  on public.payment_refunds
  for select
  to authenticated
  using (
    payment_id in (
      select payment.id
      from public.payments payment
    )
  );

create policy purchases_household_read
  on public.water_credit_purchases
  for select
  to authenticated
  using (
    prepaid_account_id in (
      select account.id
      from public.prepaid_accounts account
    )
  );

create policy readings_household_read
  on public.device_readings
  for select
  to authenticated
  using (
    device_id in (
      select device.id
      from public.devices device
    )
  );

create policy consumption_household_read
  on public.consumption_events
  for select
  to authenticated
  using (
    prepaid_account_id in (
      select account.id
      from public.prepaid_accounts account
    )
  );

create policy ledger_household_read
  on public.water_ledger_entries
  for select
  to authenticated
  using (
    prepaid_account_id in (
      select account.id
      from public.prepaid_accounts account
    )
  );

create policy allocations_household_read
  on public.meter_credit_allocations
  for select
  to authenticated
  using (
    device_id in (
      select device.id
      from public.devices device
    )
  );

-- ---------------------------------------------------------------------------
-- Least-privilege Data API grants
-- ---------------------------------------------------------------------------

revoke all on
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
  public.prepaid_account_balances,
  public.daily_water_usage
from anon;

revoke all on
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
  public.prepaid_account_balances,
  public.daily_water_usage
from authenticated;

grant select on
  public.profiles,
  public.households,
  public.household_members,
  public.devices,
  public.device_assignments,
  public.prepaid_accounts,
  public.tariffs,
  public.tariff_bands,
  public.payments,
  public.payment_refunds,
  public.water_credit_purchases,
  public.device_readings,
  public.consumption_events,
  public.water_ledger_entries,
  public.meter_credit_allocations,
  public.prepaid_account_balances,
  public.daily_water_usage
to authenticated;

grant insert (id, full_name, phone, avatar_url, preferred_language)
  on public.profiles
  to authenticated;

grant update (full_name, phone, avatar_url, preferred_language)
  on public.profiles
  to authenticated;

-- The SvelteKit server connects with SUPABASE_DB_URL and performs every other
-- mutation inside code-owned transactions after checking the authenticated
-- user's role and household access.
