# Progress

- [x] 22 Oct: removed the two requested explanatory lines beneath resident geolocation and street search, including Malay translations.

- [x] 22 Oct: aligned Resident styling with Guard/Control: white stone-bordered cards, dark location actions, blue field focus, semantic red help actions, consistent original section icons, larger phone form inputs and bottom safe-area spacing. Checked entry, location confirmation, map/help form and English/Malay at phone width without horizontal overflow; lint, 112 tests and production build pass.

- [x] 22 Oct: added required name field to resident location help, displayed on the request tracker and guard card via existing resident_name; validated on the server and retained on request updates. Demo placeholder asks for fictional names; no database schema changes. Isolated resident-to-guard creation/update checked; lint, 112 tests and production build pass.

- [x] 22 Oct: removed the resident Google Maps explanatory paragraph and bottom simulation disclaimer at the user's request, including both translations and the unused description reference.

- [x] 22 Oct: resident location labels hide raw OSM IDs for unnamed roads, using nearby named-road context within 150 m or a plain Unnamed road fallback; English/Malay labels keep the actual selected anchor unchanged. Browser search/confirmation and both languages checked; lint, 111 tests and production build pass.

- [x] 22 Oct: trimmed resident map text to native map attribution and one concise simulation/shelter footer; removed redundant legend, extra attribution, technical timestamp and repeated disclaimer in both languages.

- [x] 22 Oct: simplified flooded-origin resident map to safe-point markers only; removed reference paths, alternate starts, preview warnings and unused preview engine/tests. Normal routes from an eligible resident origin remain supported.

- [x] 22 Oct: removed duplicate resident route-panel help button; assistance section retains the single help entry.

- [x] 22 Oct: resident flooded-origin reference map retains every safe-point anchor and displays dashed, green-road-only previews from a separate start, with English/Malay view-only warnings. Guidance remains blocked from the resident, disconnected paths are omitted, and stale/offline conditions withdraw previews. Isolated browser check covered a flooded Jalan 1/1 and offline withdrawal; lint, 112 tests and production build pass.

- [x] 22 Oct: labelled suggested-destination markers on the web Live Warning and Safe Routes map; green eligibility comes from the routing engine, unavailable points display grey, and clicking an eligible marker selects it in Safe Routes. Simplified the destination explanation. Browser selection checked; lint, all 109 tests and production build pass.

**Current (21 Oct):** completed the resumed algorithmic demo dry-point and location-based resident flow. Validation and limitations are recorded below; `docs/refuge-location-handoff.md` is now a completion record.

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

## Algorithmic dry points and location-based resident portal (21 Oct) ✅

- [x] Deterministic baseline replay selects never-red road anchors across connected mapped components for built-in, cached and new shared townships. Current selections: Bukit Raja 6, Cyberjaya 13, Taman Sri Muda 4. Baseline dryness never overrides current green access; components without suitable points report failure. Flood datasets unchanged; no AI API or added library.
- [x] Resident persona removed; one-shot Locate me with explicit confirmation, local snapping and HTTPS/accuracy/coverage checks; manual street/ID hints with approximate-endpoint disclosure. No raw GPS storage/transmission or journey tracking.
- [x] Bounded laptop-session township sharing and automatic cached-download republishing; per-area simulator state/evidence, area-aware controller and phone links, no cross-area D01 collisions. Existing cached bundles validate, including Cyberjaya's complete OSM way extending beyond its query box.
- [x] Anonymous, capability-based demo help retains its original road/area; guard lifecycle uses the existing pure rules. Other townships do not invent guard posts. Runtime sharing/help are not durable Supabase records; reopen the dashboard after restart to reshare custom downloads.
- [x] Bundled Node 24: clean lint, 100 unit tests, TypeScript and default Turbopack production build. Local production HTTP harnesses passed for all three built-ins and a disposable newly shared clone: shared revisions, idempotent publishing, conflicting selectors, changed-network rejection, area isolation, invalid anchors, red origin, six-second expiry/partial evidence and help accept/safe/resolve/cancel. Temporary production server stopped afterward.
- [x] Production browser: manual hints/confirmation, mapped route, flooded-origin withdrawal, help create/accept/resolve, unchanged help location after route-origin change, EN/BM switching, independent Cyberjaya controller, matching Cyberjaya dashboard/resident route (411 m), area-aware phone links and newly shared area in a fresh tab. Deliberately stopping the temporary server withdrew guidance and marked conditions unknown. Maps rendered; verification tab warning/error logs were empty before the intentional outage. Narrow resident content 439 px and dashboard 1280 px had no horizontal overflow. Preview saved outside repo as resident-location-route.png.
- [ ] Physical-phone GPS permission/accuracy, installation, vibration, standalone mode and map-provider denial remain unverified. No fresh upstream OSM download was performed during this continuation: the sharing path was tested with existing bundles and a new session clone. Operational shelter verification, durable authenticated multi-user service and real-world pedestrian access are future work.

