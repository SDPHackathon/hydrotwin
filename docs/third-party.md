# Third-party software, data and services

SDP Hackathon T&C cl. 14: everything we use must be lawfully obtained and licensed, and SDP may ask for the licence. Add a row **before** you depend on something new.

## Software

| Name | Used for | Licence |
|---|---|---|
| Next.js, React | web app | MIT |
| Tailwind CSS | styling | MIT |
| MapLibre GL JS | 3D map rendering | BSD-3-Clause |
| supabase-js | database, realtime, auth client | MIT |
| Geist font (via `next/font`) | UI font | SIL OFL 1.1 |
| Remotion 4.0.533 (`remotion`, `@remotion/cli`, `@remotion/google-fonts`) — `video/` only | pitch video: motion graphics rendered to MP4 | Remotion License — Free License tier (individuals; free for commercial video). A for-profit company with 4+ employees that runs this code itself needs a Remotion Company License. The rendered video is not restricted |
| Geist font (via `@remotion/google-fonts`) | pitch video type | SIL OFL 1.1 |
| "Heavy rain Thunder" by kanematsutei (Pixabay, sound effect 145345) — `video/public/audio/heavy-rain-thunder.mp3` | pitch video: rain + thunder under scenes 1–3 | Pixabay Content License — free, no attribution required; not Content ID registered (checked 19 Oct). https://pixabay.com/sound-effects/nature-heavy-rain-thunder-145345/ |
| playwright-core 1.63.0 — `video/` only | drives the app to screen-record the demo scenes (no browser download; uses the installed Chrome) | Apache-2.0 |

## Data and services

| Name | Used for | Licence / terms | Attribution |
|---|---|---|---|
| OpenStreetMap (via Overpass API) | streets + buildings of Bandar Bukit Raja | ODbL 1.0 | "© OpenStreetMap contributors" — shown on the map (dashboard), under the route map (guard page) and on every map scene of the pitch video |
| OpenFreeMap | base map tiles + style (positron) | free, no key; tiles built from OSM (ODbL) with the OpenMapTiles schema | shown on the map (dashboard) and under the route map (guard page) |
| Open-Meteo Elevation API | ground height of each drain zone (baked once into `drains.json`) | data CC BY 4.0; underlying DEM: Copernicus GLO-90. ⚠️ Open-Meteo's free API is for non-commercial use — fine for a prototype; production → their commercial plan or the Copernicus DEM directly | footer + this file |
| OpenStreetMap Nominatim | Geocoding search for dynamic township addition | ODbL 1.0 / Nominatim Usage Policy (max 1 req/sec, custom User-Agent) | "© OpenStreetMap contributors" |
| Storm | rainfall pattern | synthetic, made by us (`lib/engine/storm.ts`) — replace with a recorded storm and add its source here | — |

## Hosted services

| Name | Used for | Terms |
|---|---|---|
| Supabase (free plan, project `hydrotwin`, Danish's org) | Postgres, Realtime, Auth | [Terms of Service](https://supabase.com/terms) · free plan = non-production, pauses after 7 days idle |

## Agent skills (`.claude/skills/`, added 16 Oct)

Copied verbatim from the vendors' official repos, pinned to a commit, licence file in each folder. Full table + update procedure: `.claude/skills/README.md`.

| Skill | Source · commit | Licence | Modified? |
|---|---|---|---|
| `supabase` | supabase/agent-skills `c9be0e9` | MIT | yes — upstream "Skill Feedback" reference removed |
| `supabase-postgres-best-practices` | supabase/agent-skills `c9be0e9` | MIT | no |
| `vercel-react-best-practices` | vercel-labs/agent-skills `063bee9` | MIT (declared in SKILL.md; repo has no LICENSE file) | no |
| `maplibre-tile-sources` | maplibre/maplibre-agent-skills `76a1942` | MIT (+ NOTICE, Mapbox) | no |
| `maplibre-source-wiring` | maplibre/maplibre-agent-skills `76a1942` | MIT (+ NOTICE, Mapbox) | no |
