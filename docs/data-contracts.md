# Data contracts

## Township traffic impact — active model v3

The current Traffic UI uses `lib/engine/traffic/impact.ts`, not the earlier replay engine. Supports up to 6 concurrent sites. Proposal: name, unclosed boundary, housing/commercial kind, size (homes or m²), vehicle trip rate (per home/hour or per 100 m²/hour), outbound percentage and access OSM node. Boundary validation reuses the development engine. Suggested access is the nearest existing node to the outline centre within 600 m with incoming/outgoing links. The connection is schematic. Eight directional sectors supply reachable township and gateway nodes, partitioned into 70% external perimeter gateways and 30% internal hubs, weighted by road capacity; these model broad whole-township trip dispersion rather than single-corridor flows.

`GET /api/traffic-baseline` reports provider/configured/maxSamples only. `POST` accepts a bounded township bbox plus 1–24 `{id,point:[lng,lat]}` samples. It calls the official TomTom Flow Segment Data absolute/16/json endpoint server-side with `TOMTOM_TRAFFIC_API_KEY`. Values never enter the browser bundle. Coordinates are sent as lat,lng to the provider. Batches use at most four concurrent requests, a ten-second provider timeout, and a process-local 10-second refresh throttle. Responses are `Cache-Control: no-store`; no provider content is written to disk, database, scenario saves or localStorage. On entering Traffic, distributed arterials (up to 24) are immediately sampled to acquire real baseline observations without requiring site drawing.

Baseline: provider TomTom, retrieval time, requested/failed counts and observations with coordinates, current/free-flow km/h, current/free-flow segment travel seconds, confidence and closure. Timestamp means retrieval, not observation measurement time. Matching requires confidence ≥0.5, retrieval within five minutes, aligned geometry (cosine ≥0.85), midpoint separation <20 m and both endpoints within 25 m of the provider polyline. Opposite directions, missing or stale matches remain strictly unknown. Matching and impact calculation run in a worker; the UI consumes observation IDs returned by that worker.

