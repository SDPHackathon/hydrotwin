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
| `guard_tasks` | one live task per resident — opened at red for vulnerable residents, or by *I need help*; `open → on_the_way → done \| cancelled` | risk engine (open), guards (accept, resolve), resident (cancel) | guards + the resident who called (Realtime) |
| `plan_scenarios` | Plan-mode changes + results | plan page | everyone |

RLS is on for every table. Clients only read; every write goes through the server with the service role, except a guard accepting or closing a task. The server's key is `SUPABASE_SERVICE_ROLE_KEY` (`.env.local`, server only); the demo-time public read/write policies are removed by `20261018234500_lock_public_writes.sql`.

## Call for help — `lib/engine/help.ts`

A resident's *I need help* **is** a guard task. Tasks move `open → on_the_way → done | cancelled`; `resolve` and `cancel` also work straight from `open`; a `done` or `cancelled` task never reopens. One live task per resident (index `guard_tasks_one_open`); a second call while a task is live updates the ask and keeps the responding guard. Residents can cancel accidental requests with confirmation; guards select an outcome when resolving.

| Field | Values |
|---|---|
| `state` | `open` · `on_the_way` · `done` · `cancelled` |
| `help_type` | `trapped` · `medical` · `evacuate` · `water_in_house` · `other` (default) |
| `people` | whole number 1–10 (default 1) |
| `note` | ≤ 80 characters, trimmed; empty → null |
| `accepted_at`, `responder_name` | set by *On my way* (`accept`); `responder_name` ≤ 40 characters — guards pick a display name, there is no guard login in the demo |
| `done_at`, `outcome`, `outcome_note` | set by *Resolved* (`resolve`); `outcome`: `assisted_upstairs` · `evacuated` · `confirmed_safe` · `other`; `outcome_note`: optional text ≤ 140 characters for 'other' |
| `cancelled_at` | set by *Cancel request* (`cancel`) |

Migrations `20261018000000_help_loop.sql` and `20261021000000_task_cancel_and_outcome.sql`. API: `POST /api/resident/check-in { resident_id, state, help_type?, people?, note? }` · `GET /api/guard-tasks?resident_id=…` (the resident follows their own task) · `POST /api/guard-tasks { taskId, action: "accept" | "resolve" | "cancel", responder?, outcome?, outcome_note? }`.

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

### On-map demo weather presentation

`lib/storm-presentation.ts` derives display-only weather from the active replay's `minute`, `running` and `speed`, using `rainAt(minute) * 60` for mm/h. Web Live/Routes and Plan upgrade replay always use local state. Development independent-peak previews and Traffic have no rain overlay. Presentation never writes drain status or changes simulation input.

The existing `/api/risk-engine` response additionally includes `stormAgeMs`: milliseconds since a controller submitted playback metadata or reset the storm, or null before any controller contact. This uses server time and is not persisted. A running, unfinished phone snapshot expires after six seconds without a controller update. Paused/completed snapshots need no controller heartbeat. Mobile clients retain their API freshness checks. The web dashboard does not poll this endpoint or subscribe to phone conditions.

Rain drops stop at minute 150 while drainage replay continues through minute 210. Pausing freezes drops; reset clears them. Rainfall controls visual density/length/opacity and base movement speed. Playback multiplies movement by `min(2.5, sqrt(max(1, speed)))` only; it does not change mm/h. Canvas particles are decorative screen-space streaks, not building-occluded 3D weather or a hydraulic model. Reduced motion renders a static cue; “Rain animation” can hide the particles independently of playback. No database migration or new external dependency is involved.

### Recommended upgrades

Plan mode evaluates the current township against the existing synthetic storm. It selects up to two interventions on distinct drains, ranking outcomes by fewer flooded streets, lower peak street depth, later first overflow (no overflow is best), then fewer interventions. It recommends no changes if no candidate improves the baseline. These are results under the demo simulator and its assumed intervention multipliers, not a hydraulic or engineering design assessment.

## Live data flow (Step B)

### Development proposals (local only, model `development-v2`)

`hydrotwin_developments_v1_<area.slug>` stores up to 30 `SavedDevelopment` records: `id`, `model`, `created_at`, `draft`, `results`. This is separate from existing upgrade scenarios; no database table, column, status rule or migration changes are needed. `lib/engine/development.ts` defines the shapes and validates saved input. Unsupported versions/corrupt entries are ignored. Comparisons and loaded proposals are recalculated against current township data; saved result snapshots are historical only.

