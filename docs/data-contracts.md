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
| `check_ins` | *I'm safe* / *I need help* | check-in function | guards (Realtime) |
| `guard_tasks` | one open task per vulnerable resident on a red street | risk engine (open), guards (close) | guards (Realtime) |
| `plan_scenarios` | Plan-mode changes + results | plan page | everyone |

RLS is on for every table. Clients only read; every write goes through an Edge Function with the service role, except a guard closing their own task.

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

## Live data flow (Step B)

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
