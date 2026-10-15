# Progress

Submission: **Fri 23 Oct, 11:59 PM** — pitch deck (≤10 slides) · 5-min video · this repo (public or judge-accessible) · optional docs.
Tick a box in the same commit that finishes it. IDs → `docs/spec.md`.

## Step A — setup ✅ (15 Oct)
- [x] Repo, folder structure, agent rules (`AGENTS.md`), spec, data contracts
- [x] Bukit Raja data: 199 OSM streets, 636 buildings, 10 drains with real elevation (`npm run data`)
- [x] Engine: storm, drain simulator, risk rules + tests (`npm test`)
- [x] Dashboard: 3D map, streets/drains coloured live, water on flooded streets, storm controls (local) — LIVE-1, LIVE-2
- [x] Supabase schema + seed, checked on Postgres (`supabase/`)

## Step B — live loop on Supabase (16–17 Oct) ← next
- [ ] Create the Supabase project (free) · **turn OFF public sign-ups** · create operator + guard accounts by hand
- [ ] `supabase link` → `supabase db push` → run `supabase/seed.sql`
- [ ] `.env.local` from `.env.example`
- [ ] Edge Function `risk-engine` (contract in `data-contracts.md`) — import `lib/engine/` as is
- [ ] `/control` (phone): start / pause / reset / speed + per-drain sliders → POST readings each tick
- [ ] Dashboard listens to `drain_status` via Realtime instead of `useLocalStorm` — LIVE-3, LIVE-4
- [ ] Spike check: laptop dashboard + phone control page on the same Wi-Fi, colours change < 2 s
- [ ] Copy the vetted skills into `.claude/skills/` (Azim)

## Step C — residents + guards (17–18 Oct)
- [ ] Fictional residents seed (some vulnerable, on D07/D08 streets)
- [ ] `/resident` — LIVE-5 · `/guard` — LIVE-6

## Step D — Plan mode (19–20 Oct)
- [ ] PLAN-1 · PLAN-2 · PLAN-3 (port useful HydroTwin prototype parts)

## Step E — Safe routes (21 Oct)
- [ ] ROUTE-1

## Wrap-up
- [ ] 20–21 Oct: rough cut of the video (laptop dashboard + phone alert, voice-over)
- [ ] 22 Oct: full run-through · README final · AI-use log + third-party list complete · repo public
- [ ] 23 Oct: Danish submits