Demo/pitch guide: `docs/evacuation-demo.md`. These are simulated road points, not verified shelters.

## First shared-destination iteration (21 Oct, superseded by the location flow above)

- [x] Versioned shared catalogue: five explicitly fictional Bukit Raja refuges, validated against unchanged flood-road geometry/zone assignments; automatically loaded on dashboard and resident portal. Personal pins remain opt-in device drafts.
- [x] Pure eligibility and green-first routing with amber fallback, ordered street/drain legs, deterministic destination ties, blocked/unknown origins and explicit disconnected coverage. No responder red-road permissions are reused.
- [x] Per-drain simulator evidence, no initialized green at process startup, independent six-second expiry, paused/completed frozen conditions, full route/status snapshot and no local fallback in phone mode. Supabase events trigger laptop snapshot refetch instead of mixing sources; actual readings alone renew evidence.
- [x] Embedded lazy-loaded resident map, path-specific flooding alerts, no walking line when blocked/stale/offline, immediate resident-switch clearing, non-overlapping polls and independent help-task tracking. Fixed street-origin and assistance limitations are visible. New resident route messages support EN/BM.
- [x] Validation on bundled Node 24: clean lint, 92 unit tests, TypeScript and normal production Turbopack build pass outside the restricted sandbox. Webpack production fallback also passed. Local HTTP harness verified nine residents, matching catalogue revisions, cache/error contracts, metadata-only/partial updates and controller expiry/recovery.
- [x] Browser: startup unknown; automatic route; dashboard/resident agreement (refuge C, 1506 m for Gamelan 1F); previous-route flood alert; blocked origin with no line (~1096 ms observed update); resident switch; help request → guard accept → resolution shown to resident. Maps rendered; no warning/error console entries in verification tabs. Layouts inspected at observed 439 px and 1280 px widths with no document overflow. Closure/expiry/detour cases additionally covered by deterministic unit fixtures.
- [ ] Physical-device installation, vibration, standalone display mode, deliberate browser network-loss/recovery and denied map-resource checks remain unverified; engine/HTTP expiry and failure withdrawal are covered. Real destinations, authenticated Supabase catalogue management and authorised feeds remain a later release.

Demo instructions, fixture harness and pitch limitations: `docs/evacuation-demo.md`. This is an explicitly simulated release, not verified real-world evacuation guidance.

### Better help-request management (21 Oct) ✅
- [x] Resident help cancellation with explicit confirmation modal prompt (`/resident`)
- [x] Guard live cancellation alerts with banner notice, chime and vibration cues, card state update (`/guard`)
- [x] Guard resolution outcome modal on task completion: *Assisted upstairs*, *Evacuated*, *Resident confirmed safe*, *Other*
- [x] Resident request tracker displays recorded resolution outcome under Resolved step
- [x] Pure engine rules (`lib/engine/help.ts`), 16 unit tests passing (`tests/help.test.ts`), Supabase migration (`20261021000000_task_cancel_and_outcome.sql`), contracts updated (`docs/data-contracts.md`)

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

## Demo storm visualization (20 Oct)

