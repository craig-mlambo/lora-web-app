-- Import decoded TTN water-meter uplinks into public.device_readings.
--
-- A PostgreSQL trigger cannot run on a clock by itself. This migration uses:
--   * the `http` extension for a synchronous GET request whose JSON response
--     can be parsed in the same transaction; and
--   * `pg_cron` to invoke the import function on a schedule.
--
-- Prerequisite:
-- Each meter must already exist in public.devices with either ttn_device_id or
-- dev_eui matching end_device_ids in the upstream response. Unknown devices
-- and undecodable control frames are deliberately skipped.

create schema if not exists extensions;
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create or replace function public.sync_ttn_device_readings(
  p_last text default '720h'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_status integer;
  v_payload jsonb;
  v_fetched integer := 0;
  v_inserted integer := 0;
begin
  -- The upstream endpoint accepts hour windows. Cap manual backfills at 90
  -- days to avoid accidentally requesting an unbounded response.
  if p_last is null
    or p_last !~ '^[1-9][0-9]*h$'
    or replace(p_last, 'h', '')::integer > 2160
  then
    raise exception
      'Invalid TTN window: %. Use an hour value from 1h through 2160h.',
      p_last;
  end if;

  -- Avoid holding a database worker indefinitely if the upstream API stalls.
  perform set_config('http.curlopt_timeout_ms', '30000', true);
  perform set_config('http.curlopt_connecttimeout_ms', '10000', true);

  select response.status, response.content::jsonb
    into v_status, v_payload
  from extensions.http_get(
    'https://lora-api-server.vercel.app/api/ttn/uplinks?last=' || p_last
  ) as response;

  if v_status < 200 or v_status >= 300 then
    raise exception 'TTN uplink API returned HTTP %', v_status;
  end if;

  if jsonb_typeof(v_payload -> 'uplinks') is distinct from 'array' then
    raise exception 'TTN uplink API response did not contain an uplinks array';
  end if;

  v_fetched := jsonb_array_length(v_payload -> 'uplinks');

  with raw_uplinks as (
    select
      raw.uplink,
      coalesce(
        nullif(raw.uplink -> 'decoded', 'null'::jsonb),
        raw.uplink #> '{uplink_message,decoded_payload}'
      ) as decoded
    from jsonb_array_elements(v_payload -> 'uplinks') as raw(uplink)
  ),
  decoded_uplinks as (
    select
      raw.uplink,
      raw.decoded,
      raw.uplink #>> '{end_device_ids,device_id}' as ttn_device_id,
      upper(
        replace(
          coalesce(raw.uplink #>> '{end_device_ids,dev_eui}', ''),
          ':',
          ''
        )
      ) as dev_eui,
      raw.uplink #>> '{end_device_ids,application_ids,application_id}'
        as application_id,
      raw.uplink ->> 'received_at' as received_at_text,
      raw.uplink #>> '{uplink_message,f_cnt}' as frame_counter_text,
      raw.uplink #> '{uplink_message,rx_metadata,0}' as rx,
      raw.decoded #>> '{cumulative_flow,value}' as cumulative_value_text,
      lower(raw.decoded #>> '{cumulative_flow,unit}') as cumulative_unit,
      raw.decoded #>> '{instant_flow,value}' as instant_value_text,
      lower(raw.decoded #>> '{instant_flow,unit}') as instant_unit,
      raw.decoded #>> '{reverse_flow,value}' as reverse_value_text,
      lower(raw.decoded #>> '{reverse_flow,unit}') as reverse_unit,
      raw.decoded ->> 'meter_time' as meter_time_text
    from raw_uplinks raw
    where raw.decoded is not null
      and raw.decoded #>> '{cumulative_flow,value}'
        ~ '^-?[0-9]+([.][0-9]+)?$'
      and raw.uplink ->> 'received_at' is not null
  ),
  matched_uplinks as (
    select
      decoded.*,
      matched_device.id as matched_device_id
    from decoded_uplinks decoded
    join lateral (
      select device.id
      from public.devices device
      where (
          decoded.ttn_device_id is not null
          and device.ttn_device_id = decoded.ttn_device_id
        )
        or (
          decoded.dev_eui <> ''
          and upper(replace(coalesce(device.dev_eui, ''), ':', ''))
            = decoded.dev_eui
        )
      order by
        (device.ttn_device_id = decoded.ttn_device_id) desc,
        device.created_at asc
      limit 1
    ) matched_device on true
  )
  insert into public.device_readings (
    device_id,
    source_message_id,
    frame_counter,
    reading_time,
    received_at,
    cumulative_litres,
    interval_litres,
    instant_flow_lpm,
    reverse_flow_litres,
    rssi,
    snr,
    checksum_ok,
    raw_payload
  )
  select
    matched.matched_device_id,
    concat(
      'ttn:',
      coalesce(matched.application_id, 'unknown-app'),
      ':',
      coalesce(matched.ttn_device_id, matched.dev_eui),
      ':',
      coalesce(matched.frame_counter_text, 'no-frame'),
      ':',
      matched.received_at_text
    ),
    case
      when matched.frame_counter_text ~ '^[0-9]+$'
        then matched.frame_counter_text::bigint
      else null
    end,
    case
      -- Meter timestamps in this payload have no UTC offset and represent
      -- local Zimbabwe time. Fall back to TTN received_at if malformed.
      when matched.meter_time_text
        ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}:[0-9]{2}'
        then matched.meter_time_text::timestamp
          at time zone 'Africa/Harare'
      else matched.received_at_text::timestamptz
    end,
    matched.received_at_text::timestamptz,
    matched.cumulative_value_text::numeric
      * case matched.cumulative_unit
          when 'm3' then 1000
          when 'l' then 1
          else 1
        end,
    null,
    case
      when matched.instant_value_text ~ '^-?[0-9]+([.][0-9]+)?$'
        then matched.instant_value_text::numeric
          * case matched.instant_unit
              when 'm3/h' then 1000.0 / 60.0
              when 'l/h' then 1.0 / 60.0
              -- The current decoder emits "flow_rate"; its numeric value is
              -- treated as L/min until it emits a more specific unit.
              else 1
            end
      else null
    end,
    case
      when matched.reverse_value_text ~ '^-?[0-9]+([.][0-9]+)?$'
        then matched.reverse_value_text::numeric
          * case matched.reverse_unit
              when 'm3' then 1000
              when 'l' then 1
              else 1
            end
      else null
    end,
    case
      when matched.rx ->> 'rssi' ~ '^-?[0-9]+$'
        then (matched.rx ->> 'rssi')::integer
      else null
    end,
    case
      when matched.rx ->> 'snr' ~ '^-?[0-9]+([.][0-9]+)?$'
        then (matched.rx ->> 'snr')::numeric
      else null
    end,
    case
      when matched.decoded ->> 'checksum_ok' in ('true', 'false')
        then (matched.decoded ->> 'checksum_ok')::boolean
      else null
    end,
    matched.uplink
  from matched_uplinks matched
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'window', p_last,
    'fetched', v_fetched,
    'inserted', v_inserted,
    'skipped_unmatched_invalid_or_duplicate', v_fetched - v_inserted,
    'completed_at', now()
  );
end;
$function$;

comment on function public.sync_ttn_device_readings(text) is
  'Fetches decoded TTN uplinks and idempotently stores matched meter readings.';

revoke all on function public.sync_ttn_device_readings(text)
  from public, anon, authenticated;

-- Ongoing ingestion: run every 15 minutes and refetch the last two hours.
-- The overlap protects against temporary outages; source_message_id and the
-- table constraints make repeated imports idempotent.
select cron.schedule(
  'sync-ttn-device-readings',
  '*/15 * * * *',
  $cron$select public.sync_ttn_device_readings('2h');$cron$
);

-- Run this ONCE after applying the migration to backfill the requested 720h:
--
-- select public.sync_ttn_device_readings('720h');
--
-- Inspect recent cron runs:
--
-- select *
-- from cron.job_run_details
-- where jobid = (
--   select jobid from cron.job where jobname = 'sync-ttn-device-readings'
-- )
-- order by start_time desc
-- limit 20;
--
-- To stop ongoing ingestion:
--
-- select cron.unschedule('sync-ttn-device-readings');
