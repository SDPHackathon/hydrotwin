# HydroTwin

> **Warn residents today. Plan a township that floods less tomorrow.**

SDP University Hackathon 2026 — *Township of Tomorrow* · Track: **Planet — climate resilience**

HydroTwin is a digital twin of a township's drains. During a storm it turns drain-level readings into a street-by-street flood warning with time-to-flood, alerts the residents who need to act, and gives guards a check-list of vulnerable residents. Between storms, planners test fixes — a bigger drain, a retention pond, a green area — against the same storm and see the difference before they build.

**Demo video:** *(link — before 23 Oct)*

## Run it locally

Needs Node.js 22.18 or newer.

```bash
npm install
npm run dev          # → http://localhost:3000 — press "Start storm"
npm test             # engine tests
```

The township data is already in `public/data/bukit-raja/`; `npm run data` rebuilds it from OpenStreetMap.

## How it works

Switch between Live Warning, Plan Mode and Safe Routes using the compact icon tabs at the top of the sidebar. Mode changes briefly blur the map and panel before bringing the new view into focus. The township control centered above the map shows the current location and expands into a scrollable township list with stock preview photographs; hover or keyboard focus changes the preview. Escape or clicking outside closes it. Downloaded townships appear in the same list, and its download button opens the township downloader. On small screens the list fills the menu and previews are hidden. Replace `public/images/navigation/live.jpg`, `plan.jpg` and `route.jpg` with your own images using the same filenames; update credits in `docs/third-party.md` and the preview mapping in `components/MapTownshipNavigation.tsx` when replacing them.

```
drain sensors (simulated) → risk engine → street status → map · resident alerts · guard check-list
```

- **Risk engine** (`lib/engine/risk.ts`): red when a drain overflows; amber at 70 % full or when red is under 30 minutes away. Rules: [`docs/data-contracts.md`](docs/data-contracts.md).
- **Simulator** (`lib/engine/sim.ts`): each minute, level rises with rain × how low the ground is, and falls with the drain's outflow. Low-lying zones flood first.
- **Map**: MapLibre GL JS on OpenFreeMap, with OpenStreetMap streets and buildings.
- **Demo rain**: falling streaks over the map build and ease with the synthetic rainfall curve; replay speed adds a capped visual boost. The map label shows running/paused/draining/complete state, rainfall and speed. Pause freezes rain, reset clears it, and “Rain animation” hides particles without stopping the simulation; reduced motion uses a static cue. Web weather always follows the local dashboard storm. This is a screen-space visual effect, not physical rain or building occlusion. Rain ends at minute 150; replay continues to minute 210 for drainage. Traffic and development peak previews show no rain.
- **Backend**: Supabase (Postgres, Realtime, Auth, Edge Functions).

## On a phone — resident, guard, control

Click **Phone Links** on the dashboard to open `/phone?area=<selected-township>` in a new browser tab. This simple landing page offers **Resident**, **Storm Control** and **Guard**. Resident and Control keep the selected township; Guard opens the shared duty desk. The mobile pages no longer have cross-page links in their top bars. Use browser Back to return to the chooser. Existing direct links and installed shortcuts still work.

The resident page starts with **Use my location**, **Search streets across all demo areas**, or **Choose on map**. Residents confirm a mapped road point and its coverage boundary before conditions and routes load. Search spans the shared demo catalogue; no township choice is required. Map outlines show the planner's downloaded sections, not entire towns or official boundaries. Locations outside those sections, or without a loaded road within 75 m, remain unavailable; overlapping sections require a choice. Street-name matches use an approximate road point that can be adjusted on the map. With permission, one-shot GPS coordinates are sent in a request body to this app's server for coverage matching; they are not stored or sent to a geocoder. HTTPS is required for phone geolocation; street search and map selection also work over the local HTTP link.

When a resident route is available, **Open in Google Maps** opens walking directions between the same selected road anchors. Google calculates its own path without HydroTwin's simulated flood restrictions, so it may differ from the route shown here. The link disappears when HydroTwin withdraws the route. Endpoints are shared only when the resident taps the link; no API key or embedded Google map is used.

The laptop running `npm run dev` **is** the server. Put the phone on the same Wi-Fi and open
`http://<laptop-ip>:3000/phone` (`ipconfig getifaddr en0` on macOS, `ipconfig` on
Windows gives the IP; add `?area=<township-slug>` to keep a specific township). **Add to Home Screen** installs
each page as an app icon — iPhone: Share → Add to Home Screen (opens full-screen); Android: ⋮ → Add to Home
screen (full-screen needs HTTPS, so over the Wi-Fi link it opens as a shortcut). Alerts work while the page is
open: the guard desk sounds new help calls after one tap on **Start shift**, Android phones vibrate.
Resident and Control pages use the selected shared township; Guard shows the combined demo help desk.

**Call for help, two-way.** A resident taps *I need help*, says what for and for how many, and then watches
the task live: sent → *Guard Rahim is on the way* → resolved. The guard desk shows the ask and how long it has
waited, and **Route** draws the way from the nearest guard post — dry roads first, the stretch through water
measured and dashed (`lib/engine/help.ts`; rules in [`docs/data-contracts.md`](docs/data-contracts.md)).

## What is simulated (and why)

