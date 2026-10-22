# Traffic simulation and development impact — implementation plan

> Latest handoff, 19 Oct 2026: read [traffic-real-data-handoff-plan.md](traffic-real-data-handoff-plan.md) for the user's current request, confirmed misleading baseline/coverage behaviour, real initial traffic implementation phases and AI boundaries. The older replay plan below is historical.

> Superseded product flow after user clarification, 19 Oct: retain MapLibre; replace replay/set-scene with a real-data township-impact planner. Draw site → homes/floor area → automatic road connection → assess against current TomTom observations → compare Current traffic / With township. The active v2 model and limitations are documented in `data-contracts.md` and `spec.md`. The replay design below records the earlier proposal and is not the current UI specification.

Prepared 19 October 2026. Status: proposed implementation; no traffic feature has been built by this planning change.

## 1. Product outcome

Let a township planner answer: **“If we build this housing or commercial development, which roads become busier, how much longer do journeys take, and which changes help?”**

Use the existing township map for two analysis domains: Flood and Traffic. Keep the existing flood warning, planning and response workflows. Traffic adds a simulated demand scenario and its own development impact comparison. The traffic feature is a proposed scope extension: `docs/spec.md` currently explicitly excludes traffic simulation. Amend that scope when implementation starts.

The first release is an assumption-based township screening tool. It estimates congestion under chosen demand and road-capacity assumptions; it does not report observed traffic or establish transport approval suitability.

### First-release user journey

1. Select a township using the existing expanding picker above the map.
2. Select **Traffic** in a compact Flood / Traffic control in the sidebar.
3. Open **Simulation**, select Morning peak, Evening peak or Custom demand, then Run.
4. Watch a timeline of road congestion. Click a road to inspect its direction, assumed capacity, vehicles waiting and estimated delay.
5. Open **Development**, draw a site or copy the outline of an existing flood proposal, and select housing or commercial use.
6. Enter the number of homes or commercial floor area. The app suggests a connected access road and estimates additional vehicle trips using visible, editable assumptions.
7. Compare **Existing / With development / With mitigation**, under the same background demand and simulation duration.
8. Test fewer car trips or a capacity change on an existing road. Save the proposal locally and replay it.

The presentation should show the causal chain: **development → extra vehicle trips → bottleneck → tested improvement**.

## 2. What can be reused, and what is missing

| Existing part | Proposed use | Required change |
|---|---|---|
| MapLibre township map and building extrusions | Map, camera and context | Add separate traffic sources and layers |
| Top township picker | Select analysis area | Show whether traffic data is available |
| Sidebar and mode transition | Navigate traffic workspace | Domain-aware tabs and labels |
| Site boundary drawing | Define development site | Reuse geometry; keep traffic inputs separate from paving inputs |
| Development save/compare patterns | Traffic proposals | Separate, versioned traffic storage |
| OSM download pipeline | Obtain road geometry | Retain driving attributes, node IDs and turn restrictions |
| Walking route engine | Reference geometry/pinning techniques | Build a separate directed vehicle graph |
| Flood scenario engine | Later flood/traffic experiments | No coupling in first release |

Current `StreetProps` contains only ID, name, highway class and drain ID. The generator filters out service roads and several connecting road classes. Current routing is bidirectional and designed for walking. Existing docs already identify disconnected estate roads.

**Critical constraint:** broadening the current flood road extraction also changes the street clusters used to generate drain zones. Build an additional traffic network artifact, preserving the existing flood streets, drain assignments and seeded database.

## 3. Scope and release boundaries

### Required first release

- One verified demo township with a directed, connected vehicle network and visible data-quality report.
- Editable synthetic morning/evening/custom trip demand.
- Deterministic traffic simulation with queues, completion counts and travel-time estimates.
- Run, pause, reset, playback speed and timeline scrubbing.
- Congestion map, directional road inspection and a small results panel.
- Housing/commercial development, one access connection, and before/after comparison.
- Two mitigations: reduce development vehicle trips; change capacity on an existing road segment or selected corridor.
- Local save/load, explicit assumptions, meaningful engine tests and browser verification.

### Next release

- Traffic enrichment for newly downloaded townships and upgrade of older downloaded bundles.
- A second site access with explicit connector geometry, capacity and directional restrictions.
- Journey explorer with pinned origin/destination and simulated departure time.
- Sensitivity runs across low/base/high demand, richer junction controls and exports.

