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

## Step F — call for help, two-way (Azim, 17 Oct →)
- [x] Engine: help request rules, task lifecycle `open → on_the_way → done`, responder route from the nearest guard post (`lib/engine/help.ts`, `lib/guards-data.ts`, 12 tests)
- [x] Server + API: check-in carries the ask; `accept` / `resolve` with the guard's name; migration `20261018000000_help_loop.sql`; contracts updated
- [x] `/resident`: help sheet (type, people, note) → live tracker (sent → on the way → resolved), vibration on changes
- [x] `/guard`: pick a guard, Start shift (alert sound), SOS cards with the ask + elapsed timer, *On my way* → *Resolved*
- [x] Route to the resident on a small map, wet stretch dashed — ROUTE-2 (`components/ResponderMap.tsx`)
- [x] Installable phone pages (manifests + icons) · README phone section (same Wi-Fi link, Add to Home Screen)
- [ ] Azim's phone on the laptop's network: Add to Home Screen, Start shift beep, full loop phone ↔ phone — use a phone hotspot (big shared Wi-Fi blocks phone ↔ laptop, 19 Oct)

## Development screening extension (18 Oct) ✅
- [x] Plan mode: new development workflow alongside existing township upgrades; draw/undo/finish a site boundary, choose housing/commercial, automatic nearest-road / Live zone suggestions with manual overrides, before/after land cover
- [x] Pure engine: explicit area-weighted runoff assumptions, three identical-storm replays, receiving-zone street impacts and access-road screening; no plot-level or downstream prediction
- [x] Map previews for existing/developed/mitigated independent zone peaks, proposed-site boundary and access-road overlay
- [x] Versioned browser storage, load proposals, compare two at any scenario stage; existing upgrade saves preserved
- [x] Validation: 43 engine tests (11 development tests), lint and production build pass; browser verified drawing, presets, scenario results/map, saved comparisons and persistence; automatic selection, manual overrides and restore suggestions; no browser console errors
- [x] Development v2: remove manual catchment area, estimate zone footprint from the existing street cluster; legacy development saves remain readable and recalculate with current assumptions
- [x] 19 Oct: development access road uses a solid near-black line with white casing and matching legend for contrast against status roads and water; verified on localhost:3000 after map reload.
- [x] 19 Oct: completed development sites show labelled, infinitely moving runoff arrows toward the selected simulated drain zone; schematic connection, with static arrows for reduced motion.

## Traffic extension — first working release (19 Oct)

- [x] 19 Oct review/handoff: recorded the user's request for real initial traffic and discussion of AI assumptions in `docs/traffic-real-data-handoff-plan.md`.
- [x] Implemented real initial baseline loading on opening Traffic, honest unobserved road coloring (#a8a29e grey), road closure coloring (#7f1d1d), destination distribution split (70% external gateways / 30% internal hubs weighted by road capacity), trip generation presets (Low/Base/High), honest coverage-qualified conclusions and notes (existing baseline congestion and unassigned trips). 67 tests pass cleanly, lint and build pass.

### Current workflow — real-data township impact (supersedes replay UI below)

- [x] Retain MapLibre. Draw township → housing/commercial size → automatic existing-road connection → Assess township impact → Current traffic / With township. Removed replay, manual synthetic background traffic, timeline and mitigation stages from the workspace.
- [x] Server-only TomTom Traffic Flow integration, bounded on-demand batches (24 samples maximum), no raw data persistence, process-local refresh throttle, confidence/age/direction/geometry checks and unknown grey roads. User configured the private key locally; server detection and a live response were verified without exposing its value.
- [x] Pure impact engine: inferred speed-to-demand sensitivity with explicit BPR assumptions, ten incremental route-assignment batches, closures excluded, incomplete coverage shown. Heavy matching runs in the worker; geometry bounds and one endpoint check per candidate fixed the slowdown found with real 500+ vertex provider polylines.
- [x] Browser live run returned 24/24 samples and matched 39/65 affected segments (~50% assigned-distance coverage) for the test site; current/proposed views, drawing, access suggestion and completed result confirmed. Unit suite expanded to 63 tests. Production builds use the supported Webpack fallback described below.
- [ ] Historical peak-hour data and calibrated regional OD/volume/capacity inputs remain future work; current snapshots plus inferred load do not establish a calibrated future forecast.

### Earlier implementation history (replay UI replaced)

- [x] Independent directed OSM network artifact for Bukit Raja: 1,979 segments, 10 reported components; node connectivity, mapped one-way/access restrictions, basic turn restrictions and online preparation with official OSM fallback. Existing flood bundle unchanged.
- [x] Pure deterministic traffic engine, seeded synthetic OD demand, point queues and shared junction budgets; worker-based three-scenario comparison, timeline playback, queue colours, road inspection and explicit assumptions.
- [x] Traffic development drawing, housing/commercial trip rates, suggested existing-node access with override, trip-reduction and road-capacity mitigations; local draft save/load.
- [x] Validation: 54 tests pass, lint and TypeScript pass; browser baseline, site drawing/access, existing/developed/mitigated comparison, timeline, saves and mobile layout inspected. Baseline benchmark including anchor selection ~1.1 s for 1,979 segments / 630 trips. Production build passes using `npm run build -- --webpack`; default Turbopack build fails here before compiler helper connection (exit 0), with the same failure across Node runtimes.
- [ ] Later plan stages: boundary portals, access-segment insertion, per-road attribute overrides, full conditional/via-way restrictions, barrier handling, measured demand calibration, upstream spillback, second access, journey explorer and flood coupling.

## UI Navigation & Polish (18–19 Oct)
- [x] 18 Oct: map-centered expanding mode navigation replaces sidebar tabs; animated label entrance, hover/focus dashes and image crossfades, keyboard selection/Escape, reduced-motion support; licensed replaceable local stock images
- [x] 19 Oct: swapped township and mode navigation positions; compact sidebar mode tabs, expanding map township picker with current location label, hover/focus previews, scrollable downloaded locations and download action; responsive list layout
- [x] 19 Oct: mode switches blur the map and panel before changing content, then sharpen; styles imported directly by Dashboard to fix stale development CSS; captured intermediate blur for all three top-center tabs on localhost:3000 and verified return to clear
- [x] 19 Oct: Overpass server download robustness: replaced dead mirror with OSM France mirror, aligned client timeout with query timeout

## Wrap-up
- [x] Cloud: migrations `20261016…` + `20261018…_help_loop` applied (Danish, 18 Oct) · setup guide sent (Azim)
- [x] Cloud: `20261018234500_lock_public_writes.sql` applied (Azim, 19 Oct) — 8 policies left, checked in Database → Policies
- [ ] Cloud: `SUPABASE_SERVICE_ROLE_KEY` on the demo laptop → test Cloud Phone Sync
- [ ] 20–21 Oct: rough cut of the video (laptop dashboard + phone alert, voice-over)
- [ ] 22 Oct: full run-through · README final · AI-use log + third-party list complete · repo public
- [ ] 23 Oct: Danish submits
