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
- **Backend**: Supabase (Postgres, Realtime, Auth, Edge Functions).

## On a phone — resident, guard, control

The laptop running `npm run dev` **is** the server. Put the phone on the same Wi-Fi and open
`http://<laptop-ip>:3000/resident`, `/guard` or `/control` (`ipconfig getifaddr en0` on macOS, `ipconfig` on
Windows gives the IP; the dashboard's **📱 Phone Links** button lists the paths). **Add to Home Screen** installs
each page as an app icon — iPhone: Share → Add to Home Screen (opens full-screen); Android: ⋮ → Add to Home
screen (full-screen needs HTTPS, so over the Wi-Fi link it opens as a shortcut). Alerts work while the page is
open: the guard desk sounds new help calls after one tap on **Start shift**, Android phones vibrate. The phone
pages are Bukit Raja only.

**Call for help, two-way.** A resident taps *I need help*, says what for and for how many, and then watches
the task live: sent → *Guard Rahim is on the way* → resolved. The guard desk shows the ask and how long it has
waited, and **Route** draws the way from the nearest guard post — dry roads first, the stretch through water
measured and dashed (`lib/engine/help.ts`; rules in [`docs/data-contracts.md`](docs/data-contracts.md)).

## What is simulated (and why)

**Plan → New development:** draw and finish a site, choose housing or commercial, and set before/after paved cover. The nearest mapped road and its Live Warning drain zone are suggested automatically; both can be changed manually. Compare existing, developed, and mitigated conditions; preview each on the map and save proposals to this browser. Select two saved proposals to compare any scenario stage under the same storm and current township data. Existing township-upgrade scenarios remain available under **Improve township**.

Development screening changes only one simulated drain zone. Zone area is estimated from its mapped street extent plus a 50 m margin on each side, not a measured watershed. Runoff coefficients (permeable 0.2, paved 0.9) and mitigation multipliers are demo assumptions. The rest of the zone is assumed to share the site's existing land-cover mix; site share is capped at 100%. The site outline is not a flood boundary: results describe existing streets in the receiving zone, not individual plots or downstream impacts. Map previews show separate zone peaks; the access check covers one selected road. This does not assess construction suitability. Older development proposals load and recalculate using the current model.

We have no access to real drain sensors, so drains are **simulated zones** of real streets; each zone's **ground height is real**. The storm is a 3-hour design storm. Water is shown as overflow depth along a zone's streets, not a hydraulic flow model. In a real township, off-the-shelf drain-level sensors would call the same risk engine.

## Data, licences and AI use

Safe Routes uses user-designated safe destinations saved per township on this device. Configure a destination street endpoint in Safe Routes, then use automatic nearest-reachable routing or select a destination. These points are unverified for real evacuation. Routes use current simulated street statuses, permit amber roads with a warning, and exclude red roads and roads with unknown status; they do not forecast conditions during travel.

- Third-party software and data: [`docs/third-party.md`](docs/third-party.md)
- AI disclosure (T&C cl. 13): [`docs/ai-use-log.md`](docs/ai-use-log.md)

## Team

*(names — add before submission)*

New development previews show moving teal arrows from the site to the selected receiving drain zone. The label marks this as an assumed runoff direction: the straight connection is schematic and does not model terrain gradients, pipe alignments or actual water velocity. Arrows remain static when reduced motion is enabled.