### Later research scope

- Flood-related closures and rerouting.
- Finite road storage and queues backing into upstream junctions.
- Calibrated demand from permitted traffic counts, detailed signal timing, buses and other vehicle types.
- Full vehicle-level animation, lane changes, arbitrary new road design and cloud collaboration.

The first release does not need a new service, database table, traffic API or library. Keep the fixed project stack. SUMO is a useful future modeling option, but adopting it would be a separate architecture decision.

## 4. Interface and interaction

Retain the current light theme and township selector. Put the Flood / Traffic selector above the compact workspace tabs. Flood retains Live Warning / Plan Mode / Safe Routes. Traffic initially has Simulation / Development; introduce Journeys only when implemented.

Traffic Simulation panel:

- Scenario preset, demand multiplier and collapsible assumptions.
- Run controls and elapsed simulated time.
- Completed trips, unfinished trips, unreachable trips and mean completed-trip delay.
- Selected-road detail and worst bottlenecks.

Traffic Development panel:

- Site outline, use, development size and trip-rate inputs.
- Suggested access road with **Automatic / Manually adjusted** state and restore action.
- Existing / With development / With mitigation comparison.
- Intervention controls, save/load and assumptions.

Use a clearly labelled congestion legend: free-flow, building queue, heavy queue and unavailable. Final thresholds belong in the engine, documented as display assumptions. Use direction arrows/offset strokes to distinguish opposite carriageway directions. Traffic road colours replace the flood risk layer while viewing Traffic; retain the neutral basemap. A selected road gets contrasting casing.

Optional moving marks indicate direction only. Do not imply a displayed dot represents a real vehicle, or draw physical queue lengths from a model that only counts waiting vehicles. Respect reduced motion and provide numeric alternatives to colour.

Changing inputs marks results stale. Running replaces results only when a matching run completes. Switching area cancels active work and clears incompatible selections. Leaving Traffic pauses playback; returning restores its scenario. Preserve the existing blur transition and keyboard navigation.

## 5. Traffic network and data preparation

Create a versioned `traffic-network.json` beside the existing township assets, using official OSM/Overpass access. Preserve retrieval date, bounding box, model schema and a network fingerprint.

Retain OSM node IDs and way IDs, geometry, highway class, `oneway`, vehicle access, lanes and directional lane tags, speed tags, junction tags, bridge/tunnel/layer information, barriers and restriction relations. Include eligible service and connecting roads. Filter pedestrian-only and prohibited vehicle access. Private/destination-only access must have explicit handling rather than becoming unrestricted through routes.

Build directed links between junctions, boundary crossings and access anchors. Connect roads through shared OSM nodes, not merely because their lines cross on screen. Support reverse one-way and roundabout direction. OSM one-way values refer to the source way's direction, so geometry order matters. [OSM one-way documentation](https://wiki.openstreetmap.org/wiki/Key:oneway).