- [x] 19 Oct: prepared `docs/storm-rain-visualization-plan.md` for map-contained demo rain, intensity/playback response, consistent local/phone storm presentation, reduced motion and acceptance checks; planning only.
- [x] 20 Oct: implemented map-contained demo rain with intensity and capped playback response; shared local/phone weather labels, pause/reset/completion, six-second controller/API freshness, static reduced-motion rendering and an animation toggle. Plan upgrade replay uses local weather; development peak previews and Traffic omit the overlay. Lint and all 73 tests pass; production Webpack build passes with Node 24 and network access for existing Google fonts. Default Turbopack build stalled and was stopped, consistent with the previously documented environment issue. Browser verified visible rain, 4× local playback, pause/reset/toggle/zoom, local Plan source, no development overlay, and phone 2×/10× speed, pause/reset, completion and sync recovery; no console errors in the verification tab. Physical-device and reduced-motion browser checks remain unverified.

## UI Navigation & Polish (18–19 Oct)
- [x] 22 Oct: web dashboard now always uses its in-browser local storm for Live Warning, map/weather, controls and Safe Routes. Removed cloud source state, phone polling/Realtime subscription and source selectors; local upgraded-drain scenarios remain supported. Phone pages retain their separate shared simulation. Lint, TypeScript, all 109 tests and production build pass; browser verified 4× local playback/pause and local Safe Routes with both source controls absent, and before/after API snapshots confirmed phone readings unchanged. Supersedes the earlier optional dashboard Cloud Phone Sync workflow.
- [x] 22 Oct: replaced the Phone Links modal with a simple `/phone?area=…` landing page offering Resident, Storm Control and Guard. Dashboard entry points open it in a new tab; Resident/Control preserve the selected township, Guard uses the shared desk, and browser Back returns to the chooser. Removed top cross-page navigation from all three mobile pages while preserving language/status controls and existing direct links. Lint, all 109 tests and production build pass; browser verified new-tab launch, all three choices/clean headers/Back, Cyberjaya preservation and 390 px layout with no console errors.
- [x] 21 Oct: resident route cards offer Open in Google Maps / Buka dalam Google Maps using explicit walking directions between the displayed anchors. The note explains Google's independent routing without HydroTwin flood data and click-only endpoint sharing; unavailable/withdrawn routes have no link. Added coordinate-order/validation regressions; all 109 tests, lint and production build pass. Isolated production browser verified a 676 m demo route, actual Google walking-directions launch, English/Malay labels and removal on flooded-origin withdrawal without changing the main demo server.
- [x] 21 Oct: fixed unclear orange-pin map feedback. Loaded roads now appear in blue, with the match result/confirmation directly below the canvas and scrolled into view. Rejected pins explain outside coverage or no road within 75 m; valid pins show the matched road, distance and confirmation. Uncovered geolocation no longer opens the map automatically. Browser reproduced both an unmatched Cyberjaya lake point and a matched Lebuh Sentosa point; 107 tests, lint, TypeScript and production build pass.
- [x] 21 Oct: location-first resident entry with cross-area street search, one-shot GPS or map selection, boundary/road confirmation and explicit overlap choices. Discovery clips complete OSM roads to the downloaded bbox; outside points cannot snap inward and missing/failed coverage stays unavailable. English/Malay copy and mobile map preview; 107 tests, lint, TypeScript, default production build and read-only coverage HTTP checks pass. Browser checked cross-area selection, Cyberjaya preview/confirmation, change-location withdrawal, outside-boundary map click, map-centre lookup and English/Malay at 390 px. Physical GPS remains unverified. Stable published monitoring coverage remains future work.
- [x] 21 Oct: tolerate browser-extension body attributes (`cz-shortcut-listen`) during hydration, scoped to the body element so child mismatches still warn. Verified the exact attribute through a temporary production HTML proxy and interactive language switching with no hydration warning; lint, all 92 tests and production build pass.
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
- [x] 22 Oct: renamed web map marker labels and tooltips to Safe point.
- [x] 22 Oct: renamed the web planning heading from Add Civil Intervention to Add upgrades.
