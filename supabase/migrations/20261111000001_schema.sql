-- Tables, row-level security and the private reports bucket.
-- Reads go through each user's session, so row-level security decides what
-- they see. Writes go through the app's server, which checks the role and
-- calls one function per business action (next migration), in one transaction.

create extension if not exists pgcrypto;

-- People and roles ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'estimator', 'sales', 'production'))
);

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = any(roles), false)
$$;

-- Catalog ------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  trade text not null check (trade in ('roofing', 'siding', 'windows', 'gutters')),
  role text not null,
  unit text not null,
  coverage numeric check (coverage is null or coverage > 0),
  active boolean not null default true
);

-- A price is never edited in place: a change is a new row, so history is automatic.
create table public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products,
  supplier text not null,
  unit_cost integer not null check (unit_cost >= 0), -- cents
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);
create unique index prices_one_current on public.prices (product_id, supplier) where valid_to is null;

create table public.labor_rates (
  id uuid primary key default gen_random_uuid(),
  trade text not null,
  task text not null,
  unit text not null,
  rate integer not null check (rate >= 0), -- cents per unit
  valid_from date not null default current_date,
  valid_to date
);
create unique index labor_rates_one_current on public.labor_rates (trade, task) where valid_to is null;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  trade text not null,
  name text not null,
  default_margin numeric not null check (default_margin >= 0 and default_margin < 1),
  unique (trade, name)
);

create table public.template_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates on delete cascade,
  key text not null unique,
  role text not null,
  label text not null,
  rule text not null check (rule in ('area', 'linear', 'per_spacing', 'per_count', 'per_item', 'fixed')),
  measurement text,
  waste numeric check (waste is null or (waste >= 0 and waste < 1)),
  spacing numeric,
  qty_each numeric,
  quantity numeric,
  bands jsonb,
  production_only boolean not null default false,
  sort integer not null default 0
);

create table public.template_labor (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates on delete cascade,
  key text not null unique,
  task text not null,
  label text not null,
  measurement text not null,
  per numeric,
  times text,
  sort integer not null default 0
);

-- Jobs and measurements ------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create table public.measurement_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  source text not null check (source in ('pdf', 'hover_api', 'seed')),
  file_path text,
  file_sha256 text,
  report_date date,
  status text not null default 'needs_review' check (status in ('reading', 'needs_review', 'verified', 'failed')),
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  verified_by uuid references auth.users,
  verified_at timestamptz,
  unique (job_id, file_sha256)
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.measurement_reports on delete cascade,
  key text not null,
  label text not null,
  value numeric, -- null = not known yet; never guessed
  unit text not null,
  page integer,
  source_text text,
  source text not null check (source in ('report', 'site', 'manual')),
  original_value numeric,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  unique (report_id, key)
);

create table public.measurement_windows (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.measurement_reports on delete cascade,
  width numeric not null check (width > 0),
  height numeric not null check (height > 0),
  count integer not null check (count > 0),
  page integer,
  field_measured boolean not null default false
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.measurement_reports on delete cascade,
  severity text not null check (severity in ('blocking', 'warning', 'info')),
  code text not null,
  message text not null,
  measurement_key text,
  status text not null default 'open' check (status in ('open', 'cleared')),
  resolved_by uuid references auth.users,
  resolved_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

-- Estimates ----------------------------------------------------------------
-- What sales may see: selling prices only.
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  report_id uuid not null references public.measurement_reports,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  trades text[] not null,
  inputs jsonb not null default '{}', -- product choices and waste; no cost
  trade_prices jsonb not null default '[]',
  customer_total integer not null default 0,
  has_blocking boolean not null default true,
  row_version integer not null default 1, -- two people cannot overwrite each other
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  approved_by uuid references auth.users,
  approved_at timestamptz,
  unique (job_id, version)
);

-- What only admin and estimators may see: cost, margin and every line.
-- result is the engine's full output; prices_used is the snapshot that a later
-- price change can never alter.
create table public.estimate_costs (
  estimate_id uuid primary key references public.estimates on delete cascade,
  margins jsonb not null,
  result jsonb not null,
  prices_used jsonb not null,
  total_cost integer not null
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates on delete cascade,
  supplier text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'failed')),
  lines jsonb not null,
  total_cost integer not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users,
  approved_at timestamptz,
  sent_at timestamptz,
  last_error text
);

-- Plumbing -----------------------------------------------------------------
create table public.event_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_id uuid not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'done', 'failed')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index event_outbox_pending on public.event_outbox (created_at) where status in ('pending', 'claimed');

create table public.event_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  actor uuid,
  event text not null,
  entity text,
  entity_id uuid,
  detail jsonb not null default '{}'
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.measurement_reports on delete set null,
  model text not null,
  prompt_version text not null,
  pages integer[] not null,
  status text not null check (status in ('ok', 'invalid_output', 'error')),
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  output jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  table_name text not null,
  row_id uuid,
  action text not null,
  before jsonb,
  after jsonb
);

create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action, before, after)
  values (
    coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid),
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'), (to_jsonb(new) ->> 'estimate_id'))::uuid,
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_measurements after insert or update or delete on public.measurements for each row execute function public.audit();
create trigger audit_windows after update or delete on public.measurement_windows for each row execute function public.audit();
create trigger audit_flags after update on public.flags for each row execute function public.audit();
create trigger audit_prices after insert or update or delete on public.prices for each row execute function public.audit();
create trigger audit_estimates after insert or update or delete on public.estimates for each row execute function public.audit();
create trigger audit_purchase_orders after insert or update or delete on public.purchase_orders for each row execute function public.audit();

-- Row-level security ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','products','prices','labor_rates','templates','template_lines','template_labor',
    'jobs','measurement_reports','measurements','measurement_windows','flags','estimates','estimate_costs',
    'purchase_orders','event_outbox','event_log','ai_runs','audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

-- Everyone signed in reads the catalog structure, jobs, measurements and selling prices.
do $$
declare t text;
begin
  foreach t in array array['profiles','products','templates','template_lines','template_labor',
    'jobs','measurement_reports','measurements','measurement_windows','flags','estimates']
  loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "signed in can read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Cost data: admin and estimators; production also needs supplier costs to order.
grant select on public.prices, public.labor_rates, public.purchase_orders, public.estimate_costs, public.event_log, public.ai_runs, public.audit_log to authenticated;
create policy "cost roles read prices" on public.prices for select to authenticated using (public.has_role('admin', 'estimator', 'production'));
create policy "cost roles read labor" on public.labor_rates for select to authenticated using (public.has_role('admin', 'estimator'));
create policy "cost roles read estimate costs" on public.estimate_costs for select to authenticated using (public.has_role('admin', 'estimator'));
create policy "ordering roles read purchase orders" on public.purchase_orders for select to authenticated using (public.has_role('admin', 'estimator', 'production'));
create policy "admin reads event log" on public.event_log for select to authenticated using (public.has_role('admin'));
create policy "admin reads ai runs" on public.ai_runs for select to authenticated using (public.has_role('admin', 'estimator'));
create policy "admin reads audit log" on public.audit_log for select to authenticated using (public.has_role('admin'));
-- event_outbox has no client policy at all: only the server reads it.

-- Private bucket for report files. No client policies: the server uploads and
-- hands out short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