Represent allowed turns explicitly. First support unconditional via-node restrictions, including prohibited and mandatory turns. Flag unsupported conditional/via-way restrictions; conservatively exclude affected ambiguous movements and disclose incomplete routing coverage until supported. Do not silently turn an unsupported restriction into a legal manoeuvre. [OSM restriction documentation](https://wiki.openstreetmap.org/wiki/Relation:restriction).

Use a bounded extraction buffer around the visible township for junction continuity. Define the actual modeled boundary separately and create entry/exit portals where eligible roads cross it. Do not treat every dead-end street as an external portal. Trips beyond the boundary are outside the model; no citywide travel-time claim.

For missing speed, lane or capacity information, use a centralized road-class assumption table with per-road overrides. Record each value's provenance: mapped, assumed or user-adjusted. Capacity is a model input, not something OSM geometry proves. Normalize units and validate finite positive values; document how ambiguous total lanes are split by direction.

Produce diagnostics before simulation: components, legal reachability between demand points, missing attributes, unsupported restrictions and unmapped boundary connections. Never bridge disconnected roads by straight-line proximity. The initial release enables only townships with a validated traffic network. Older downloads continue working for floods and show “Traffic data not prepared” until enrichment is available.

## 6. Demand: where the cars come from

Traffic needs both a road network and trips that use it. This separation also appears in established simulators' input models. [SUMO basic inputs](https://sumo.dlr.de/daily/userdoc/Simulation/Basic_Definition.html).

Represent demand as origin–destination pairs, vehicles/hour and a departure profile. For the demo township, define a small, documented set of fictional residential origins, commercial destinations and external portals. Morning and evening presets change the assumed trip pattern; they are not observations of local commuting.

Allow users to edit demand weights and the overall demand level. Generate departure times deterministically using a stored seed, with stable trip IDs. Keep all trips, including unreachable ones, in the accounting.

Development generation uses one consistent unit basis:

| Use | User enters | Rate basis |
|---|---|---|
| Housing | Number of homes | Vehicle trips per home per hour |
| Commercial | Gross floor area in m² | Vehicle trips per 100 m² per hour |

Housing trips/hour = homes × vehicle-trip rate. Commercial trips/hour = floor area / 100 × vehicle-trip rate. Divide each total into inbound/outbound shares and destination weights. These rates already count vehicles: do not multiply again by occupancy or car-mode share. A “reduce vehicle trips” mitigation applies once to the generated trips.

Illustrative arithmetic only: 300 homes × an assumed 0.5 vehicle trips/home/hour = 150 extra vehicle trips/hour. This is not a Malaysian planning standard or a researched default. Final demo rates are labelled assumptions and editable.

Do not infer occupancy or traffic demand from paving percentage, site area alone, or building height. A reused flood outline copies geometry and use only; the user supplies traffic development size.

Choose the nearest eligible access segment to the site boundary with legal inbound/outbound reachability to the selected demand destinations. Explain the suggestion and allow override. If there is no suitable road within a documented search limit, require manual selection. Show the virtual connection as schematic; it does not prove a driveway can be built across intervening land. Split directed links at the anchor while preserving length, direction and turn permissions.

## 7. Simulation algorithm

Use a **deterministic, fixed-timestep point-queue model** for the first release. Cars take time to traverse a road and may then wait to pass a bottleneck. This gives meaningful queues and journey times without implementing detailed driving behaviour.

Proposed starting configuration: one-second engine steps; 60 minutes of departures followed by up to 30 minutes for remaining trips to finish. Both horizons are scenario inputs. Initial state is an empty network and must be stated; optional warm-up can follow later. Playback speed never changes the engine timestep.

Each directed link stores length, free-flow travel time, discharge capacity in vehicles/hour and an ordered exit queue. Each junction has allowed movements and a simplified shared service budget so every incoming road cannot independently consume the junction's full capacity.

For each timestep:

1. Release scheduled trips and account for those with no legal route.
2. Move eligible travelers into exit queues after their traversal time elapses.
3. Compute permitted transfers using link and junction service budgets. Accumulate fractional service credit, but cap unused credit to avoid a burst after an idle period.
4. Allocate contested movements deterministically with a fair rotating order; preserve FIFO within each link. One shared queue per direction is a deliberate simplification of separate turn lanes.
5. Apply transfers together from a snapshot of the step's state. A vehicle cannot traverse several links in the same timestep because of iteration order.
6. Record arrivals, waiting times, completion times and aggregated map snapshots.

Initial routes use shortest estimated time on the directed movement graph. At fixed intervals, update smoothed costs from free-flow time plus estimated queue delay for newly departing trips. Use stable tie-breaking. Keep an active trip's route fixed in the MVP, avoiding continuous route oscillation. This is a simplified adaptive assignment, not traffic equilibrium; routing everyone on an empty-network shortest route can concentrate demand unrealistically. [SUMO assignment discussion](https://sumo.dlr.de/docs/Demand/Dynamic_User_Assignment.html).

The MVP has no finite link storage or upstream spillback. Report **vehicles waiting**, not metres of physical queue. Finite storage and downstream supply constraints require a later model revision and separate validation.

At every step, enforce:

`released trips = completed + traveling + queued + waiting at origin + unreachable`

Future departures are counted separately. End-of-run unfinished trips remain visible. Never remove stuck vehicles to improve the reported result.

## 8. Comparisons and useful outputs

Run three copies of the same scenario:

- Existing: background demand and current road assumptions.
- With development: the same background demand plus development trips.
- With mitigation: development scenario with explicit capacity or demand changes.

Use identical seed, departure schedule for unchanged trips, horizon and network version. A demand-reduction intervention removes a stable subset of development trips rather than regenerating unrelated background traffic. Report background and new-development groups separately where relevant.

Core outputs:

- Released, completed, unfinished and unreachable trips, plus completion percentage.
- Mean and 95th-percentile completed-trip journey time and delay, with completed sample size.
- Accumulated waiting time including unfinished trips.
- Peak waiting vehicles and duration of congestion by direction/link.
- New development trips and impact on existing travelers.

Always display completion alongside average time: a severely congested scenario can have a deceptively low completed-trip average because long trips have not finished. Handle no completed trips as unavailable, not zero minutes.

Mitigation A reduces generated development trips by an editable percentage. Mitigation B changes selected road discharge capacity with an explicit assumed multiplier. Neither guarantees an improvement everywhere: changing one bottleneck can move the queue elsewhere. Keep downstream impacts in the result.

Snapshots on the timeline represent one common simulated time. Do not construct a displayed traffic state from each road's independent peak. Provide a separate, labelled peak-summary view if needed.

## 9. Implementation structure

Proposed files, subject to a small integration review before coding:

| Path | Responsibility |
|---|---|
| `lib/engine/traffic/types.ts` | Versioned input/output types, units and provenance |
| `lib/engine/traffic/network.ts` | Graph normalization, access anchors, allowed movements and diagnostics |
| `lib/engine/traffic/demand.ts` | Demand presets, development trips and seeded schedules |
| `lib/engine/traffic/routing.ts` | Directed time-weighted routes |
| `lib/engine/traffic/sim.ts` | Pure timestep progression and vehicle accounting |
| `lib/engine/traffic/metrics.ts` | Congestion rules, result summaries and comparisons |
| `lib/engine/traffic/scenario.ts` | Validation and baseline/development/mitigation construction |
| `lib/generator/traffic.ts` | Server-side OSM enrichment separate from flood clustering |
| `lib/traffic/worker.ts` | Worker protocol and simulation runner |
| `lib/traffic/useTrafficSimulation.ts` | React lifecycle, cancellation and playback |
| `lib/storage/traffic-scenarios.ts` | Versioned local saves |
| `components/TrafficPanel.tsx` | Simulation controls and road inspection |
| `components/TrafficDevelopmentPanel.tsx` | Development and mitigation workflow |
| `components/TrafficComparison.tsx` | Results and assumptions |
| `lib/traffic/map-layers.ts` | Traffic-only MapLibre source/layer lifecycle |
| `tests/traffic-*.test.ts` | Graph, demand, simulation, metrics and scenario tests |

Integrate narrowly into Dashboard and TownshipMap. Extract shared site drawing only where required; preserve existing proposal schemas. Engine files remain pure TypeScript with relative `.ts` imports. Read installed Next.js worker/bundling and React guidance before implementation; verify the worker through the actual production build early.

Keep resident/guard routes, check-in/task APIs, help engine, PhoneHeader and ResponderMap outside this feature's ownership. No traffic code writes `drain_status` or guard tasks.

## 10. Performance, playback and persistence

Run calculation in a Web Worker. Include run ID, scenario hash and network fingerprint in requests/results; discard stale messages. Chunk processing so cancellation is serviced, or terminate/recreate the worker on cancellation. Surface errors without losing the draft.

Store compact snapshots every 10 simulated seconds initially. Playback interpolates presentation only; scrubbing reads recorded state. Update React summaries at a bounded rate and keep per-frame map animation out of React state. Pause rendering in hidden tabs and clean up workers, listeners and layers on area changes/unmount.

Initial benchmark target, to be measured rather than promised: a 90-minute run with 1,000 directed links and 5,000 trips completes in under five seconds on the demo laptop, with a responsive map during calculation. Benchmark first; enforce tested graph/trip limits and display an actionable message for oversized inputs. Check snapshot memory before supporting long scenarios or many simultaneous saved results.

Save inputs, seed, model version, network fingerprint and compact summary locally. Recompute playback on load. Warn and recalculate when data/model versions differ; never present old results as current. Use a separate namespace such as `hydrotwin_traffic_v1_<slug>`, bounded to 30 proposals, with quota/corrupt-save handling. Keep flood saves compatible.

For downloaded township enrichment, add an optional traffic artifact and its schema version. Migrate IndexedDB only if the object-store structure changes; old records without traffic data remain valid. Fetching failure leaves flood data usable. Cloud synchronization is later work and would require its own schema, RLS and migration.

## 11. Delivery sequence and acceptance gates

| Phase | Deliverable | Gate before proceeding |
|---|---|---|
| 0 — Baseline and contracts | Inspect current diff, verify existing app, amend proposed scope, define units/defaults/model contract | Existing flood workflow passes checks; team-owned changes preserved |
| 1 — Network | Separate traffic extraction and diagnostics for one township | One-way, intersection, boundary, access and reachability fixtures pass; demo corridors visibly connected |
| 2 — Engine | Seeded demand, directed routing, point queues, metrics | Reproducible results, vehicle conservation and bottleneck tests pass; worker proof builds |
| 3 — Simulation UI | Domain selector, traffic map, controls, inspection, timeline | Full run/pause/reset/scrub works; no stale results after area switch; benchmark measured |
| 4 — Development | Site demand, automatic access, three-scenario comparison and two mitigations | Same background demand in all cases; effects explained; completion/unfinished counts shown |
| 5 — Release | Local saves, assumptions, accessibility, regression checks and demo | Lint, tests, build and browser acceptance pass; documentation updated |
| 6 — Extension | Download enrichment, second access, journey explorer and sensitivity | Each addition passes its own graph/data migration and comparison checks |

Prioritize Phases 0–5 for a complete first release. Given the existing 23 October submission target, reassess feasibility after Phase 1: network quality is the largest unknown. Do not promise all-township support or flood coupling before that gate. If time is tight, use one prepared township and omit ornamental moving vehicles, extra mitigations and cloud saves. If the verified comparison cannot be completed, retain the existing flood demo and present traffic as future work.

Use small commits in dependency order: network/contracts; pure engine/tests; worker/playback; UI; development/mitigation; persistence/release documentation. Pull before any eventual push and review concurrent edits. This plan does not itself commit or push changes.

## 12. Validation plan

Use `node --test` for meaningful engine invariants and hand-checkable fixtures:

- One-way forward/reverse, roundabout, prohibited turn, bridge crossing without junction, disconnected roads and inaccessible entry.
- Access anchors split lengths correctly and preserve directed reachability.
- Zero demand, one vehicle at free-flow travel time, simple overloaded link with analytically predictable queue growth and later drainage.
- Fractional capacity credit, shared junction budget, deterministic merge fairness and no duplicate/lost vehicles.
- Identical runs with identical inputs; input objects are not mutated.
- Unreachable trips, fully blocked destination, horizon cutoff and no completed-trip statistics.
- On a simple isolated bottleneck, lower demand reduces queue pressure; avoid asserting universal improvement for every network capacity increase.
- Demand formulas, inbound/outbound totals, comparable background trip IDs and save/version validation.

Browser verification covers desktop and mobile layouts, reduced motion, keyboard controls, drawing/access overrides, road inspection, all three result stages, saves/reload, corrupted storage, cancellations and area switching during a run. Verify source/layer cleanup, console errors and production worker loading.

Regression-check flood local/cloud presentation, drainage planning, safe routes and the existing resident/guard interfaces without changing their ownership. Before release run `npm run lint`, `npm test`, `npm run build`, then inspect the built app in the browser. Current unverified UI work must be checked during Phase 0 rather than assuming an earlier test run covers it.

Update `docs/spec.md`, `docs/data-contracts.md`, `docs/progress.md`, `docs/ai-use-log.md`, README and the UI assumptions/footer as implementation lands. Record any newly introduced datasets, libraries or assets and licences in `docs/third-party.md`.

## 13. Later flood and traffic integration

Once independent traffic behavior is validated, study: “When flooded roads close, where does traffic go?” Use flood snapshots at matching simulation times, an explicit road-to-flood mapping and documented vehicle closure assumptions. The current independent per-zone peak preview cannot serve as a simultaneous closure timeline.

Define how already-traveling vehicles are handled at a closure, which trips wait or reroute, and how unknown flood coverage is displayed. Never derive vehicle safety from walking-route status alone. This extension ties mobility back to climate resilience, but requires a separate model version and acceptance tests.
