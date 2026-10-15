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

## Data and services

| Name | Used for | Licence / terms | Attribution |
|---|---|---|---|
| OpenStreetMap (via Overpass API) | streets + buildings of Bandar Bukit Raja | ODbL 1.0 | "© OpenStreetMap contributors" — shown on the map |
| OpenFreeMap | base map tiles + style (positron) | free, no key; tiles built from OSM (ODbL) with the OpenMapTiles schema | shown on the map |
| Open-Meteo Elevation API | ground height of each drain zone (baked once into `drains.json`) | data CC BY 4.0; underlying DEM: Copernicus GLO-90. ⚠️ Open-Meteo's free API is for non-commercial use — fine for a prototype; production → their commercial plan or the Copernicus DEM directly | footer + this file |
| Storm | rainfall pattern | synthetic, made by us (`lib/engine/storm.ts`) — replace with a recorded storm and add its source here | — |

## To add in Step B
- Agent skills copied into `.claude/skills/` — repo, commit SHA, licence, "modified" note if changed.
- Supabase (hosted service, free plan) — terms of service.