**Plan → New development:** draw and finish a site, choose housing or commercial, and set before/after paved cover. The nearest mapped road and its Live Warning drain zone are suggested automatically; both can be changed manually. Compare existing, developed, and mitigated conditions; preview each on the map and save proposals to this browser. Select two saved proposals to compare any scenario stage under the same storm and current township data. Existing township-upgrade scenarios remain available under **Improve township**.

Development screening changes only one simulated drain zone. Zone area is estimated from its mapped street extent plus a 50 m margin on each side, not a measured watershed. Runoff coefficients (permeable 0.2, paved 0.9) and mitigation multipliers are demo assumptions. The rest of the zone is assumed to share the site's existing land-cover mix; site share is capped at 100%. The site outline is not a flood boundary: results describe existing streets in the receiving zone, not individual plots or downstream impacts. Map previews show separate zone peaks; the access check covers one selected road. This does not assess construction suitability. Older development proposals load and recalculate using the current model.

We have no access to real drain sensors, so drains are **simulated zones** of real streets; each zone's **ground height is real**. The storm is a 3-hour design storm. Water is shown as overflow depth along a zone's streets, not a hydraulic flow model. In a real township, off-the-shelf drain-level sensors would call the same risk engine.

## Data, licences and AI use

Safe Routes and `/resident` automatically derive **demo dry road points** for each shared township. A deterministic algorithm replays the baseline 210-minute storm, excludes every zone that becomes red, and chooses spaced anchors on actual mapped roads. Built-in and previously downloaded townships use the same calculation as new downloads; no AI API, hand-picked refuge list, or new shelter feed is required. Routes prefer green-only roads, fall back to amber with a warning, exclude red/unknown streets and require green destination access. A flooded origin never produces a walking line. The web dashboard always uses its own local simulation for map conditions, storm controls and Safe Routes. Phone pages use the separate shared phone/server simulation; the web storm does not change their readings.

The resident portal uses **Locate me** (one-shot permission, HTTPS required except localhost) or street-name/road-ID suggestions. Manual search uses an approximate street endpoint; location readings snap to the nearest road within 75 m and require confirmation. Raw GPS coordinates are not sent or stored; routing uses the confirmed street/segment anchor. Full house-address search and journey tracking are not provided. These points stayed unflooded only in the baseline simulation: they are **not verified shelters**, and pedestrian/wheelchair access is unverified. Disconnected or flooded-only components can have no reachable point.

Downloaded areas are shared from the laptop dashboard to a bounded, process-local demo registry. Previously cached downloads republish when the dashboard opens. After a server restart, reopen the dashboard to share custom areas again. Each township has separate simulator evidence; initial conditions remain unknown until readings or reset. Offline/stale conditions withdraw guidance. Location help shares the confirmed road anchor explicitly with the demo guard desk and remains independent of route availability. Help sessions are anonymous, process-local, last at most 24 hours without an update, and are not written into the fictional-resident database tables. Personal destination pins remain opt-in device drafts.

Export the Bukit Raja catalogue with `npm run data:evacuation` without regenerating flood data. See [`docs/evacuation-demo.md`](docs/evacuation-demo.md) for validation and pitch wording.

- Third-party software and data: [`docs/third-party.md`](docs/third-party.md)
- AI disclosure (T&C cl. 13): [`docs/ai-use-log.md`](docs/ai-use-log.md)

## Team

*(names — add before submission)*

New development previews show moving teal arrows from the site to the selected receiving drain zone. The label marks this as an assumed runoff direction: the straight connection is schematic and does not model terrain gradients, pipe alignments or actual water velocity. Arrows remain static when reduced motion is enabled.
## Traffic workspace

Choose **Traffic** in the dashboard sidebar. Retain the MapLibre map, draw a proposed township, enter homes/floor area, accept or adjust its suggested road connection, then **Assess township impact**. Current traffic comes from TomTom on surrounding sampled corridors; compare **Current traffic / With township**, inspect roads receiving additional trips, and review actual observation coverage. No replay or synthetic background-demand setup is required. Bukit Raja has a prepared OSM network; other townships attempt online preparation.

Add `TOMTOM_TRAFFIC_API_KEY` to `.env.local` using a key from [MyTomTom](https://my.tomtom.com/) → API & SDK Keys, then restart the server. The key stays server-side. An assessment requests up to 24 traffic samples; refreshes are limited to once per 30 seconds per server process. Without a key or matched traffic, the app shows an unavailable/unknown state. Provider data stays in memory and expires after five minutes. Saved proposals contain inputs only.

The impact model adds assumed development trips to a speed-based traffic baseline using incremental assignment and a BPR-style congestion curve. Speeds are observed/provider-derived; existing vehicle volumes are inferred, capacities and trip rates remain assumptions, and destinations are suggested network connections rather than observed commute patterns. Grey roads lack matched data. Coverage is explicit, so the app does not equate missing data with uncongested roads. Historical peaks, detailed signals, upstream spillback and a calibrated regional transport assessment remain outside this screening model.

Prepare a separate offline traffic bundle with `node --experimental-strip-types scripts/prepare-traffic.mjs bukit-raja`; this does not regenerate flood data. If Turbopack's Windows compiler subprocess fails, `npm run build -- --webpack` uses the supported production fallback with the same Tailwind loader.
