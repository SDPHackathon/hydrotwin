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
2. On a phone, the **control page**: *Start storm*. Rain rises.
3. Drains fill (the rings on the map fill up). **The lowest zones (D07, D08) turn amber ~30 min before they overflow** → residents on its streets get an alert with an action ("Move your car to the multi-storey car park now").
4. D07/D08 overflow → **red** → water spreads zone by zone → the guard view lists vulnerable residents on red streets → guards tick them off; residents tap *I'm safe* / *I need help*.
5. **Plan mode**: put a retention pond on D08 (OSM already shows a flood retention pond nearby) → replay the same storm → before / after (flooded streets, deepest water, minutes to first red).
6. **Safe routes**: from a house on a red street to the nearest safe point, avoiding red streets.

## Acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| LIVE-1 | Every street is coloured by its drain's status; a change shows on the map within 2 s | ✅ local (Step A) |
| LIVE-2 | Risk rules as in `data-contracts.md`, covered by `npm test` | ✅ |
| LIVE-3 | Phone control page: start / pause / reset / speed + a level slider per drain (for judges' questions) → readings reach the risk engine | Step B |
| LIVE-4 | Dashboard, resident page and guard view update from Supabase Realtime, not local state | Step B |
| LIVE-5 | Resident page (phone): pick a demo resident → see your street's status → alert with an action when your drain turns amber → *I'm safe* / *I need help* with what for (type, people, note) → live tracker: sent → guard on the way → resolved | ✅ Step C · two-way in Step F |
| LIVE-6 | Guard view (phone): at red, open tasks for vulnerable residents on red streets; *need help* on top with the ask and an elapsed timer; alert sound; *On my way* → *Resolved* | ✅ Step C · two-way in Step F |
| PLAN-1 | Pick a drain → apply one fix. Draft effects: bigger drain = outflow ×1.5 · retention pond = catchment ×0.6 · green area = catchment ×0.8 (team: find a source for the numbers or call them assumptions) | Step D |
| PLAN-2 | Replay the storm instantly (run the engine in a loop, no waiting) → before / after table: streets flooded, deepest water (cm), minutes to first red | Step D |
| PLAN-3 | Save a scenario to `plan_scenarios`; compare two | Step D |
| ROUTE-1 | Red streets blocked; shortest path on the OSM road graph from a chosen house to the nearest safe point | Step E |
| ROUTE-2 | Responder route: nearest guard post → the resident's street, dry roads first, the wet stretch measured and drawn separately (`findResponderRoute`) | Step F |

## Build order — one builder, so depth before breadth

1. **Live loop on Supabase** (LIVE-3, LIVE-4) — the riskiest part; prove realtime to a phone first.
2. Resident page + guard view (LIVE-5, LIVE-6).
3. Plan mode (PLAN-1…3). Port the useful parts of the HydroTwin prototype here (terrain, building geometry, hydrology visuals) — but the before / after numbers come from `lib/engine/`, so Live and Plan always agree.
4. Safe routes (ROUTE-1).
5. Optional, only if 1–4 are solid: a Gemini copilot that explains a plan's before / after in plain words (declare it in the AI disclosure).
6. **Step F (Azim, from 17 Oct)** — the call-for-help loop made two-way (LIVE-5, LIVE-6) + the responder route (ROUTE-2); phone pages installable.

## Out of scope

Detailed building / road layout editing and zoning approvals, traffic simulation, real hydraulics, hardware, Google or Cesium map tiles. Site-level development screening is included as the scoped extension below.

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
