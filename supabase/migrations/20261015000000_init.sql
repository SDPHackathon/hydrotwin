-- HydroTwin schema v1 (2026-10-15). Contract: docs/data-contracts.md — change both in the same commit.
-- Street/building geometry stays in public/data/<area>/*.geojson; the database holds what the backend needs.

create table public.drains (
  id text primary key,                          -- 'D01'
  name text not null,
  lng double precision not null,
  lat double precision not null,
  elevation_m double precision not null,
  bank_cm double precision not null default 120,
  catchment_factor double precision not null,   -- cm of rise per mm of rain
  outflow_cm_per_min double precision not null
);

create table public.streets (
  id text primary key,                          -- OSM way id, 'w123'
  name text,
  highway text not null,
  drain_id text not null references public.drains(id)
);
create index streets_drain on public.streets (drain_id);

-- Raw sensor readings (simulator or a real device). Written only by the risk-engine Edge Function.
create table public.readings (
  id bigint generated always as identity primary key,
  drain_id text not null references public.drains(id),
  level_cm double precision not null check (level_cm >= 0),
  rain_mm double precision not null default 0 check (rain_mm >= 0),
  sim_minute integer,                           -- null for a real device
  source text not null check (source in ('sim', 'device')),
  recorded_at timestamptz not null default now()
);
create index readings_drain_time on public.readings (drain_id, recorded_at desc);

-- Latest status per drain. Written only by the risk engine; apps listen via Realtime.
create table public.drain_status (
  drain_id text primary key references public.drains(id),
  level_cm double precision not null default 0,
  status text not null default 'green' check (status in ('green', 'amber', 'red')),
  rate_cm_per_min double precision not null default 0,
  minutes_to_red integer,
  street_depth_cm double precision not null default 0,
  updated_at timestamptz not null default now()
);

-- FICTIONAL demo residents only — never real people.
create table public.residents (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  street_id text not null references public.streets(id),
  vulnerable boolean not null default false,
  needs text                                    -- 'wheelchair user', 'elderly, lives alone', …
);

create table public.check_ins (
  id bigint generated always as identity primary key,
  resident_id uuid not null references public.residents(id),
  state text not null check (state in ('safe', 'need_help')),
  created_at timestamptz not null default now()
);

-- At red, the risk engine opens one task per vulnerable resident on that drain's streets.
create table public.guard_tasks (
  id bigint generated always as identity primary key,
  resident_id uuid not null references public.residents(id),
  drain_id text not null references public.drains(id),
  state text not null default 'open' check (state in ('open', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references auth.users(id)
);
create unique index guard_tasks_one_open on public.guard_tasks (resident_id) where state = 'open';

create table public.plan_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  changes jsonb not null,    -- [{ "drain_id": "D07", "kind": "bigger_drain" | "retention_pond" | "green_area" }]
  results jsonb,             -- { "streets_flooded": 0, "deepest_cm": 0, "minutes_to_first_red": null }
  created_at timestamptz not null default now()
);

-- RLS on everywhere. The Edge Function uses the service role, which bypasses RLS.
alter table public.drains enable row level security;
alter table public.streets enable row level security;
alter table public.readings enable row level security;
alter table public.drain_status enable row level security;
alter table public.residents enable row level security;
alter table public.check_ins enable row level security;
alter table public.guard_tasks enable row level security;
alter table public.plan_scenarios enable row level security;

-- Public map data: anyone may read.
create policy "public read" on public.drains for select to anon, authenticated using (true);
create policy "public read" on public.streets for select to anon, authenticated using (true);
create policy "public read" on public.drain_status for select to anon, authenticated using (true);
create policy "public read" on public.plan_scenarios for select to anon, authenticated using (true);

-- Guards (logged-in) see residents, check-ins and tasks, and can close a task.
-- Turn OFF public sign-ups in Supabase Auth and create guard accounts by hand — otherwise anyone is "authenticated".
create policy "guards read" on public.residents for select to authenticated using (true);
create policy "guards read" on public.check_ins for select to authenticated using (true);
create policy "guards read" on public.guard_tasks for select to authenticated using (true);
create policy "guards close tasks" on public.guard_tasks for update to authenticated
  using (state = 'open') with check (state = 'done' and done_by = auth.uid());

-- readings, check_ins (insert) and drain_status (write) have no client policies on purpose:
-- they go through Edge Functions only.

alter publication supabase_realtime add table public.drain_status, public.guard_tasks, public.check_ins;
