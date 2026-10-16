-- Step B & Step C: Fictional Residents, Guard Tasks & Realtime Policies
-- Follows docs/data-contracts.md and Rule 8 of AGENTS.md (all fictional personas).

-- 1. Insert Fictional Residents across low-lying zones (D08, D07) and surrounding streets
insert into public.residents (id, display_name, street_id, vulnerable, needs) values
  ('11111111-1111-4111-8111-111111111111', 'Pak Dollah', 'w164812609', true, 'Elderly (78yo), lives alone, limited mobility'),
  ('22222222-2222-4222-8222-222222222222', 'Puan Siti Rokiah', 'w164812661', true, 'Bedridden, requires oxygen concentrator'),
  ('33333333-3333-4333-8333-333333333333', 'Tan Wei Ming', 'w164812609', false, 'Ground floor terrace, family with 2 toddlers'),
  ('44444444-4444-4444-8444-444444444444', 'Cikgu Aminah', 'w164812569', true, 'Wheelchair user, ramp entrance needed'),
  ('55555555-5555-4555-8555-555555555555', 'Uncle Muthu', 'w164812603', true, 'Elderly couple (82yo), hearing impaired'),
  ('66666666-6666-4666-8666-666666666666', 'Farid & Aisyah', 'w164812607', false, 'Two vehicles parked on porch, needs early warning'),
  ('77777777-7777-4777-8777-777777777777', 'David Lee', 'w164812549', false, 'Single tenant, remote worker'),
  ('88888888-8888-4888-8888-888888888888', 'Puan Salmah', 'w164812620', true, 'Dialysis patient, scheduled transport needed'),
  ('99999999-9999-4999-8999-999999999999', 'Dr. Siva', 'w164812591', false, 'High ground safe zone, certified first responder')
on conflict (id) do nothing;

-- 2. Allow public/demo read on residents so mobile resident page can select demo profile
create policy "public read residents" on public.residents
  for select to anon, authenticated using (true);

-- 3. Allow public/demo check-in logging
create policy "public insert check_ins" on public.check_ins
  for insert to anon, authenticated with check (true);

create policy "public read check_ins" on public.check_ins
  for select to anon, authenticated using (true);

-- 4. Allow public/demo guard task management for hackathon demo
create policy "public read guard_tasks" on public.guard_tasks
  for select to anon, authenticated using (true);

create policy "public insert guard_tasks" on public.guard_tasks
  for insert to anon, authenticated with check (true);

create policy "public update guard_tasks" on public.guard_tasks
  for update to anon, authenticated using (true);

-- 5. Allow simulation engine to update drain_status & readings during hackathon demo
create policy "public update drain_status" on public.drain_status
  for update to anon, authenticated using (true);

create policy "public insert drain_status" on public.drain_status
  for insert to anon, authenticated with check (true);

create policy "public insert readings" on public.readings
  for insert to anon, authenticated with check (true);
