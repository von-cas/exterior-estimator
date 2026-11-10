-- One function per business action. Each runs in one transaction, checks the
-- actor's role itself, and is callable only by the app's server (service role).
-- The server has already checked the signed-in user; the second check here
-- means a bug in the app cannot skip a role rule.

create or replace function public.require_role(p_actor uuid, variadic p_roles text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_actor and role = any(p_roles)) then
    raise exception 'not allowed: needs role %', array_to_string(p_roles, ' or ') using errcode = '42501';
  end if;
  perform set_config('app.actor', p_actor::text, true);
end $$;

-- A report and everything read from it, in one go.
create or replace function public.create_report(
  p_actor uuid, p_job_id uuid, p_job_name text, p_source text, p_file_path text, p_sha256 text,
  p_report_date date, p_measurements jsonb, p_windows jsonb, p_flags jsonb, p_status text default 'needs_review'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_job uuid := p_job_id; v_report uuid;
begin
  perform require_role(p_actor, 'admin', 'estimator');
  if v_job is null then
    insert into jobs (name, created_by) values (p_job_name, p_actor) returning id into v_job;
  end if;
  if p_sha256 is not null and exists (select 1 from measurement_reports where job_id = v_job and file_sha256 = p_sha256) then
    raise exception 'this report was already uploaded to this job' using errcode = '23505';
  end if;
  insert into measurement_reports (job_id, source, file_path, file_sha256, report_date, status, created_by)
  values (v_job, p_source, p_file_path, p_sha256, p_report_date, p_status, p_actor) returning id into v_report;

  insert into measurements (report_id, key, label, value, unit, page, source_text, source, original_value, updated_by)
  select v_report, m->>'key', m->>'label', (m->>'value')::numeric, m->>'unit', (m->>'page')::int, m->>'source_text',
         coalesce(m->>'source', 'report'), (m->>'value')::numeric, p_actor
  from jsonb_array_elements(p_measurements) m;

  insert into measurement_windows (report_id, width, height, count, page)
  select v_report, (w->>'width')::numeric, (w->>'height')::numeric, (w->>'count')::int, (w->>'page')::int
  from jsonb_array_elements(coalesce(p_windows, '[]')) w;

  insert into flags (report_id, severity, code, message, measurement_key)
  select v_report, f->>'severity', f->>'code', f->>'message', f->>'measurement_key'
  from jsonb_array_elements(coalesce(p_flags, '[]')) f;

  insert into event_log (actor, event, entity, entity_id, detail)
  values (p_actor, 'report.created', 'measurement_report', v_report,
          jsonb_build_object('source', p_source, 'flags', jsonb_array_length(coalesce(p_flags, '[]'))));
  return jsonb_build_object('job_id', v_job, 'report_id', v_report);
end $$;

-- A person corrects or fills in a value. The value the report gave is kept.
create or replace function public.set_measurement(p_actor uuid, p_report uuid, p_key text, p_value numeric, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_actor, 'admin', 'estimator');
  if (select status from measurement_reports where id = p_report) = 'verified' then
    raise exception 'measurements are verified; reopen them first';
  end if;
  if p_value is not null and p_value < 0 then raise exception 'a measurement cannot be negative'; end if;
  update measurements set value = p_value, updated_by = p_actor, updated_at = now()
  where report_id = p_report and key = p_key;
  if not found then raise exception 'no measurement % on this report', p_key; end if;
  -- Filling in a value clears the flag that said it was missing.
  update flags set status = 'cleared', resolved_by = p_actor, resolved_at = now(), note = coalesce(p_note, 'value entered')
  where report_id = p_report and measurement_key = p_key and code = 'missing' and status = 'open' and p_value is not null;
end $$;

create or replace function public.clear_flag(p_actor uuid, p_flag uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_actor, 'admin', 'estimator');
  if coalesce(trim(p_note), '') = '' then raise exception 'say why the flag is cleared'; end if;
  update flags set status = 'cleared', resolved_by = p_actor, resolved_at = now(), note = p_note
  where id = p_flag and status = 'open';
  if not found then raise exception 'flag not found or already cleared'; end if;
end $$;

-- Gate 1: the measurements.
create or replace function public.verify_measurements(p_actor uuid, p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_open int; v_missing text;
begin
  perform require_role(p_actor, 'admin', 'estimator');
  select count(*) into v_open from flags where report_id = p_report and severity = 'blocking' and status = 'open';
  if v_open > 0 then raise exception '% blocking flag(s) still open', v_open; end if;
  select string_agg(label, ', ') into v_missing from measurements where report_id = p_report and value is null;
  if v_missing is not null then raise exception 'still missing: %', v_missing; end if;
  update measurement_reports set status = 'verified', verified_by = p_actor, verified_at = now() where id = p_report;
  insert into event_log (actor, event, entity, entity_id) values (p_actor, 'measurements.verified', 'measurement_report', p_report);
end $$;

create or replace function public.reopen_measurements(p_actor uuid, p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_actor, 'admin', 'estimator');
  if exists (select 1 from estimates where report_id = p_report and status = 'approved') then
    raise exception 'an approved estimate uses these measurements; start a change order instead';
  end if;
  update measurement_reports set status = 'needs_review', verified_by = null, verified_at = null where id = p_report;
end $$;

create or replace function public.record_field_measure(p_actor uuid, p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_actor, 'admin', 'estimator', 'production');
  update measurement_windows set field_measured = true where report_id = p_report;
  insert into event_log (actor, event, entity, entity_id) values (p_actor, 'windows.field_measured', 'measurement_report', p_report);
end $$;

-- Saves the inputs and the engine's result. row_version stops two people overwriting each other.
create or replace function public.save_estimate(
  p_actor uuid, p_estimate uuid, p_job uuid, p_report uuid, p_expected_row_version int,
  p_trades text[], p_inputs jsonb, p_trade_prices jsonb, p_customer_total int, p_has_blocking boolean,
  p_margins jsonb, p_result jsonb, p_prices_used jsonb, p_total_cost int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_estimate; v_row int; v_status text;
begin
  perform require_role(p_actor, 'admin', 'estimator');
  if v_id is null then
    insert into estimates (job_id, report_id, version, trades, inputs, trade_prices, customer_total, has_blocking, created_by)
    values (p_job, p_report, coalesce((select max(version) + 1 from estimates where job_id = p_job), 1),
            p_trades, p_inputs, p_trade_prices, p_customer_total, p_has_blocking, p_actor)
    returning id, row_version into v_id, v_row;
  else
    select status into v_status from estimates where id = v_id for update;
    if v_status = 'approved' then raise exception 'this estimate is approved; re-pricing creates a new version'; end if;
    update estimates set trades = p_trades, inputs = p_inputs, trade_prices = p_trade_prices,
      customer_total = p_customer_total, has_blocking = p_has_blocking,
      row_version = row_version + 1, updated_at = now()
    where id = v_id and row_version = p_expected_row_version
    returning row_version into v_row;
    if not found then
      raise exception 'someone else changed this estimate; reload it' using errcode = '40001';
    end if;
  end if;
  insert into estimate_costs (estimate_id, margins, result, prices_used, total_cost)
  values (v_id, p_margins, p_result, p_prices_used, p_total_cost)
  on conflict (estimate_id) do update set margins = excluded.margins, result = excluded.result,
    prices_used = excluded.prices_used, total_cost = excluded.total_cost;
  return jsonb_build_object('id', v_id, 'row_version', v_row);
end $$;

-- Gate 2: the estimate. Creates one draft purchase order per supplier.
create or replace function public.approve_estimate(p_actor uuid, p_estimate uuid, p_expected_row_version int, p_purchase_orders jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e estimates%rowtype; po jsonb;
begin
  perform require_role(p_actor, 'admin', 'estimator');
  select * into e from estimates where id = p_estimate for update;
  if e.status <> 'draft' then raise exception 'estimate is already approved'; end if;
  if e.row_version <> p_expected_row_version then raise exception 'someone else changed this estimate; reload it' using errcode = '40001'; end if;
  if e.has_blocking then raise exception 'the estimate still has blocking issues'; end if;
  if (select status from measurement_reports where id = e.report_id) <> 'verified' then
    raise exception 'verify the measurements first';
  end if;
  update estimates set status = 'approved', approved_by = p_actor, approved_at = now(), row_version = row_version + 1 where id = p_estimate;
  for po in select * from jsonb_array_elements(p_purchase_orders) loop
    insert into purchase_orders (estimate_id, supplier, lines, total_cost, idempotency_key)
    values (p_estimate, po->>'supplier', po->'lines', (po->>'cost')::int, p_estimate::text || ':' || md5(po->>'supplier'));
  end loop;
  insert into event_outbox (event_type, entity_id, payload, idempotency_key)
  values ('estimate.approved', p_estimate,
          jsonb_build_object('estimate_id', p_estimate, 'job_id', e.job_id, 'customer_total', e.customer_total, 'trade_prices', e.trade_prices),
          'estimate.approved:' || p_estimate);
  insert into event_log (actor, event, entity, entity_id, detail)
  values (p_actor, 'estimate.approved', 'estimate', p_estimate, jsonb_build_object('purchase_orders', jsonb_array_length(p_purchase_orders)));
end $$;

-- Gate 3: the purchase order. Queues it for n8n to send.
create or replace function public.approve_purchase_order(p_actor uuid, p_po uuid)
returns void language plpgsql security definer set search_path = public as $$
declare po purchase_orders%rowtype; v_report uuid; v_job text;
begin
  perform require_role(p_actor, 'admin', 'estimator', 'production');
  select * into po from purchase_orders where id = p_po for update;
  if po.status <> 'draft' then raise exception 'purchase order is already %', po.status; end if;
  select e.report_id, j.name into v_report, v_job from estimates e join jobs j on j.id = e.job_id where e.id = po.estimate_id;
  if exists (select 1 from jsonb_array_elements(po.lines) l where (l->>'lockedForPurchase')::boolean)
     and exists (select 1 from measurement_windows where report_id = v_report and not field_measured) then
    raise exception 'window sizes come from photos; record a field measure before ordering';
  end if;
  update purchase_orders set status = 'approved', approved_by = p_actor, approved_at = now() where id = p_po;
  insert into event_outbox (event_type, entity_id, payload, idempotency_key)
  values ('purchase_order.approved', p_po,
          jsonb_build_object('purchase_order_id', p_po, 'key', po.idempotency_key, 'job', v_job, 'supplier', po.supplier,
                             'lines', po.lines, 'total_cost', po.total_cost),
          'purchase_order.approved:' || po.idempotency_key);
  insert into event_log (actor, event, entity, entity_id) values (p_actor, 'purchase_order.approved', 'purchase_order', p_po);
end $$;

-- Outbox: n8n collects events. A claim that is not acknowledged in 10 minutes
-- goes back to the queue; after 5 attempts the event fails and is logged as an error.
create or replace function public.claim_outbox(p_limit int default 10)
returns setof event_outbox language plpgsql security definer set search_path = public as $$
begin
  return query
  update event_outbox o set status = 'claimed', claimed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select id from event_outbox
    where status = 'pending' or (status = 'claimed' and claimed_at < now() - interval '10 minutes')
    order by id limit p_limit for update skip locked
  )
  returning o.*;
end $$;

create or replace function public.ack_outbox(p_id bigint, p_ok boolean, p_error text default null)
returns text language plpgsql security definer set search_path = public as $$
declare ev event_outbox%rowtype; v_status text;
begin
  select * into ev from event_outbox where id = p_id for update;
  if not found then raise exception 'no outbox event %', p_id; end if;
  if ev.status = 'done' then return 'done'; end if; -- acknowledging twice is harmless
  if p_ok then
    v_status := 'done';
    update event_outbox set status = 'done', done_at = now(), last_error = null where id = p_id;
    if ev.event_type = 'purchase_order.approved' then
      update purchase_orders set status = 'sent', sent_at = now(), last_error = null where id = ev.entity_id;
    end if;
    insert into event_log (event, entity, entity_id, detail) values (ev.event_type || '.delivered', 'event_outbox', ev.entity_id, jsonb_build_object('outbox_id', p_id));
  else
    v_status := case when ev.attempts >= 5 then 'failed' else 'pending' end;
    update event_outbox set status = v_status, last_error = p_error where id = p_id;
    if v_status = 'failed' and ev.event_type = 'purchase_order.approved' then
      update purchase_orders set status = 'failed', last_error = p_error where id = ev.entity_id;
    end if;
    insert into event_log (level, event, entity, entity_id, detail)
    values (case when v_status = 'failed' then 'error' else 'warning' end, ev.event_type || '.delivery_failed', 'event_outbox', ev.entity_id,
            jsonb_build_object('outbox_id', p_id, 'attempt', ev.attempts, 'error', p_error));
  end if;
  return v_status;
end $$;

do $$
declare f text;
begin
  foreach f in array array['require_role(uuid,text[])',
    'create_report(uuid,uuid,text,text,text,text,date,jsonb,jsonb,jsonb,text)',
    'set_measurement(uuid,uuid,text,numeric,text)', 'clear_flag(uuid,uuid,text)',
    'verify_measurements(uuid,uuid)', 'reopen_measurements(uuid,uuid)', 'record_field_measure(uuid,uuid)',
    'save_estimate(uuid,uuid,uuid,uuid,integer,text[],jsonb,jsonb,integer,boolean,jsonb,jsonb,jsonb,integer)',
    'approve_estimate(uuid,uuid,integer,jsonb)', 'approve_purchase_order(uuid,uuid)',
    'claim_outbox(integer)', 'ack_outbox(bigint,boolean,text)', 'audit()']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
grant execute on function public.app_role(), public.has_role(text[]) to authenticated;