Development trips/hour = size × tripRate (commercial divides by 100). Presets provide Low / Base / High sensitivities (housing: 0.35, 0.50, 0.80 trips/home/h; commercial: 1.5, 2.0, 3.0 trips/100m²/h). Ten incremental assignment batches across all sites simultaneously use observed speed-based traversal times plus a BPR-style assumed change: `current_seconds + free_seconds * 0.15 * ((inferred_vc + added_vph/capacity)^4 - inferred_vc^4)`, where `inferred_vc = ((max(0,current_seconds/free_seconds - 1))/0.15)^(1/4)`. The existing demand/capacity ratio is inferred, not an observed traffic count. Unknown roads participate in routing with assumed free-flow cost, but return null current/proposed times and are excluded from congestion findings. Reported closures are excluded. This is sensitivity screening, not user equilibrium or a calibrated regional forecast. [FHWA discussion of BPR assumptions and limitations](https://www.fhwa.dot.gov/publications/research/operations/22055/22055.pdf).

Result: added/assigned/unassigned vehicles/hour, affected/matched directed segment counts, assigned vehicle-distance coverage, already congested baseline segments, newly congested matched segments and per-road current/proposed seconds and speeds. Road coloring is strictly honest: unobserved roads are always grey (`#a8a29e`, status unknown), closed roads dark red (`#7f1d1d`), observed roads green (≥70%), amber (40–70%), red (<40%). Modeled added vehicle flow across the entire network is inspected via the Flow Delta (+veh/h) heatmap view. Coverage and unassigned trips are reported alongside the verdict.

`hydrotwin_township_impact_v3_<slug>` saves up to 30 `{id,version:3,name,sites}` inputs, with automatic migration from legacy v2 single-site proposals. Raw traffic/results are never saved. Earlier v1 traffic drafts are left in their own namespace.

## Legacy traffic replay — independent model v1 (not used by current UI)

`public/data/<slug>/traffic-network.json`: version 1, fingerprint, directed links, forbidden incoming-link/outgoing-link pairs, component count and warnings. Link IDs are `OSM-way:segment:direction`; from/to are OSM node IDs. Geometry vertices remain road segments; no connections are synthesized. Link length is metres, free-flow seconds, speed km/h, discharge vehicles/hour. Missing speed defaults to 30 locally / 50 on major roads; missing directional lanes defaults to one or half mapped total lanes. Capacity is always assumed: 900 vehicles/hour/lane, service roads 450. The junction's shared budget is its largest incoming link capacity. No database schema or risk/status writes.

Traffic preparation is separate from flood generation. `node --experimental-strip-types scripts/prepare-traffic.mjs <slug> [official-map.xml]` prepares an offline artifact. The API accepts a bounded bbox, caches up to 10 extracts for one hour, tries the official OSM map API then buffered Overpass mirrors. Unsupported restrictions conservatively exclude affected turns; private/destination-only roads and conditional access are excluded. Barrier nodes and detailed lane/turn permissions are not currently modeled. No driving guidance is provided.

Demand is fictional OD junction pairs in vehicles/hour, departures over 1–60 minutes, seed 42 in UI, plus 30 minutes to finish. Housing = homes × vehicle trips/home/hour; commercial = m²/100 × vehicle trips/100 m²/hour. Outbound percentage splits the total. All rates are assumptions. Suggested site access is the nearest existing road node within 500 m of a site corner with routes to/from the selected destination; manual override remains possible. It does not create a driveway or prove land access.

Engine point queues have infinite storage and one FIFO per incoming directed segment, fair rotating allocation, one-second steps and capped fractional service credit. New departures use queue-adjusted costs refreshed each minute; active routes stay fixed. Every released trip remains completed/traveling/queued/unreachable. Results include completed-trip means/p95/delay, unfinished/unreachable counts, waiting vehicle-seconds and peak waiting vehicles. Snapshots share a single time and record every 10 seconds plus the final state. Display colours: green <3 waiting, amber 3–9, red 10+; these are queue-display thresholds, not observed congestion classifications.

`hydrotwin_traffic_v1_<slug>` stores up to 30 `{id,name,version:1,fingerprint,draft}` records, independently of flood proposals. Drafts save inputs only. Loaded results must be rerun; changed fingerprints produce a warning. Traffic switching back to Flood unmounts the traffic workspace; save drafts before leaving. Simulation limits: 6,000 directed segments, 5,000 scheduled trips and 100 OD entries. Worker termination cancels a run; input changes leave a visible stale-result notice.

The names here are the names in code, in the database and in the engine. Change one → change all three (`supabase/migrations/`, `lib/engine/types.ts`, this file) in the same commit.

## IDs

| Thing | ID | Example | Source |
|---|---|---|---|
| Street | `w` + OSM way id | `w123456789` | OpenStreetMap — stable across data refreshes |
| Drain | `D` + 2 digits | `D07` | `scripts/fetch-data.mjs` (k-means of street centres, numbered north→south) |
| Resident | uuid | — | fictional seed data |

⚠️ Re-running `npm run data` can move streets between drains. Once the database is seeded, re-seed after any data refresh.

## Map data — `public/data/<area>/`

| File | Contents |
|---|---|
| `area.json` | `slug`, `name`, `bbox` [S, W, N, E], `center` [lng, lat], `attribution` |
| `streets.geojson` | LineStrings · properties `id`, `name`, `highway`, `drain_id` |
| `buildings.geojson` | Polygons · properties `id`, `height` (m; 7 m default when OSM has none) |
| `flood-zones.geojson` | water-slab footprints: one MultiPolygon per drain + band · properties `id` (`D07-road`), `drain_id`, `band` (`road` 6 m / `yard` 24 m either side of the street) · built by `scripts/make-flood-zones.mjs` |
| `drains.json` | `id`, `name`, `lng`, `lat`, `elevation_m`, `bank_cm`, `catchment_factor`, `outflow_cm_per_min`, `streets` (count) |

## Tables — `supabase/migrations/20261015000000_init.sql`

| Table | Holds | Written by | Read by |
|---|---|---|---|
| `drains` | the drain model numbers | seed; Plan mode reads copies, never edits | everyone |
| `streets` | street → drain | seed | everyone |
| `readings` | every sensor / simulator reading | **risk-engine function only** | engine |
| `drain_status` | latest status per drain | **risk-engine function only** | everyone (Realtime) |
| `residents` | **fictional** residents, `vulnerable`, `needs` | seed | guards |
| `check_ins` | *I'm safe* / *I need help* + what for (`help_type`, `people`, `note`) | check-in API | guards (Realtime) |
| `guard_tasks` | one live task per resident — opened at red for vulnerable residents, or by *I need help*; `open → on_the_way → done` | risk engine (open), guards (accept, resolve) | guards + the resident who called (Realtime) |
| `plan_scenarios` | Plan-mode changes + results | plan page | everyone |

RLS is on for every table. Clients only read; every write goes through the server with the service role, except a guard accepting or closing a task.

## Call for help — `lib/engine/help.ts`

A resident's *I need help* **is** a guard task. Tasks move `open → on_the_way → done`; `resolve` also works straight from `open`; a `done` task never reopens. One live task per resident (index `guard_tasks_one_open`); a second call while a task is live updates the ask and keeps the responding guard.

| Field | Values |
|---|---|
| `help_type` | `trapped` · `medical` · `evacuate` · `water_in_house` · `other` (default) |
| `people` | whole number 1–10 (default 1) |
| `note` | ≤ 80 characters, trimmed; empty → null |
| `accepted_at`, `responder_name` | set by *On my way* (`accept`); `responder_name` ≤ 40 characters — guards pick a display name, there is no guard login in the demo |
| `done_at` | set by *Resolved* (`resolve`) |

Migration `20261018000000_help_loop.sql`. API: `POST /api/resident/check-in { resident_id, state, help_type?, people?, note? }` · `GET /api/guard-tasks?resident_id=…` (the resident follows their own task) · `POST /api/guard-tasks { taskId, action: "accept" | "resolve", responder }`.

### Responder route — `findResponderRoute()`

Shortest route from the nearest **fictional guard post** (`lib/guards-data.ts`) to the **middle of the resident's street**. Unlike the evacuation router, a responder may wade: red roads stay in the graph at `WATER_PENALTY` (4) × their length, so water is used only where no dry road reaches the resident; `dry_m` and `water_m` are reported separately and the map draws the wet stretch dashed. Unknown-status roads are left out; a post on a red street cannot start a route. Roads connect only at shared vertices — the Bukit Raja OSM extract (`npm run data`, road classes primary … living_street) leaves the Zapin / Cendana estate (D07 / D09 / D10) unconnected from the rest of the network, which is why there are two posts. Re-fetching with service roads would reconnect it, but re-clusters the drains and changes every demo number — not before 23 Oct.

## Status rules — `lib/engine/risk.ts`

Input: a drain's level history (cm, one value per simulated minute, newest last).

| Status | When |
|---|---|
| 🔴 `red` | `level_cm ≥ bank_cm` — the drain is overflowing; `street_depth_cm = level_cm − bank_cm` |
| 🟠 `amber` | `level_cm ≥ 0.7 × bank_cm`, **or** rising fast enough to reach red within **30 min** |
| 🟢 `green` | otherwise |

- `rate_cm_per_min` = average change over the last 5 minutes.
- `minutes_to_red` = `ceil((bank_cm − level_cm) / rate)` when rising and not yet red; otherwise `null`.
- A street's status = its drain's status.

## Simulator — `lib/engine/sim.ts`, `lib/engine/storm.ts`

Each simulated minute: `level = max(0, level + rain_mm × catchment_factor − outflow_cm_per_min)`.
`catchment_factor` = ground-height term from real elevation (0.8 highest … 1.6 lowest) + zone-size term (street count, up to ±0.1, breaks ties between zones at the same height). So low ground floods first, and among equal heights the bigger zone floods first. Plan-mode fixes change only `catchment_factor` or `outflow_cm_per_min`.

With the current storm (peak ≈126 mm/h) the water spreads D08 → D07 → D05 → D06 → D02 → D01/D09 over ~22 storm-minutes, 5–50 cm deep; D03/D04 reach amber, D10 stays green.

### Recommended upgrades

Plan mode evaluates the current township against the existing synthetic storm. It selects up to two interventions on distinct drains, ranking outcomes by fewer flooded streets, lower peak street depth, later first overflow (no overflow is best), then fewer interventions. It recommends no changes if no candidate improves the baseline. These are results under the demo simulator and its assumed intervention multipliers, not a hydraulic or engineering design assessment.

## Live data flow (Step B)

### Development proposals (local only, model `development-v2`)

`hydrotwin_developments_v1_<area.slug>` stores up to 30 `SavedDevelopment` records: `id`, `model`, `created_at`, `draft`, `results`. This is separate from existing upgrade scenarios; no database table, column, status rule or migration changes are needed. `lib/engine/development.ts` defines the shapes and validates saved input. Unsupported versions/corrupt entries are ignored. Comparisons and loaded proposals are recalculated against current township data; saved result snapshots are historical only.

Draft: `name`, `kind` (housing/commercial), `boundary` (unclosed `[lng, lat][]`, 3–50 corners, simple polygon, minimum 0.01 ha, inside township extent), `drain_id`, `access_street_id`, `existing_paved_pct` and `proposed_paved_pct` (0–100), `mitigation` (none/bigger_drain/retention_pond). Area uses a local equirectangular projection, not cadastral geometry. Housing/commercial supply editable proposed-paving presets (60%/85%); the kind itself does not change model physics. The UI labels cover as before/after construction and clarifies that it applies to the drawn site only.

Connections: on finishing a boundary, suggest the nearest road segment to the arithmetic mean of its corners (local metric projection), and reuse that road's existing Live Warning `drain_id`. Only roads with known drain IDs qualify; equal distances resolve by road ID. Manual dropdown/map overrides remain until a new boundary is finished or the user restores suggestions. No suggestion is produced for an invalid boundary or absent eligible geometry.

Assumptions: no manual catchment area or 100 ha default. The selected Live zone's footprint is estimated from its streets' projected bounding rectangle with a 50 m margin on each side (`zone_area_ha` in results); missing geometry blocks evaluation. Demo runoff coefficient `C(p) = 0.2 + 0.7 * p/100` (permeable 0.2, paved 0.9). The unchanged remainder of the zone is assumed to have the site's existing mix. Receiving-zone `catchment_factor` is multiplied by `1 + min(1, site_ha / zone_area_ha) * (C(proposed) - C(existing)) / C(existing)`. Other drains are unchanged. This estimates the footprint of a demo street cluster, not a watershed. No grading, drainage connectivity, downstream transfer, or plot-level flood depths are inferred. Legacy `development-v1` records remain readable in the existing storage key; old `catchment_ha` is ignored and results are recalculated with v2. Saved snapshots remain historical only.

Three replays start at zero under the current synthetic storm (180 minutes plus 30 drainage, same inclusive tick range as existing Plan replay). Mitigation applies the existing engine's bigger-drain or pond multiplier after development; green space is counted only via paving percentage. `assess()` remains the sole authority for status. Results per stage: receiving-zone `deepest_cm`, `minutes_to_first_red` (null if none), `streets_flooded` (existing zone streets), `access_flooded` (selected road's own zone), and `peak_statuses` (each drain's independent peak, not one time instant). Access is a single-road screening check, not a connected evacuation route. Peaks on the map are labelled accordingly.

### Demo route destinations

`hydrotwin_destinations_<area.slug>` in device localStorage contains `{ id, name, street_id, kind: "demo", position?: { segment_index, fraction } }[]`. Dropdown points use the first vertex of an existing street; map pins use a validated segment index and fraction (0–1). Clicks snap to a road within 24 screen pixels; distant clicks are rejected. Routing splits that segment at the anchor, including both pins on the same segment. Points are unverified as real evacuation locations. Empty lists require user configuration; no drain is implicitly a shelter. Existing saved points without `position` remain compatible. No database schema changes are required.

Routing uses the selected street's first vertex or a map pin as origin, excludes red and unknown roads, and permits amber roads with a warning. Eligible destinations require green status. Automatic mode chooses the shortest reachable destination by network distance. Street vertices connect only at identical supplied coordinates; crossings alone do not connect. Roads are treated as bidirectional walking links. Results distinguish missing destinations, invalid/blocked/unknown origins, unavailable destinations, disconnected data, and routes blocked by red/unknown roads. Excluded street counts describe the entire loaded township. Routes reflect current statuses and do not forecast flooding during travel.

```
phone /control ──POST readings──▶ Edge Function risk-engine ──▶ readings (insert)
 (or a real sensor)                    │  assess() from lib/engine
                                       ▼
                               drain_status (upsert) ──▶ guard_tasks (open at red)
                                       │
                         Supabase Realtime (postgres_changes)
                                       ▼
                 dashboard /  ·  resident /resident  ·  guard /guard
```

### `POST /functions/v1/risk-engine` (draft — finalise in Step B)

- **Auth**: a logged-in operator (Supabase Auth JWT). Anonymous calls are rejected so nobody can push fake floods.
- **Body**: `{ "readings": [{ "drain_id": "D07", "level_cm": 84.2, "rain_mm": 1.8, "sim_minute": 73, "source": "sim" }] }` — one call per tick carries all drains.
- **Does**: insert readings → load the last 6 levels per drain → `assess()` → upsert `drain_status` → for drains that just turned red, open `guard_tasks` for vulnerable residents on their streets.
- **Returns**: `{ "statuses": DrainStatus[] }`.

### Realtime subscriptions

| Page | Table | Events |
|---|---|---|
| dashboard, resident | `drain_status` | UPDATE |
| guard | `guard_tasks` | INSERT, UPDATE |
| guard | `check_ins` | INSERT |
| resident | `guard_tasks` | UPDATE (their own task: on the way / resolved) |
