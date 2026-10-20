-- Better help-request management (lib/engine/help.ts, docs/data-contracts.md › Call for help).
-- Tasks can now be cancelled by residents (state: cancelled, cancelled_at) and guards
-- record an outcome upon resolution (outcome: assisted_upstairs, evacuated, confirmed_safe, other)
-- with an optional custom outcome_note for 'other'.

alter table public.guard_tasks drop constraint if exists guard_tasks_state_check;
alter table public.guard_tasks
  add constraint guard_tasks_state_check check (state in ('open', 'on_the_way', 'done', 'cancelled'));

alter table public.guard_tasks
  add column if not exists cancelled_at timestamptz,
  add column if not exists outcome text
    check (outcome is null or outcome in ('assisted_upstairs', 'evacuated', 'confirmed_safe', 'other')),
  add column if not exists outcome_note text;