Draft: `name`, `kind` (housing/commercial), `boundary` (unclosed `[lng, lat][]`, 3–50 corners, simple polygon, minimum 0.01 ha, inside township extent), `drain_id`, `access_street_id`, `existing_paved_pct` and `proposed_paved_pct` (0–100), `mitigation` (none/bigger_drain/retention_pond). Area uses a local equirectangular projection, not cadastral geometry. Housing/commercial supply editable proposed-paving presets (60%/85%); the kind itself does not change model physics. The UI labels cover as before/after construction and clarifies that it applies to the drawn site only.

Connections: on finishing a boundary, suggest the nearest road segment to the arithmetic mean of its corners (local metric projection), and reuse that road's existing Live Warning `drain_id`. Only roads with known drain IDs qualify; equal distances resolve by road ID. Manual dropdown/map overrides remain until a new boundary is finished or the user restores suggestions. No suggestion is produced for an invalid boundary or absent eligible geometry.

Assumptions: no manual catchment area or 100 ha default. The selected Live zone's footprint is estimated from its streets' projected bounding rectangle with a 50 m margin on each side (`zone_area_ha` in results); missing geometry blocks evaluation. Demo runoff coefficient `C(p) = 0.2 + 0.7 * p/100` (permeable 0.2, paved 0.9). The unchanged remainder of the zone is assumed to have the site's existing mix. Receiving-zone `catchment_factor` is multiplied by `1 + min(1, site_ha / zone_area_ha) * (C(proposed) - C(existing)) / C(existing)`. Other drains are unchanged. This estimates the footprint of a demo street cluster, not a watershed. No grading, drainage connectivity, downstream transfer, or plot-level flood depths are inferred. Legacy `development-v1` records remain readable in the existing storage key; old `catchment_ha` is ignored and results are recalculated with v2. Saved snapshots remain historical only.

