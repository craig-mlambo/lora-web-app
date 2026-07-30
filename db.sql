-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  account_status text NOT NULL DEFAULT 'active'::text CHECK (account_status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'closed'::text])),
  avatar_url text,
  preferred_language text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  approval_status text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.households (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL,
  account_number text NOT NULL UNIQUE,
  name text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text,
  suburb text,
  city text,
  province text,
  postal_code text,
  timezone text NOT NULL DEFAULT 'Africa/Harare'::text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT households_pkey PRIMARY KEY (id),
  CONSTRAINT households_owner_profile_id_fkey FOREIGN KEY (owner_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.household_members (
  household_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer'::text CHECK (access_level = ANY (ARRAY['owner'::text, 'manager'::text, 'viewer'::text])),
  relationship text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['invited'::text, 'active'::text, 'revoked'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT household_members_pkey PRIMARY KEY (household_id, profile_id),
  CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT household_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  assigned_profile_id uuid,
  registered_by_profile_id uuid,
  serial_number text NOT NULL UNIQUE,
  ttn_device_id text UNIQUE,
  dev_eui text UNIQUE,
  manufacturer text,
  model text,
  firmware_version text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text, 'faulty'::text, 'retired'::text])),
  valve_state text CHECK (valve_state IS NULL OR (valve_state = ANY (ARRAY['open'::text, 'closed'::text, 'unknown'::text]))),
  installed_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT devices_registered_by_profile_id_fkey FOREIGN KEY (registered_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT devices_assignee_is_household_member FOREIGN KEY (household_id) REFERENCES public.household_members(household_id),
  CONSTRAINT devices_assignee_is_household_member FOREIGN KEY (assigned_profile_id) REFERENCES public.household_members(profile_id)
);
CREATE TABLE public.device_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL,
  household_id uuid NOT NULL,
  assigned_profile_id uuid,
  assigned_by_profile_id uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  unassigned_at timestamp with time zone,
  notes text,
  CONSTRAINT device_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT device_assignments_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT device_assignments_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT device_assignments_assigned_by_profile_id_fkey FOREIGN KEY (assigned_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT device_assignments_assignee_is_member FOREIGN KEY (household_id) REFERENCES public.household_members(household_id),
  CONSTRAINT device_assignments_assignee_is_member FOREIGN KEY (assigned_profile_id) REFERENCES public.household_members(profile_id)
);
CREATE TABLE public.prepaid_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL UNIQUE,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'::text),
  low_balance_threshold_litres numeric NOT NULL DEFAULT 100 CHECK (low_balance_threshold_litres >= 0::numeric),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'closed'::text])),
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prepaid_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT prepaid_accounts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.tariffs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'::text),
  fixed_fee numeric NOT NULL DEFAULT 0 CHECK (fixed_fee >= 0::numeric),
  effective_from timestamp with time zone NOT NULL,
  effective_to timestamp with time zone,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])),
  created_by_profile_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tariffs_pkey PRIMARY KEY (id),
  CONSTRAINT tariffs_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.tariff_bands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tariff_id uuid NOT NULL,
  band_order smallint NOT NULL CHECK (band_order > 0),
  from_m3 numeric NOT NULL CHECK (from_m3 >= 0::numeric),
  to_m3 numeric,
  price_per_m3 numeric NOT NULL CHECK (price_per_m3 >= 0::numeric),
  CONSTRAINT tariff_bands_pkey PRIMARY KEY (id),
  CONSTRAINT tariff_bands_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prepaid_account_id uuid NOT NULL,
  payer_profile_id uuid,
  provider text NOT NULL,
  provider_reference text,
  idempotency_key text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'::text),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'partially_refunded'::text, 'refunded'::text])),
  failure_code text,
  failure_message text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_prepaid_account_id_fkey FOREIGN KEY (prepaid_account_id) REFERENCES public.prepaid_accounts(id),
  CONSTRAINT payments_payer_profile_id_fkey FOREIGN KEY (payer_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.payment_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  payment_id uuid,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  processing_error text,
  CONSTRAINT payment_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);
