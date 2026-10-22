# Real traffic baseline and development impact — implementation handoff

Prepared 19 October 2026 (Asia/Kuala_Lumpur). Status: planning only; the fixes below have NOT been implemented. This document supersedes conflicting traffic recommendations in the older `traffic-implementation-plan.md`, while preserving its historical record.

## Conversation context — preserve for the next session

The user observed that adding multiple housing sites makes only certain streets yellow, while every road is green before any changes. They questioned whether this is realistic and whether the source is MyTomTom.

The review established that the code integrates TomTom Traffic Flow; MyTomTom is where the API key is managed. The initial map does not actually request traffic speeds. It checks whether the key is configured and paints unobserved roads green. Observations are requested only when Assess is clicked. Consequently, green currently does not reliably mean observed free-flow traffic.

The user then asked: “cant we make the initial not assumed but real traffic data? also for the point number 3, would implementing a ai model assumption be good?”

The proposed direction was to load real current traffic on opening Traffic, retain unknown roads as grey, and reuse that snapshot for development comparisons. TomTom flow tiles are a candidate for wider map display; network impact calculations still require traffic mapped to directed OSM links. Current observations can legitimately all be green: do not manufacture congestion to make the map look realistic.

For AI, the recommendation was real observations plus explicit development assumptions and deterministic assignment. An LLM inventing congestion, destination demand or colours does not establish accuracy. AI could later suggest sourced, editable assumptions or explain results. A trained forecasting model is a separate research task requiring historical data and held-out validation. The user has not explicitly selected an AI implementation or approved a new external AI service.

The latest request is to write this implementation plan and retain the conversation context because the user's usage limit is running out. Do not treat this planning request as a claim that implementation is complete.

## Repository constraints and starting point

- Read `AGENTS.md`, `docs/spec.md`, `docs/data-contracts.md` and `docs/progress.md` before coding. Read relevant installed Next.js guides under `node_modules/next/dist/docs/` and relevant `.claude/skills/` instructions.
- Keep Next.js 16, TypeScript, MapLibre/OpenFreeMap, Supabase and node:test. Keep traffic independent of flood streets, drain assignments and risk rules.
- Pure traffic model code stays in `lib/engine/traffic/`; no React, Next.js or provider imports there. Relative imports end in `.ts`.
- Keep provider keys server-side. Do not print `.env.local` or upstream URLs containing keys. Record new APIs/datasets/libraries and licences in `docs/third-party.md`, and material AI work in `docs/ai-use-log.md`.
- The working tree already contains many modified and untracked traffic files from prior work. Preserve them. Do not reset or overwrite unrelated changes.
- Current UI supports up to six sites, v3 input-only saves and migration from v2. Some existing docs still describe single-site v2 and four destination sectors; code now uses eight sectors with up to two connections each. Reconcile docs with actual final behaviour.

## Findings verified in this session

1. `components/TrafficWorkspace.tsx`: mount calls GET `/api/traffic-baseline`, which returns configuration only. POST runs inside `assess()` after sites exist.
2. Its speed-colour fallback explicitly paints unobserved roads green and estimates proposed speeds from free-flow for those roads. This contradicts the contract that unknown roads remain grey. Expired observations also enter this fallback.
3. Closed observations fail `o && !o.closed` and can enter the green fallback, rather than displaying the closure colour.
4. The provider uses the official `/traffic/services/4/flowSegmentData/absolute/16/json` endpoint. At most 24 locations are sampled per assessment, selected from proposal corridors. This is not full-township coverage.
5. GET configuration success proves only that an environment variable exists; it does not prove API authorisation, successful retrieval or local coverage.
6. `lib/engine/traffic/impact.ts` calculates conservative directional matches, observation age/confidence checks, closures, added trips, ten assignment batches and coverage. Unknown-road current/proposed times remain null in engine results, but the UI independently fabricates speed colours for them.
7. Destinations are geographic stand-ins, equally weighted; capacities default to assumed 900 vehicles/hour/lane or 450 for service roads. Existing demand is inferred from speed through a BPR-style sensitivity curve, not measured traffic volume. Junction signals and physical queue spillback are not modeled.
8. The verdict tests `newlyCongested === 0` and then claims all evaluated corridors are acceptable. That does not exclude already-congested roads, missing observations or poor coverage. `routeCoverage` is calculated but is not shown in the current results panel.
9. Directed opposite links can overlap visually. Inspect layer ordering/offsets before trusting a single apparent road colour; this is a follow-up investigation, not a confirmed bug from this session.