Three replays start at zero under the current synthetic storm (180 minutes plus 30 drainage, same inclusive tick range as existing Plan replay). Mitigation applies the existing engine's bigger-drain or pond multiplier after development; green space is counted only via paving percentage. `assess()` remains the sole authority for status. Results per stage: receiving-zone `deepest_cm`, `minutes_to_first_red` (null if none), `streets_flooded` (existing zone streets), `access_flooded` (selected road's own zone), and `peak_statuses` (each drain's independent peak, not one time instant). Access is a single-road screening check, not a connected evacuation route. Peaks on the map are labelled accordingly.

### Shared evacuation catalogue and resident routing (21 October)

Current release supports **demo mode only**, with algorithm-derived dry road anchors for every shared township. `lib/engine/demo-refuges.ts` replays 210 ticks (minutes 0–209), using control's one-decimal rounding and 30-reading history. `assess()` decides every status. Never-red zones qualify; they can become amber. Candidates use the longest road segment's midpoint. Real shared vertices define components; each selects the lowest peak/bank ratio first, then farthest points more than 200 m apart, at most three per component and 100 total. Flooded-only components receive no point. IDs/order/ties are deterministic. Revision includes model, road and drain-assumption fingerprints. Bukit Raja's JSON is a reproducible export (six points), not a manually maintained authority. No flood data is regenerated, and no official shelter discovery, operational availability or database table is delivered.

Catalogue envelope: `schema_version: 1`, `area_slug`, `revision`, `network_fingerprint`, `generated_at`, `mode: demo | operational`, `destinations`. Each destination: stable `id`, `area_slug`, `name`, `street_id`, `position: {segment_index,fraction}`, `kind: demo | verified`, `purpose: evacuation_centre | assembly_point | vehicle_parking | demo_refuge`, `verification_state: candidate | verified | rejected`, provenance `source/source_id/source_url/licence`, `verified_at/verification_expires_at`, `availability: open | closed | full | unknown`, `availability_observed_at/availability_expires_at`, entrance `[lng,lat]`, `access: {network_fingerprint,verification_state: schematic | verified,expires_at}`, `accessibility: unknown | step_free`, `disabled`. Demo refuge entries require `simulation: {model,peak_cm,bank_cm,ever_amber,through_minute}` (finite nonnegative peak, positive bank, boolean amber flag and positive integer horizon). Evidence timestamps are ISO strings or null. Demo null availability timestamps mean explicitly simulated availability, never measured opening. Fingerprint `roads-v1-*` is FNV-1a over sorted road IDs, drain assignments and exact coordinates; it detects bundle drift, not authenticity. Parsing rejects an invalid import as a whole.

Eligibility lives in `lib/engine/evacuation.ts`, with explicit `now`. Requires enabled/open evacuation purpose (or demo_refuge in demo mode), matching network and green access street. Baseline dryness never overrides current access conditions. Demo admits only demo candidates with schematic access; closed/full/unknown/rejected/expired entries are excluded. The pure operational eligibility contract additionally requires verified kind/state/access and current independent verification, availability and access expiry evidence; operational adapters/admin/feed are deferred and no deployed endpoint enables this mode.

`GET /api/evacuation-destinations?area=...` generates the catalogue from an allowlisted built-in or validated shared bundle. `GET /api/resident/safe-route?resident_id=...` resolves only a fixed fictional resident, returning no profile or help notes. Invalid input is 400, unknown resident/unsupported area 404, data errors 503; expected no-route states remain 200 structured results. Both responses use `Cache-Control: no-store`.

Route envelope v1: `resident_id`, `source: local_demo | phone_demo`, `snapshot_revision`, `catalogue_revision`, `network_fingerprint`, `calculated_at` (server epoch ms), `valid_for_ms`, `conditions: waiting | current | frozen | stale | offline`, complete effective `statuses` and `observed_at`, `route`, and public `catalogue`. Route adds ordered `legs: {street_id,drain_id,status,coordinates,distance_m}[]` and `amber_m`. Only green/amber edges enter usable legs. Additional outcomes: `conditions_unavailable`, `catalogue_unavailable`. Missing/expired per-drain observations are omitted from effective statuses. A copied laptop snapshot provides evidence and calculation together; asynchronous Supabase mirroring is not the routing authority. Realtime events invalidate/refetch instead of merging a second source. Cloud mode does not substitute local statuses.

The server adds `serverNow` and `floodEvidence: {source,revision,observed_at,controller_at,running,minute}` to `/api/risk-engine`. Process startup has no initialized observations. Explicit demo reset establishes all zero readings; metadata-only requests and unrelated drain readings do not. Every actual simulator reading updates only that drain's observation time; Supabase mirrors only actually updated rows. Running unfinished snapshots expire after 6000 ms for both heartbeat and per-drain observations. Paused/completed snapshots remain frozen only while API requests continue succeeding. Responses never renew observation age. Real-device readings are excluded from this demo evidence contract pending a real sensor expiry design. No database schema changes are required.

Client route validity is bounded by 6000 ms of API liveness, running evidence expiry and eligible-destination evidence expiry. Independent timers withdraw guidance without incoming events; network errors withdraw immediately. Server TTLs are converted to local deadlines conservatively from request start. Identity switches synchronously hide old geometry, abort obsolete requests, and prevent old responses from applying. Foreground return revalidates; polls do not overlap. Alerts compare previous actual legs to the new complete snapshot, not township exclusions. Camera framing changes on initial route or origin/destination identity, not ordinary refreshes. No background location tracking or turn navigation is provided.

The resident UI has no persona or township prerequisite. `POST /api/resident/safe-route` accepts `{area_slug,origin:{street_id,position:{segment_index,fraction}}}` and returns the same route envelope plus `area_slug`; the canonical `resident_id` field identifies the anchor, not a person. Invalid anchors are 400, unknown shared areas 404, server/data failures 503. The legacy fictional-resident GET remains compatible. Residents use one-shot geolocation, cross-area street search or a map point, then confirm the road point and coverage boundary. Geolocation requires a secure context and accuracy ≤100 m. Changing location immediately clears previous guidance. No journey tracking or full house-address geocoding is provided. Help requests remain explicit and separate from route failure; routing never borrows responder permissions for red roads.

### Web simulation source (22 October)

Resident safe-point overview (22 October): all catalogue road anchors remain visible when the origin is flooded. Current engine-eligible destinations are green; other anchors are grey. No reference routes, alternate starting points or connectors are drawn. A walking route appears only when the existing engine finds one from the resident's confirmed origin. Stale/offline/waiting states show points as unavailable. English/Malay copy explains that safe points remain visible and residents must not walk through floodwater to reach them. No API/database changes.

The web dashboard always uses `useLocalStorm`: its map statuses, rainfall/playback, Live Warning and Safe Routes follow the same in-browser storm (including selected upgrades). Safe Routes passes only local `FloodEvidence` and local engine statuses to `calculateEvacuation`; personal draft routing uses those same statuses. The web has no flood-source selector, phone/server polling or Supabase drain-status subscription. The shared destination catalogue still loads per township. Resident, Control and Guard retain their separate shared phone/server simulation and APIs; changing the web storm does not write phone/server readings. This supersedes earlier dashboard phone-sync behavior without changing engine rules or database schema.

### Phone entry and navigation (22 October)

`/phone?area=<slug>` is the simple entry page for Resident, Storm Control and Guard. It awaits Next.js page search parameters, validates the slug syntax (default `bukit-raja`), and shows the matching shared area's name. A valid but unshared ID keeps its area links and shows an availability notice. Resident/Control links preserve `area`; Guard opens the existing combined duty desk. The three destinations open in the same tab so browser Back returns to the chooser. Existing direct links and installed resident/guard shortcuts remain supported; this is a navigation page, not an authentication gate.

The dashboard's Phone Links entry points are native anchors to `/phone?area=<currentArea.slug>` with `target="_blank"` and `rel="noopener noreferrer"`, replacing the old link modal. Resident, Guard and Control headers have no cross-page navigation; titles, status badges and existing language switches remain. No database, engine or status changes.

### External walking directions (21 October)

Resident routes expose an optional **Open in Google Maps** external link only while the current route is found and both endpoints are finite valid coordinates. It uses the official `https://www.google.com/maps/dir/` Maps URL with `api=1`, explicit `origin`/`destination` converted from GeoJSON `[lng,lat]` to `lat,lng`, and `travelmode=walking`. No automatic navigation, SDK, key, provider request or prefetch is added. Only a user click shares the selected road anchors; no resident identity, help token, GPS reading, route polyline or flood statuses are sent. The existing hook's route withdrawal removes the link. Google computes independent directions; it does not receive HydroTwin's flooded-street exclusions, and its path may differ. The explanatory paragraph was removed from the resident UI by user request on 22 October; link behavior is unchanged. No engine/status/schema changes.

### Resident coverage discovery (21 October)

`GET /api/coverage?q=street` searches all shared areas (2–120 trimmed characters). `POST /api/coverage` accepts a bounded 1 KB `{point:[lng,lat]}` body and finds the closest loaded road within 75 m in each containing area. Raw coordinates are transient server input: no query-string coordinates, persistence, external geocoder or background tracking. Both return `{areas,matches,incomplete,truncated}` with `Cache-Control: no-store`; matches contain `{area,origin,coordinate,label,distance_m}` (null distance for text search). At most 24 matches are returned; partial area-loading failures are explicit and never establish absence of coverage. Invalid queries/points return 400. Only the confirmed road anchor is used for route and help requests.

`lib/engine/coverage.ts` clips complete OSM way segments to the actual `[south,west,north,east]` area bbox for discovery, retaining original segment indices/fractions. Search uses a representative midpoint of the longest covered segment, labelled as approximate. A point outside every bbox cannot snap inward, even if an OSM way extends beyond the box. Inside a box without a loaded road within 75 m remains unavailable. Overlapping areas return separate nearest-road candidates for explicit choice; results never use status to move a location to a safer road. The preview shows shared rectangular coverage, the requested point and the proposed road anchor. A town name does not imply whole-town coverage. No administrative-boundary dataset, new library or status rule is introduced.

Coverage labels (22 October): matches also expose `road_name: string | null` and `nearby_road_name: string | null`. Trimmed recorded names remain unchanged. An unnamed road is labelled “Unnamed road near <name>” using the nearest named, clipped road segment within 150 m in the same coverage, or “Unnamed road” if none qualifies. Ties resolve by road ID. English/Malay UI renders this context without displaying the raw OSM way ID as a road name. Nearby names are approximate orientation only; the selected `origin`, coordinate, routing, help identity and 75 m matching threshold never move to that named road. No external geocoder, database or migration is involved.

This release retains the shared laptop demo catalogue. Stable published monitoring coverage, descriptive sector management and explicit planner publication remain future work; downloading or sharing a demo box is not an operational coverage guarantee.

Map selection feedback appears immediately below the canvas and is brought into view after a point lookup, including errors. Orange marks the requested point only; a matched black road anchor and an explicit confirmation button appear only for valid matches. The focused area's loaded roads are drawn in blue after clipping to its bbox; blue represents selectable data, not flood status. Failed geolocation coverage checks leave the map optional. Rejected pins keep the current camera view. No matching threshold or flood rule changes.

### Shared townships and anonymous demo help (21 October)

`GET /api/township/shared` lists built-ins plus laptop-session downloads; `?area=slug` returns a minimal area/roads/drains bundle. POST validates an 8 MB bounded stream, slug/identity/geography, 1–64 unique simulated zones, 1–3000 unique roads referencing known zones, ≤50000 vertices and query bbox ≤0.06° latitude/0.1° longitude. Complete OSM ways may extend ≤0.03° beyond the query box. A registered slug cannot replace a different road/drain fingerprint. Maximum 24 cached areas per process. No untrusted slug becomes an arbitrary path. Generation registers downloads; the dashboard republishes existing IndexedDB copies. Registry/state are process-local demo facilities: reopen the dashboard after restart. No new Supabase records or migration.

Risk GET/POST/reset accept `?area=slug` (default Bukit Raja); POST optionally accepts matching `area_slug` and rejects conflicts. Readings must reference known drains and satisfy bounds. Each area's evidence is isolated even when IDs such as D01 repeat. Only Bukit Raja retains legacy fictional-resident tasks and mirroring; other areas never mirror colliding IDs into those tables.

`POST /api/resident/location-help` accepts action `read | request | safe | cancel`. Request includes a shared area, validated road anchor, required name and existing help fields. Name is trimmed, repeated spaces collapsed, limited to 1–80 characters and rejects control characters; the server validates it for creation and updates. The UI asks for a fictional demo name. It is stored as the existing runtime GuardTask.resident_name and displayed by the resident tracker and guard cards; live updates may change it without changing task identity or location. It creates a random session capability returned only to the requesting browser and stored in sessionStorage (memory fallback); subsequent actions send it in the body, never a URL. Guard tasks contain no capability. Maximum 300 sessions; expire after 24 hours without a task update. No raw GPS/live tracking or resident-FK database writes. Names remain in the process-local demo session/task only; sessionStorage keeps only its existing capability token. No database schema or migration is needed. GuardTask optionally carries `area_slug,area_name,position`: runtime fields, not database columns. Live updates cannot move an existing request. Guard accept/resolve/cancel use the existing pure lifecycle. Responder routes target the exact anchor. Other townships have no invented posts and return `no_posts` with a marker when conditions are known. This explicitly shares with a demo desk, not emergency-service dispatch.

### Personal demo route drafts (legacy-compatible, opt-in)

`hydrotwin_destinations_<area.slug>` in device localStorage contains `{ id, name, street_id, kind: "demo", position?: { segment_index, fraction } }[]`. Personal drafts are opt-in under demo controls and never become the shared catalogue or resident destinations. Dropdown points use the first vertex of an existing street; map pins use a validated segment index and fraction (0–1). Clicks snap to a road within 24 screen pixels; distant clicks are rejected. Routing splits that segment at the anchor, including both pins on the same segment. Points are unverified as real evacuation locations. Existing saved points without `position` remain compatible. No database schema changes are required.

Routing uses the selected street's first vertex or a map pin as origin, excludes red and unknown roads, and prefers a green-only route over any amber route. If none exists, an amber route may be returned with a warning. Eligible destinations require green status. Automatic mode chooses shortest network distance within that tier, then destination ID for ties. Street vertices connect only at identical supplied coordinates; crossings alone do not connect. Roads are treated as bidirectional walking links. Results distinguish missing destinations, invalid/blocked/unknown origins, unavailable destinations, disconnected data, and routes blocked by red/unknown roads. Excluded street counts describe the entire loaded township. Routes reflect current statuses and do not forecast flooding during travel or verify pedestrian barriers/accessibility.

```
phone /control ──POST readings──▶ Edge Function risk-engine ──▶ readings (insert)
 (or a real sensor)                    │  assess() from lib/engine
                                       ▼
                               drain_status (upsert) ──▶ guard_tasks (open at red)
                                       │
                         Supabase Realtime (postgres_changes)
                                       ▼
                         resident /resident  ·  guard /guard
```

### `POST /functions/v1/risk-engine` (draft — finalise in Step B)

- **Auth**: a logged-in operator (Supabase Auth JWT). Anonymous calls are rejected so nobody can push fake floods.
- **Body**: `{ "readings": [{ "drain_id": "D07", "level_cm": 84.2, "rain_mm": 1.8, "sim_minute": 73, "source": "sim" }] }` — one call per tick carries all drains.
- **Does**: insert readings → load the last 6 levels per drain → `assess()` → upsert `drain_status` → for drains that just turned red, open `guard_tasks` for vulnerable residents on their streets.
- **Returns**: `{ "statuses": DrainStatus[] }`.

### Realtime subscriptions

| Page | Table | Events |
|---|---|---|
| resident | `drain_status` | UPDATE |
| guard | `guard_tasks` | INSERT, UPDATE |
| guard | `check_ins` | INSERT |
| resident | `guard_tasks` | UPDATE (their own task: on the way / resolved) |