CREATE TABLE public.payment_refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  provider_reference text,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  reason text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text])),
  requested_by_profile_id uuid,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT payment_refunds_pkey PRIMARY KEY (id),
  CONSTRAINT payment_refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT payment_refunds_requested_by_profile_id_fkey FOREIGN KEY (requested_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.water_credit_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prepaid_account_id uuid NOT NULL,
  payment_id uuid NOT NULL UNIQUE,
  tariff_id uuid NOT NULL,
  paid_amount numeric NOT NULL CHECK (paid_amount > 0::numeric),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'::text),
  purchased_litres numeric NOT NULL CHECK (purchased_litres > 0::numeric),
  bonus_litres numeric NOT NULL DEFAULT 0 CHECK (bonus_litres >= 0::numeric),
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT water_credit_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT water_credit_purchases_prepaid_account_id_fkey FOREIGN KEY (prepaid_account_id) REFERENCES public.prepaid_accounts(id),
  CONSTRAINT water_credit_purchases_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT water_credit_purchases_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id)
);
CREATE TABLE public.device_readings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id uuid NOT NULL,
  source_message_id text UNIQUE,
  frame_counter bigint,
  reading_time timestamp with time zone NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  cumulative_litres numeric NOT NULL CHECK (cumulative_litres >= 0::numeric),
  interval_litres numeric CHECK (interval_litres IS NULL OR interval_litres >= 0::numeric),
  instant_flow_lpm numeric,
  reverse_flow_litres numeric,
  remaining_credit_litres numeric,
  battery_percent numeric CHECK (battery_percent IS NULL OR battery_percent >= 0::numeric AND battery_percent <= 100::numeric),
  rssi integer,
  snr numeric,
  valve_state text CHECK (valve_state IS NULL OR (valve_state = ANY (ARRAY['open'::text, 'closed'::text, 'unknown'::text]))),
  checksum_ok boolean,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT device_readings_pkey PRIMARY KEY (id),
  CONSTRAINT device_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.consumption_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prepaid_account_id uuid NOT NULL,
  device_id uuid NOT NULL,
  from_reading_id bigint,
  to_reading_id bigint NOT NULL UNIQUE,
  consumed_litres numeric NOT NULL CHECK (consumed_litres >= 0::numeric),
  started_at timestamp with time zone,
  ended_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consumption_events_pkey PRIMARY KEY (id),
  CONSTRAINT consumption_events_prepaid_account_id_fkey FOREIGN KEY (prepaid_account_id) REFERENCES public.prepaid_accounts(id),
  CONSTRAINT consumption_events_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT consumption_events_from_reading_id_fkey FOREIGN KEY (from_reading_id) REFERENCES public.device_readings(id),
  CONSTRAINT consumption_events_to_reading_id_fkey FOREIGN KEY (to_reading_id) REFERENCES public.device_readings(id)
);
CREATE TABLE public.water_ledger_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prepaid_account_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type = ANY (ARRAY['opening'::text, 'purchase'::text, 'consumption'::text, 'adjustment'::text, 'refund'::text, 'reversal'::text, 'expiry'::text])),
  litres_delta numeric NOT NULL CHECK (litres_delta <> 0::numeric),
  purchase_id uuid UNIQUE,
  consumption_event_id uuid UNIQUE,
  reversal_of_id uuid,
  description text NOT NULL,
  created_by_profile_id uuid,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT water_ledger_entries_pkey PRIMARY KEY (id),
  CONSTRAINT water_ledger_entries_prepaid_account_id_fkey FOREIGN KEY (prepaid_account_id) REFERENCES public.prepaid_accounts(id),
  CONSTRAINT water_ledger_entries_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.water_credit_purchases(id),
  CONSTRAINT water_ledger_entries_consumption_event_id_fkey FOREIGN KEY (consumption_event_id) REFERENCES public.consumption_events(id),
  CONSTRAINT water_ledger_entries_reversal_of_id_fkey FOREIGN KEY (reversal_of_id) REFERENCES public.water_ledger_entries(id),
  CONSTRAINT water_ledger_entries_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.meter_credit_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  device_id uuid NOT NULL,
  litres numeric NOT NULL CHECK (litres > 0::numeric),
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued'::text CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'acknowledged'::text, 'failed'::text, 'cancelled'::text])),
  command_reference text,
  queued_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  failure_message text,
  device_balance_after_litres numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT meter_credit_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT meter_credit_allocations_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.water_credit_purchases(id),
  CONSTRAINT meter_credit_allocations_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9-]*$'::text),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profile_roles (
  profile_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_by_profile_id uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_roles_pkey PRIMARY KEY (profile_id, role_id),
  CONSTRAINT profile_roles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id),
  CONSTRAINT profile_roles_assigned_by_profile_id_fkey FOREIGN KEY (assigned_by_profile_id) REFERENCES public.profiles(id)
);