Validation in this session: all 10 tests in `tests/traffic-impact.test.ts` passed using `node --experimental-strip-types --test tests/traffic-impact.test.ts`. These are engine/provider tests, not UI regression coverage. No browser inspection or live provider request was performed during this review. Earlier progress entries report a successful live run, but that is historical evidence and does not establish current coverage.

## Intended user experience

1. Enter Traffic: immediately load current traffic for the township, without requiring a development outline.
2. Show loading, observed conditions, unknown roads, closures and retrieval time honestly. Keep unavailable/expired traffic visibly unknown.
3. Draw one or more sites, enter homes or commercial floor area, and accept/adjust existing-road access.
4. Assess all completed sites using one valid baseline snapshot. Compare Current / With development with consistent colours and spatial coverage.
5. A separate Added vehicles/hour view shows modeled development flow, including roads without observations, without claiming their current congestion is known.
6. Inspect a road to see its direction, observed versus assumed values, extra trips, estimated speed change when supported, and data age.
7. Show incomplete coverage, unassigned demand and model assumptions alongside conclusions.

## Phase 1 — restore honest colours and conclusions

- Centralise traffic display rules in pure engine/helper code, with explicit observed, unknown, stale and closed states. Remove the UI's independent congestion formula for unobserved roads.
- Grey means no usable current observation; dark red means reported closure. Green/amber/red apply only to usable provider observations or explicitly modeled projections rooted in those observations.
- Preserve existing speed-ratio thresholds initially; document them as display choices. Added-flow colours represent additional vehicles/hour, not congestion.
- Show matched/affected directed segment counts and assigned vehicle-distance coverage. Explain that route coverage is not township-wide coverage. Establish a separate township coverage metric for initial conditions.
- Replace the blanket acceptable verdict. Distinguish no matches, incomplete coverage, existing congestion, newly congested links and no newly detected congestion among covered links. Report unassigned trips separately.
- Make key configured, provider responding, snapshot fresh and coverage sufficient separate UI states.

Acceptance: missing, failed or expired data never turns a road green; closures remain visible; zero newly congested links never implies an all-clear for unknown or already-congested roads.

## Phase 2 — load real initial traffic independently of sites

First perform a small integration investigation against current official TomTom docs and the account's enabled products. Verify coverage in Bukit Raja and usage/licensing constraints before choosing the acquisition method.

Candidate A: fetch township-wide flow tiles for the current map extent. Vector tiles may support provider geometry and attributes; verify the chosen API version's schema before assuming numeric speeds are available. Raster tiles are suitable for display but cannot directly supply numeric per-link impact inputs. Check current Orbis migration guidance before adopting a new integration.

Candidate B: extend existing segment sampling to a bounded, geographically distributed set of eligible roads, independent of proposals, with progressive requests and coverage reporting. One returned segment may cover several OSM links; deduplicate matches. Do not issue one uncontrolled request per network link.

Choose based on actual coverage, numeric matching feasibility, request cost and implementation time. A provider traffic overlay alone does not complete network baseline integration. Keep provider geometry and OSM geometry visibly consistent when toggling views.

- Separate baseline loading from assessment. Trigger on Traffic entry and area change; offer manual refresh and a bounded refresh policy compatible with provider terms.
- Keep server-side access, bbox/request limits, timeouts, sanitised errors, rate limits and cancellation. The current process-local 30-second throttle needs adaptation so initial loading and Assess do not immediately block each other.
- Cancel superseded requests on area change/unmount; reject late responses and avoid mixing baseline snapshots across areas or runs.
- Store observations in memory only under the existing no-provider-persistence policy. Verify any proposed cache/refresh design against current terms before changing it.
- Permit assessment with an existing fresh snapshot; refresh when needed. State retrieval time honestly, since it is not necessarily the provider's measurement time.
- Keep missing residential-road coverage grey. More requests cannot guarantee TomTom knows every road.

Acceptance: a user can inspect actual reported traffic before drawing a site; failures and partial coverage are visible; entering another township never retains the previous area's traffic.

## Phase 3 — improve development demand and assignment

