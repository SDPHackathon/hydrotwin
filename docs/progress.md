# Progress

Submission: **Fri 23 Oct, 11:59 PM** — pitch deck (≤10 slides) · 5-min video · this repo (public or judge-accessible) · optional docs.
Tick a box in the same commit that finishes it. IDs → `docs/spec.md`.

## Step A — setup ✅ (15 Oct)
- [x] Repo, folder structure, agent rules (`AGENTS.md`), spec, data contracts
- [x] Bukit Raja data: 199 OSM streets, 636 buildings, 10 drains with real elevation (`npm run data`)
- [x] Engine: storm, drain simulator, risk rules + tests (`npm test`)
- [x] Dashboard: 3D map, streets/drains coloured live, water on flooded streets, storm controls (local) — LIVE-1, LIVE-2
- [x] Supabase schema + seed, checked on Postgres (`supabase/`)
- [x] Water slabs: blue water rises on the roads of overflowing zones and spreads toward the houses (`flood-zones.geojson`, `lib/water.ts`)
- [x] Fill rings on drains (blue dot grows with the level) · demo storm 126 mm/h → water spreads across 7 zones in order

## Step B — live loop on Supabase ✅ (16 Oct)
- [x] Create the Supabase project (free) · **turn OFF public sign-ups**
- [x] Database schema + seed applied (`supabase/migrations/20261015000000_init.sql`, `supabase/seed.sql`)
- [x] `.env.local` from `.env.example`
- [x] Backend risk engine API (`/api/risk-engine`) running pure `assess()` & Supabase sync
- [x] `/control` (phone): start / pause / reset / speed + per-drain sliders → POST readings each tick
- [x] Dashboard listens to `drain_status` via Realtime with local/cloud toggle — LIVE-3, LIVE-4
- [x] Spike check: laptop dashboard + phone control page on the same Wi-Fi, colours change < 2 s
- [x] Copy the vetted skills into `.claude/skills/` (Azim, 16 Oct — 5 skills, pinned + licensed, `.claude/skills/README.md`)

## Step C — residents + guards ✅ (16 Oct)
- [x] Fictional residents seed (some vulnerable, on D07/D08 streets) (`20261016000000_residents_and_realtime.sql`)
- [x] `/resident` (phone early warning, actions, SOS check-in) — LIVE-5
- [x] `/guard` (phone incident response desk, vulnerable resident task list) — LIVE-6

## Step D — Plan mode ✅ (16 Oct)
- [x] PLAN-1 · PLAN-2 · PLAN-3 (interventions, replay storm scorecard, 3D overlays, saved plans)
- [x] Dynamic recommended upgrades scored against the active township and demo storm

## Step E — Safe routes ✅ (16 Oct)
- [x] ROUTE-1 (Dijkstra graph routing avoiding submerged red streets, 3D map emerald route overlay)
- [x] Township-specific safe destinations, nearest reachable walking route, explicit failures, and violet route endpoint markers
- [x] Click-to-pin origin and safe destination along road segments, alongside dropdown selection

## Wrap-up
- [ ] 20–21 Oct: rough cut of the video (laptop dashboard + phone alert, voice-over)
- [ ] 22 Oct: full run-through · README final · AI-use log + third-party list complete · repo public
- [ ] 23 Oct: Danish submits
