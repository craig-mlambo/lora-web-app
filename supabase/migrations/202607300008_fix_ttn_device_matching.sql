-- Improve TTN reading ingestion by matching devices using the decoded meter
-- serial as well as TTN device_id and DevEUI. The original importer grouped
-- invalid, unmatched, and duplicate uplinks into one counter, which made a
-- registration mismatch difficult to diagnose.

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
  v_uplink jsonb;
  v_decoded jsonb;
  v_rx jsonb;
  v_device_id uuid;
  v_ttn_device_id text;
  v_dev_eui text;
  v_meter_serial text;
  v_application_id text;
  v_received_at_text text;
  v_frame_counter_text text;
  v_cumulative_text text;
  v_cumulative_unit text;
  v_instant_text text;
  v_instant_unit text;
  v_reverse_text text;
  v_reverse_unit text;
  v_meter_time_text text;
  v_source_message_id text;
  v_row_count integer;
  v_fetched integer := 0;
  v_decoded_valid integer := 0;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_invalid_or_undecodable integer := 0;
  v_unmatched integer := 0;
  v_unmatched_identity jsonb;
  v_unmatched_identities jsonb := '[]'::jsonb;
begin
  if p_last is null
    or p_last !~ '^[1-9][0-9]*h$'
    or replace(p_last, 'h', '')::integer > 2160
  then
    raise exception
      'Invalid TTN window: %. Use an hour value from 1h through 2160h.',
      p_last;
  end if;

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

  for v_uplink in
    select item
    from jsonb_array_elements(v_payload -> 'uplinks') as uplinks(item)
  loop
    v_decoded := coalesce(
      nullif(v_uplink -> 'decoded', 'null'::jsonb),
      v_uplink #> '{uplink_message,decoded_payload}'
    );
    v_received_at_text := v_uplink ->> 'received_at';
    v_cumulative_text := v_decoded #>> '{cumulative_flow,value}';

    -- device_readings.cumulative_litres and reading_time are mandatory.
    -- Short control frames in the sample have decoded = null, so storing them
    -- as readings would create false zero-consumption records.
    if v_decoded is null
      or v_received_at_text is null
      or v_cumulative_text is null
      or v_cumulative_text !~ '^[0-9]+([.][0-9]+)?$'
    then
      v_invalid_or_undecodable := v_invalid_or_undecodable + 1;
      continue;
    end if;

    v_decoded_valid := v_decoded_valid + 1;
    v_ttn_device_id := nullif(
      v_uplink #>> '{end_device_ids,device_id}',
      ''
    );
    v_dev_eui := upper(
      regexp_replace(
        coalesce(v_uplink #>> '{end_device_ids,dev_eui}', ''),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    );
    v_meter_serial := upper(
      regexp_replace(
        coalesce(v_decoded ->> 'serial', ''),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    );
    v_application_id :=
      v_uplink #>> '{end_device_ids,application_ids,application_id}';
    v_frame_counter_text := v_uplink #>> '{uplink_message,f_cnt}';
    v_rx := v_uplink #> '{uplink_message,rx_metadata,0}';
    v_cumulative_unit :=
      lower(v_decoded #>> '{cumulative_flow,unit}');
    v_instant_text := v_decoded #>> '{instant_flow,value}';
    v_instant_unit := lower(v_decoded #>> '{instant_flow,unit}');
    v_reverse_text := v_decoded #>> '{reverse_flow,value}';
    v_reverse_unit := lower(v_decoded #>> '{reverse_flow,unit}');
    v_meter_time_text := v_decoded ->> 'meter_time';
    v_device_id := null;

    select device.id
      into v_device_id
    from public.devices device
    where (
        v_ttn_device_id is not null
        and device.ttn_device_id = v_ttn_device_id
      )
      or (
        v_dev_eui <> ''
        and upper(
          regexp_replace(
            coalesce(device.dev_eui, ''),
            '[^A-Za-z0-9]',
            '',
            'g'
          )
        ) = v_dev_eui
      )
      or (
        v_meter_serial <> ''
        and upper(
          regexp_replace(
            coalesce(device.serial_number, ''),
            '[^A-Za-z0-9]',
            '',
            'g'
          )
        ) = v_meter_serial
      )
      or (
        v_ttn_device_id is not null
        and device.serial_number = v_ttn_device_id
      )
    order by
      case
        when device.ttn_device_id = v_ttn_device_id then 1
        when upper(
          regexp_replace(
            coalesce(device.dev_eui, ''),
            '[^A-Za-z0-9]',
            '',
            'g'
          )
        ) = v_dev_eui then 2
        when upper(
          regexp_replace(
            coalesce(device.serial_number, ''),
            '[^A-Za-z0-9]',
            '',
            'g'
          )
        ) = v_meter_serial then 3
        else 4
      end,
      device.created_at asc
    limit 1;

    if v_device_id is null then
      v_unmatched := v_unmatched + 1;
      v_unmatched_identity := jsonb_build_object(
        'ttn_device_id', v_ttn_device_id,
        'dev_eui', nullif(v_dev_eui, ''),
        'meter_serial', nullif(v_meter_serial, '')
      );

      if not v_unmatched_identities @> jsonb_build_array(v_unmatched_identity) then
        v_unmatched_identities :=
          v_unmatched_identities || jsonb_build_array(v_unmatched_identity);
      end if;
      continue;
    end if;

    v_source_message_id := concat(
      'ttn:',
      coalesce(v_application_id, 'unknown-app'),
      ':',
      coalesce(v_ttn_device_id, nullif(v_dev_eui, ''), v_meter_serial),
      ':',
      coalesce(v_frame_counter_text, 'no-frame'),
      ':',
      v_received_at_text
    );

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
    values (
      v_device_id,
      v_source_message_id,
      case
        when v_frame_counter_text ~ '^[0-9]+$'
          then v_frame_counter_text::bigint
        else null
      end,
      case
        when v_meter_time_text
          ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}:[0-9]{2}'
          then v_meter_time_text::timestamp
            at time zone 'Africa/Harare'
        else v_received_at_text::timestamptz
      end,
      v_received_at_text::timestamptz,
      v_cumulative_text::numeric
        * case v_cumulative_unit
            when 'm3' then 1000
            when 'l' then 1
            else 1
          end,
      null,
      case
        when v_instant_text ~ '^-?[0-9]+([.][0-9]+)?$'
          then v_instant_text::numeric
            * case v_instant_unit
                when 'm3/h' then 1000.0 / 60.0
                when 'l/h' then 1.0 / 60.0
                else 1
              end
        else null
      end,
      case
        when v_reverse_text ~ '^-?[0-9]+([.][0-9]+)?$'
          then v_reverse_text::numeric
            * case v_reverse_unit
                when 'm3' then 1000
                when 'l' then 1
                else 1
              end
        else null
      end,
      case
        when v_rx ->> 'rssi' ~ '^-?[0-9]+$'
          then (v_rx ->> 'rssi')::integer
        else null
      end,
      case
        when v_rx ->> 'snr' ~ '^-?[0-9]+([.][0-9]+)?$'
          then (v_rx ->> 'snr')::numeric
        else null
      end,
      case
        when v_decoded ->> 'checksum_ok' in ('true', 'false')
          then (v_decoded ->> 'checksum_ok')::boolean
        else null
      end,
      v_uplink
    )
    on conflict do nothing;

    get diagnostics v_row_count = row_count;
    if v_row_count = 1 then
      v_inserted := v_inserted + 1;
    else
      v_duplicates := v_duplicates + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'window', p_last,
    'fetched', v_fetched,
    'decoded_valid', v_decoded_valid,
    'inserted', v_inserted,
    'duplicates', v_duplicates,
    'invalid_or_undecodable', v_invalid_or_undecodable,
    'unmatched', v_unmatched,
    'unmatched_device_identifiers', v_unmatched_identities,
    'completed_at', now()
  );
end;
$function$;

comment on function public.sync_ttn_device_readings(text) is
  'Fetches TTN uplinks and stores matched decoded readings, resolving devices by TTN ID, DevEUI, or meter serial.';

revoke all on function public.sync_ttn_device_readings(text)
  from public, anon, authenticated;

-- The existing sync-ttn-device-readings cron job automatically uses this
-- replacement function. Run the 720-hour backfill again after this migration:
--
-- select public.sync_ttn_device_readings('720h');
