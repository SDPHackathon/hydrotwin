# Data contracts

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

### Development proposals (local only, model `development-v1`)

`hydrotwin_developments_v1_<area.slug>` stores up to 30 `SavedDevelopment` records: `id`, `model`, `created_at`, `draft`, `results`. This is separate from existing upgrade scenarios; no database table, column, status rule or migration changes are needed. `lib/engine/development.ts` defines the shapes and validates saved input. Unsupported versions/corrupt entries are ignored. Comparisons and loaded proposals are recalculated against current township data; saved result snapshots are historical only.

Draft: `name`, `kind` (housing/commercial), `boundary` (unclosed `[lng, lat][]`, 3–50 corners, simple polygon, minimum 0.01 ha, inside township extent), `drain_id`, `access_street_id`, `catchment_ha` (positive, at least site area, at most 100,000 ha), `existing_paved_pct` and `proposed_paved_pct` (0–100), `mitigation` (none/bigger_drain/retention_pond). Area uses a local equirectangular projection, not cadastral geometry. Housing/commercial supply editable proposed-paving presets (60%/85%); the kind itself does not change model physics.

Assumptions: catchment defaults to **100 ha**, not measured. Demo runoff coefficient `C(p) = 0.2 + 0.7 * p/100` (permeable 0.2, paved 0.9). The unchanged remainder of the catchment is assumed to have the same initial cover as the site's existing mix. Receiving-zone `catchment_factor` is multiplied by `1 + (site_ha / catchment_ha) * (C(proposed) - C(existing)) / C(existing)`. Other drains are unchanged. No grading, drainage connectivity, downstream transfer, or plot-level flood depths are inferred.

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
