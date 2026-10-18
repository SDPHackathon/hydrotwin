-- Lock the demo-time public policies from 20261016000000_residents_and_realtime.sql.
-- Every write goes through the Next.js server with SUPABASE_SERVICE_ROLE_KEY (server only, .env.local),
-- which bypasses RLS — docs/data-contracts.md › "RLS is on for every table". Without this migration,
-- anyone holding the publishable key could write guard_tasks, check_ins, drain_status and readings,
-- and read the vulnerable-residents list.
-- The public reads from 20261015000000_init.sql stay (drains, streets, drain_status, plan_scenarios),
-- so the map and Realtime keep working. Safe to run more than once.

drop policy if exists "public read residents"      on public.residents;
drop policy if exists "public insert check_ins"    on public.check_ins;
drop policy if exists "public read check_ins"      on public.check_ins;
drop policy if exists "public read guard_tasks"    on public.guard_tasks;
drop policy if exists "public insert guard_tasks"  on public.guard_tasks;
drop policy if exists "public update guard_tasks"  on public.guard_tasks;
drop policy if exists "public update drain_status" on public.drain_status;
drop policy if exists "public insert drain_status" on public.drain_status;
drop policy if exists "public insert readings"     on public.readings;
