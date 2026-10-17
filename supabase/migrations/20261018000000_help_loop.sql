-- Call-for-help loop (lib/engine/help.ts, docs/data-contracts.md › Call for help).
-- A guard task now moves open → on_the_way → done and carries what the resident asked for.

alter table public.guard_tasks drop constraint if exists guard_tasks_state_check;
alter table public.guard_tasks
  add constraint guard_tasks_state_check check (state in ('open', 'on_the_way', 'done'));

alter table public.guard_tasks
  add column if not exists help_type text
    check (help_type in ('trapped', 'medical', 'evacuate', 'water_in_house', 'other')),
  add column if not exists people integer check (people between 1 and 10),
  add column if not exists note text check (char_length(note) <= 80),
  add column if not exists accepted_at timestamptz,
  add column if not exists responder_name text check (char_length(responder_name) <= 40);

-- One live task per resident, in either live state.
drop index if exists public.guard_tasks_one_open;
create unique index guard_tasks_one_open on public.guard_tasks (resident_id)
  where state in ('open', 'on_the_way');

-- The request travels with the check-in too, so the guard sees the ask even before a task exists.
alter table public.check_ins
  add column if not exists help_type text
    check (help_type in ('trapped', 'medical', 'evacuate', 'water_in_house', 'other')),
  add column if not exists people integer check (people between 1 and 10),
  add column if not exists note text check (char_length(note) <= 80);

-- Guards accept (→ on_the_way) as well as close (→ done). Guards are not Auth users in the demo
-- (a display name is recorded in responder_name), so done_by is no longer required.
drop policy if exists "guards close tasks" on public.guard_tasks;
create policy "guards update tasks" on public.guard_tasks for update to authenticated
  using (state in ('open', 'on_the_way')) with check (state in ('on_the_way', 'done'));