- Retain multi-site assessment and input-only saved proposals. Do not reintroduce the superseded replay/timeline workflow.
- Replace equal geographic destination weights with a documented demand distribution using actual eligible township exits and, where licensed data exists, schools, retail and employment locations. Snap destinations to legal reachable road nodes. OSM POIs indicate locations, not measured trip demand; their attraction weights remain explicit assumptions.
- Identify external gateways from network boundary connections instead of treating arbitrary distant nodes or dead ends as exits. Expose/inspect destination shares and inaccessible destinations.
- Keep housing and commercial vehicle trip rates editable with units. Introduce low/base/high development-demand sensitivity around the same real snapshot; do not label these historical morning/evening conditions.
- Source defensible local trip rates where available; otherwise label defaults illustrative. Do not apply vehicle occupancy or mode share twice to a rate already expressed as vehicle trips.
- Preserve deterministic routing, legal directions/turns and closure exclusions. Compare multiple plausible routes and ensure multi-site iteration order does not materially bias results; test and disclose any retained order sensitivity.
- Precompute destination/reachability work instead of recalculating it within every batch. Benchmark on the prepared township network before increasing sampling or scenario count.
- Keep observed speeds as the baseline and make assumed capacity explicit. If junction delays are added, choose and document a bounded model, avoiding double-counting delay already reflected in observed speeds. Full signals, queue spillback and regional calibration are later scope unless separately agreed.
- Show extra vehicles even when the congestion colour does not change: colour thresholds are coarse, and modest additional flow need not change a road's category.

Acceptance: trips balance as assigned plus unassigned; shared corridors aggregate multiple sites; only legally reachable paths receive flow; increasing demand gives explainable results; every projection distinguishes observed inputs from assumptions. Do not aim to turn a predetermined number of streets yellow.

## Phase 4 — AI boundary

No external AI dependency is needed for Phases 1–3. Optional later assistance may propose sourced trip-rate ranges, explain why corridors attract trips, or summarise sensitivity results. Any suggested inputs must be editable, validated and passed through the same deterministic engine. Record their provenance and label them as suggestions.

Do not let an LLM fabricate observed traffic, assign map colours, invent API coverage, or present uncalibrated guesses as forecasts. A learned prediction model requires a licensed historical dataset, defined targets/horizons, time-based validation, comparison against simple baselines, error reporting and uncertainty. Treat that as separate work.

## Files likely to change

- `components/TrafficWorkspace.tsx` and `.css`: baseline lifecycle, honest legend/status, coverage, scenarios and conclusions.
- `components/TownshipMap.tsx`: provider overlay if chosen, road direction visibility and selection styling.
- `app/api/traffic-baseline/route.ts`, `lib/traffic/provider.ts`: bounded independent retrieval and provider handling; add tile routes/adapters only if selected.
- `lib/engine/traffic/impact.ts`, `network.ts`, `scenario.ts`: display rules, matching, demand distribution and assignment as required.
- `lib/traffic/impact-worker.ts`: matching/assessment messages, cancellation and consistent snapshot identities.
- `tests/traffic-impact.test.ts` and relevant traffic tests: meaningful regressions for the confirmed issues and new model behaviour.
- `docs/spec.md`, `data-contracts.md`, `progress.md`, `third-party.md`, `ai-use-log.md`, README and `.env.example` if configuration changes.

## Verification and delivery gates

- Unit regressions: unknown/stale/closed display states; no-match/incomplete/already-congested verdicts; directional matching; snapshot identity; route coverage; demand conservation; multi-site shared corridors and order sensitivity.
- Provider checks with mocks: timeouts, invalid key, throttling, malformed data, duplicate segments and partial responses. Perform a bounded live check without exposing secrets.
- Browser: open Traffic with no sites; inspect actual request success and colours; refresh; change township; assess multiple sites; compare current/proposed and flow delta; expire/fail observations; test closure fixtures, opposite directions, mobile layout and save/load.
- Run `npm run lint`, `npm test` and `npm run build`. Existing docs mention a successful `npm run build -- --webpack` fallback after Turbopack failures; attempt the required normal build and report any fallback accurately.
- Update progress only for work actually completed. Report measured coverage and limitations, not universal realism. No new library, API or dataset without a licence row.

## Official references checked in this conversation

- Traffic Flow service: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/traffic-flow-service
- Vector flow tiles: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/vector-flow-tiles
- Raster flow tiles: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles
- Segment data: https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/flow-segment-data
- Orbis v2 service: https://docs.tomtom.com/traffic-api/documentation/tomtom-orbis-maps/v2/traffic-flow/traffic-flow-service

Next session should start with Phase 1 and the Phase 2 acquisition investigation, preserving all existing user changes. The next coding session must recheck current API documentation and the relevant local framework guides before implementing.
