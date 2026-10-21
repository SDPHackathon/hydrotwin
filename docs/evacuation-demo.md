# Location-based evacuation demo

The same deterministic algorithm selects dry road points for built-in, cached and new downloaded townships. It replays the baseline 210-minute storm, excludes every zone that becomes red, and chooses spaced points on actual connected roads. These are simulation results, **not verified shelters**. Baseline dryness does not guarantee a route or safe travel in changing conditions. No AI API is used.

## Walk-through

1. Open the laptop dashboard. Existing IndexedDB downloads automatically share their roads/drains with the laptop demo server. New downloads register during generation. Custom areas must be reshared by reopening the dashboard after a server restart.
2. Open `/control?area=bukit-raja` and reset. All townships have independent simulator state, even with repeated drain IDs. Startup has no initialized observations until readings/reset.
3. Open `/resident` on a fresh browser. There is no resident persona. Select the township, type `Gamelan 1F`, choose the hint and confirm the mapped street endpoint. A route to a simulation-selected dry road point appears. Manual search is approximate, not house-address geocoding.
4. Alternatively tap **Locate me**. This requests one location reading with permission. HTTPS is required on phones; localhost is allowed. Plain HTTP LAN links support manual search. Accuracy must be ≤100 m and a mapped road within 75 m; outside coverage or denied/timed-out readings fall back to manual entry. Raw GPS is processed locally and discarded; only the confirmed road/segment anchor is sent. Actual phone GPS permission/accuracy still needs device testing.
5. On the dashboard select **Safe Routes**, the same origin and **Phone/server simulation**. Catalogue revisions and current conditions match the resident source. Local replay remains separate. Personal pins are opt-in device drafts.
6. Raise D08 above its bank on `/control`: the Gamelan origin is flooded and the walking line disappears. Red/unknown roads never enter an evacuation route. Green-only paths win; amber is a warned fallback, and destination access must currently be green. A disconnected or flooded-only island reports failure honestly.
7. Choose another township on controller and resident. Its readings do not alter Bukit Raja. Open a newly shared area on a fresh phone tab to confirm the downloaded bundle is available without phone IndexedDB.
8. Send a fictional help request from a confirmed start. The anonymous request shares the road anchor with the demo guard desk. Change the route start: the existing request stays at its original location. Guard **On my way**, **Resolved** and resident cancellation use the same lifecycle. Only Bukit Raja has configured fictional guard posts; other townships show the request marker without inventing a responder route.
9. Leave a running controller without further ticks: guidance expires after six seconds. Paused/completed conditions are frozen only while route API requests remain reachable; offline responses withdraw guidance independently of help tracking.

## Verification commands

Use Node ≥22.18. Run `npm run lint`, `npm test`, `npm run build`, then inspect the browser. Unit fixtures cover replay dryness, selection determinism, disconnected coverage, snapping, area isolation, catalogue evidence, expiry, access closure and exact responder anchors.

Against a running local demo, `node scripts/check-evacuation-http.mjs http://localhost:3000` checks legacy compatibility, cache/errors, controller expiry and partial observations. `node scripts/check-location-http.mjs http://localhost:3000` checks built-in sharing, area isolation, location routes and anonymous help/guard transitions. They change demo readings, restore paused zero readings and finish their help tasks. Run the location script with `--with-test-township` **only on a disposable server process**: it adds a temporary cloned township that disappears on process restart. No external map/provider calls are needed by these harnesses.

Physical-phone GPS, installation, vibration, standalone mode and real-world pedestrian access are separate checks; do not imply they passed from a desktop browser run.

## Pitch wording

“Residents choose a starting road or confirm a one-shot location reading. The system selects road points that stay unflooded in the baseline simulation and routes around current simulated flooding. These are not verified shelters. Drain zones and street depths are simulated, not hydraulics. Routes do not forecast a journey or verify pedestrian access, and some mapped components have no reachable point. Anonymous assistance requests go to a demo guard desk. Operational use needs verified centres, live road observations, connected pedestrian data, authenticated access and durable service.”
