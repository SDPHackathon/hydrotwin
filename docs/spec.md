# HydroTwin — what we're building

> **Warn residents today. Plan a township that floods less tomorrow.**

SDP University Hackathon 2026 · Track: **Planet — climate resilience** (bridges People — safety) · Township: **Bandar Bukit Raja, Klang** (low-lying, 4–7 m above sea level in our data).

One 3D township map, three modes:

| Mode | In one line |
|---|---|
| **Live** | Drain sensors → risk engine → each street green / amber / red with time-to-flood → residents get an alert with an action → at red, guards get the vulnerable-resident list and check them off |
| **Plan** | Put a fix on the map (bigger drain, retention pond, green area) → replay the same storm → before / after |
| **Safe routes** | Red streets blocked → shortest safe route to parking / an evacuation point |

The edge over pro tools like 3Di: **planning linked to live warnings and the response on the ground**, not a simulation on its own.

## The demo = the acceptance test

The 5-minute video (due with the submission, 23 Oct 11:59 PM) follows this story. If a step can't be shown, it isn't done.

1. Calm township — dashboard all green.
2. On the web dashboard, *Start storm*. Rain rises in the local simulation. For the separate phone demonstration, start the shared phone/server storm from **Control**.
3. Drains fill (the rings on the map fill up). **The lowest zones (D07, D08) turn amber ~30 min before they overflow** → residents on its streets get an alert with an action ("Move your car to the multi-storey car park now").
4. D07/D08 overflow → **red** → water spreads zone by zone → the guard view lists vulnerable residents on red streets → guards tick them off; residents tap *I'm safe* / *I need help*.
5. **Plan mode**: put a retention pond on D08 (OSM already shows a flood retention pond nearby) → replay the same storm → before / after (flooded streets, deepest water, minutes to first red).
6. **Safe routes**: before the origin floods, derive shared dry road anchors from the baseline storm for every township and show a green-first route from a confirmed Locate me/manual street origin. Flood a connecting zone to demonstrate a detour or explicit failure. Flood the origin to withdraw the walking line and offer help; never route through a flooded origin.

## Acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| LIVE-1 | Every street is coloured by its drain's status; a change shows on the map within 2 s | ✅ local (Step A) |
| LIVE-2 | Risk rules as in `data-contracts.md`, covered by `npm test` | ✅ |
| LIVE-3 | Phone control page: start / pause / reset / speed + a level slider per drain (for judges' questions) → readings reach the risk engine | Step B |
| LIVE-4 | Resident and guard pages use shared phone/server conditions. The web dashboard always uses its own local storm for map conditions, weather, controls and Safe Routes. | Updated 22 Oct |
| LIVE-5 | Resident page (phone): pick a demo resident → see your street's status → alert with an action when your drain turns amber → *I'm safe* / *I need help* with what for (type, people, note) → live tracker: sent → guard on the way → resolved | ✅ Step C · two-way in Step F |
| LIVE-6 | Guard view (phone): at red, open tasks for vulnerable residents on red streets; *need help* on top with the ask and an elapsed timer; alert sound; *On my way* → *Resolved* | ✅ Step C · two-way in Step F |
| LIVE-7 | Dashboard Phone Links opens a separate tab with a simple Resident / Storm Control / Guard chooser. Resident/Control retain township context; mobile headers omit cross-page links and browser Back returns to the chooser. | ✅ 22 Oct |
| PLAN-1 | Pick a drain → apply one fix. Draft effects: bigger drain = outflow ×1.5 · retention pond = catchment ×0.6 · green area = catchment ×0.8 (team: find a source for the numbers or call them assumptions) | Step D |
| PLAN-2 | Replay the storm instantly (run the engine in a loop, no waiting) → before / after table: streets flooded, deepest water (cm), minutes to first red | Step D |
| PLAN-3 | Save a scenario to `plan_scenarios`; compare two | Step D |
| ROUTE-1 | Green-only routes first, shortest distance within that tier; amber fallback warns; red/unknown streets and flooded origins blocked. Street endpoints/pins are schematic origins, not house locations. | Step E + automatic routing |
| ROUTE-2 | Responder route: nearest guard post → the resident's street, dry roads first, the wet stretch measured and drawn separately (`findResponderRoute`) | Step F |
| ROUTE-3 | Simulation-derived dry road points load for built-in and shared downloaded townships. Resident Locate me/manual hints replace personas. Routing and street condition share one area-specific phone/server snapshot; anonymous demo help tracking stays independent. | Automatic routing |
| ROUTE-4 | Route expiry, unknown/offline conditions, destination ineligibility and blocked origins withdraw the line. Actual previous-path evidence drives alerts; ordinary polls do not re-alert or move the camera. | Automatic routing |
| ROUTE-5 | Location-first resident entry: cross-area street search, one-shot location or map point; explicit road/boundary confirmation, overlapping-area choice, and honest unavailable/outside-coverage states. Names never imply whole-town coverage. | ✅ 21 Oct |

## Build order — one builder, so depth before breadth

1. **Live loop on Supabase** (LIVE-3, LIVE-4) — the riskiest part; prove realtime to a phone first.
2. Resident page + guard view (LIVE-5, LIVE-6).
3. Plan mode (PLAN-1…3). Port the useful parts of the HydroTwin prototype here (terrain, building geometry, hydrology visuals) — but the before / after numbers come from `lib/engine/`, so Live and Plan always agree.
4. Safe routes (ROUTE-1).
5. Optional, only if 1–4 are solid: a Gemini copilot that explains a plan's before / after in plain words (declare it in the AI disclosure).
6. **Step F (Azim, from 17 Oct)** — the call-for-help loop made two-way (LIVE-5, LIVE-6) + the responder route (ROUTE-2); phone pages installable.

## Out of scope

Detailed building / road layout editing and zoning approvals, real hydraulics, hardware, Google or Cesium map tiles. Site-level development screening and the scoped traffic extension below are included.

## Traffic screening (19 Oct scope extension)

The dashboard offers Flood / Traffic on the existing MapLibre map. The traffic workspace is a township-impact planner: draw a housing/commercial site, enter homes or gross floor area, accept/adjust the suggested existing-road connection and click Assess township impact. A server-only TomTom integration retrieves current traffic on surrounding candidate corridors. The impact engine assigns additional trips in ten batches, allowing later trips to use alternatives as estimated costs change. Compare Current traffic / With township directly on the map and inspect additional vehicles/hour and estimated extra road-traversal time. No scenario replay, synthetic background-demand controls or timeline appears in this workflow.

Bukit Raja has a prepared independent OSM road network; other areas attempt OSM enrichment. Current speeds/free-flow speeds/closure flags come from TomTom where matched by geometry and direction. Road capacities, development trip rates, surrounding destination shares and the inferred relationship between speed and demand remain explicit assumptions. A BPR-style sensitivity curve uses observed speeds as its starting point; it does not measure existing traffic volume or establish a calibrated forecast. Missing, stale, low-confidence and unmatched traffic stays unknown/grey. Coverage is weighted by assigned travel distance and shown with the result; incomplete coverage cannot establish absence of wider congestion. No key or provider failure produces no fabricated baseline. Historical peak data, regional OD calibration, physical queue lengths, junction signal models, spillback, new roads and flood coupling are future work. Proposals save inputs only; live content is not persisted.

## Development screening (18 Oct scope extension)

Plan mode offers **Improve township** and **New development**. For a development, draw one site inside the loaded township and select housing/commercial. Finishing the outline suggests the nearest road to its outline centre and that road's existing Live Warning drain zone; both can be overridden manually. Zone size is estimated from its mapped street extent, so there is no manual catchment-area input. Set before/after paving and compare existing conditions, developed conditions, and development with one mitigation under the identical synthetic storm. Save proposals locally and compare up to two under current township data.

Results describe the receiving zone's existing streets and the selected access road. They do not establish parcel suitability, predict water inside the drawn polygon, create new roads, or model water moving between drain zones. The boundary is a proposal outline. Map previews show each zone at its own peak, not a simultaneous flood snapshot. The street-zone footprint estimate, runoff coefficients and mitigation effects are explicit demo assumptions. Green space is represented through land cover only.

## Simplifications we state out loud

- **Drains are simulated zones**: real OSM streets grouped into 10 zones; each zone's ground height is real (Open-Meteo, ~90 m DEM), so low zones fill faster.
- **The storm is a synthetic 3-hour design storm** (peak ≈126 mm/h, severe) until we pick a recorded Klang storm.
- **Water = drain overflow shown as depth along that zone's streets** — not a flow model. Slab height is drawn ×4 so 5–50 cm is visible next to houses (`lib/water.ts`); the UI says so.
- **No hardware**: a sensor is anything that can call the risk engine; a phone plays the sensor on stage. SDP would buy off-the-shelf level sensors; we are the software.

## Open decisions (team)

- Recorded storm + its source / licence (JPS?) — replaces the synthetic storm.
- Flood-history evidence for Bukit Raja (news, JPS) — the evidence team.
- Who owns the Supabase project (the builder, so he can work without waiting).
- Hosting: not needed for 23 Oct (repo + video); a hosted link as a backup for the Top 10 pitch.
