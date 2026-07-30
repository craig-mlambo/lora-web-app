-- Seed the five unique TTN meters found in the supplied 720-hour payload.
--
-- IMPORTANT:
-- Replace REPLACE_WITH_HOUSEHOLD_UUID with the UUID of the household that
-- should initially own these meters. If the meters belong to different
-- households, run the corresponding VALUES rows separately with the correct
-- household UUID for each group.
--
-- Find available households:
--
-- select id, account_number, name, status
-- from public.households
-- order by name;

do $seed$
declare
  v_household_id uuid := 'REPLACE_WITH_HOUSEHOLD_UUID'::uuid;
  v_existing_device_id uuid;
  meter record;
begin
  if not exists (
    select 1
    from public.households household
    where household.id = v_household_id
  ) then
    raise exception 'Household % does not exist', v_household_id;
  end if;

  for meter in
    select *
    from (
      values
        (
          '25051150012031',
          'lye-2759-240001',
          '8CF9572000191087',
          '2026-07-30T10:12:50.146061013Z'::timestamptz
        ),
        (
          '25011250002572',
          'lye-device-50002572',
          '8CF957200019100B',
          '2026-07-30T10:11:38.856146061Z'::timestamptz
        ),
        (
          '25021250003109',
          'lye-device-50003109',
          '8CF9572000191025',
          '2026-07-30T10:11:12.102276558Z'::timestamptz
        ),
        (
          '25021250003615',
          'lye-device-50003615',
          '8CF9572000191193',
          '2026-07-30T10:15:47.651558201Z'::timestamptz
        ),
        (
          '25033150000240',
          'lye-yellow-device-5000240',
          '8CF957200016C7D6',
          '2026-07-30T10:07:32.078065874Z'::timestamptz
        )
    ) as seed_data(
      serial_number,
      ttn_device_id,
      dev_eui,
      last_seen_at
    )
  loop
    v_existing_device_id := null;

    -- Match an existing row by any of the three unique meter identities.
    select device.id
      into v_existing_device_id
    from public.devices device
    where device.serial_number = meter.serial_number
      or device.ttn_device_id = meter.ttn_device_id
      or upper(
        regexp_replace(
          coalesce(device.dev_eui, ''),
          '[^A-Za-z0-9]',
          '',
          'g'
        )
      ) = meter.dev_eui
    order by
      case
        when device.serial_number = meter.serial_number then 1
        when device.ttn_device_id = meter.ttn_device_id then 2
        else 3
      end
    limit 1;

    if v_existing_device_id is null then
      insert into public.devices (
        household_id,
        serial_number,
        ttn_device_id,
        dev_eui,
        status,
        valve_state,
        last_seen_at
      )
      values (
        v_household_id,
        meter.serial_number,
        meter.ttn_device_id,
        meter.dev_eui,
        'active',
        'unknown',
        meter.last_seen_at
      );
    else
      -- Preserve an existing household assignment and lifecycle status while
      -- filling the TTN identifiers required by the reading importer.
      update public.devices
      set
        serial_number = meter.serial_number,
        ttn_device_id = meter.ttn_device_id,
        dev_eui = meter.dev_eui,
        status = case
          when status = 'pending' then 'active'
          else status
        end,
        valve_state = coalesce(valve_state, 'unknown'),
        last_seen_at = greatest(
          coalesce(last_seen_at, meter.last_seen_at),
          meter.last_seen_at
        ),
        updated_at = now()
      where id = v_existing_device_id;
    end if;
  end loop;
end;
$seed$;

-- Verify the seeded meters:

select
  device.id,
  device.household_id,
  device.serial_number,
  device.ttn_device_id,
  device.dev_eui,
  device.status,
  device.last_seen_at
from public.devices device
where device.ttn_device_id in (
  'lye-2759-240001',
  'lye-device-50002572',
  'lye-device-50003109',
  'lye-device-50003615',
  'lye-yellow-device-5000240'
)
order by device.ttn_device_id;
