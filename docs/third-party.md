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
| Remotion 4.0.533 (`remotion`, `@remotion/cli`, `@remotion/google-fonts`, `@remotion/transitions`) — `video/` only | pitch video: motion graphics rendered to MP4 | Remotion License — Free License tier (individuals; free for commercial video). A for-profit company with 4+ employees that runs this code itself needs a Remotion Company License. The rendered video is not restricted |
| Geist font (via `@remotion/google-fonts`) | pitch video type | SIL OFL 1.1 |
| "Heavy rain Thunder" by kanematsutei (Pixabay, sound effect 145345) — `video/public/audio/heavy-rain-thunder.mp3` | pitch video: rain + thunder under scenes 1–3 | Pixabay Content License — free, no attribution required; not Content ID registered (checked 19 Oct). https://pixabay.com/sound-effects/nature-heavy-rain-thunder-145345/ |
| "Ambient Cinematic" by ElectroAnimals (Pixabay, music 588276) — `video/public/audio/ambient-cinematic.mp3` | pitch video: music from 0:34 to the end | Pixabay Content License — free, no attribution required; not Content ID registered, not AI-generated (checked 20 Oct). https://pixabay.com/music/ambient-ambient-cinematic-588276/ |
| ElevenLabs text-to-speech API (model `eleven_multilingual_v2`, a premade voice) — `video/scripts/voice/tts.mjs` | pitch video v3: AI voice-over | ElevenLabs Starter plan (paid) — includes a commercial licence for audio generated while subscribed; the free plan has none. Key read from `~/.config/elevenlabs/api-key`, never in the repo. https://elevenlabs.io/terms-of-use |
| playwright-core 1.63.0 — `video/` only | drives the app to screen-record the demo scenes (no browser download; uses the installed Chrome) | Apache-2.0 |

## Data and services

| Name | Used for | Licence / terms | Attribution |
|---|---|---|---|
| User-supplied township landscape (`ChatGPT Image Oct 22, 2026, 11_46_03 PM.png`) | Background in the pipol live pitch presentation | User-supplied AI-generated asset, provided for use in this deck; no external photograph licence asserted | Credited as an AI-generated fictional landscape in slide notes. Agricultural Harvest contact sheet supplies design inspiration only. |
| Google Maps URLs | Optional external walking directions from the confirmed road anchor to the displayed demo destination | [Official Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), no API key; external use subject to [Google Maps / Google Earth Additional Terms](https://www.google.com/help/terms_maps/) | Google supplies attribution in its app/site. Endpoints are shared only on click; Google calculates its own route without HydroTwin flood restrictions. No Google tiles, SDK or routing API is embedded. |
| TomTom Traffic Flow Segment Data API | Current road speed/free-flow speed, travel time, closure flag and confidence for township-impact screening | Proprietary TomTom API content, subject to account entitlement, API terms and [terms](https://docs.tomtom.com/legal/terms-and-conditions); retrieved on demand, retained in browser memory only and treated as stale after 5 minutes | Traffic © TomTom in the workspace; [API reference](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/flow-segment-data). No Google data or map replacement. |
| OpenStreetMap official map API and Overpass | Independent directed traffic network; Bukit Raja artifact retrieved 19 Oct 2026 | ODbL 1.0; https://www.openstreetmap.org/copyright | © OpenStreetMap contributors · shown in Traffic footer; directions and attributes remain incomplete; demand/capacity are our stated assumptions |
| OpenStreetMap (via Overpass API) | streets + buildings of Bandar Bukit Raja | ODbL 1.0 | "© OpenStreetMap contributors" — shown on the map (dashboard), under the route map (guard page) and on every map scene of the pitch video |
| OpenFreeMap | base map tiles + style (positron) | free, no key; tiles built from OSM (ODbL) with the OpenMapTiles schema | shown on the map (dashboard) and under the route map (guard page) |
| Open-Meteo Elevation API | ground height of each drain zone (baked once into `drains.json`) | data CC BY 4.0; underlying DEM: Copernicus GLO-90. ⚠️ Open-Meteo's free API is for non-commercial use — fine for a prototype; production → their commercial plan or the Copernicus DEM directly | footer + this file |
| OpenStreetMap Nominatim | Geocoding search for dynamic township addition | ODbL 1.0 / Nominatim Usage Policy (max 1 req/sec, custom User-Agent) | "© OpenStreetMap contributors" |
| Storm | rainfall pattern | synthetic, made by us (`lib/engine/storm.ts`) — replace with a recorded storm and add its source here | — |
| HydroTwin demo dry-point model | Deterministic baseline-storm selection of road anchors for every shared township; no real shelter names or opening claims | Original project algorithm/results; road anchors derived from existing OSM bundles under ODbL 1.0 | Simulation-only labels in dashboard/resident portal; © OpenStreetMap contributors. No new service or library. |
| Browser Geolocation API | One-shot Locate me, processed locally and confirmed as a road anchor; no GPS storage | Browser-provided W3C API, https://www.w3.org/TR/geolocation/ ; no new geocoding dataset/SDK | Browser permission and secure context required; manual street search stays available. |

## Navigation preview photographs (temporary stock assets)

Local files in `public/images/navigation/`, replaceable without changing the navigation component. Illustrative stock photographs, not township data, from Unsplash's public image CDN under the [Unsplash License](https://unsplash.com/license).

| File | Photographer / source | Licence |
|---|---|---|
| `live.jpg` | [Clouds · photo-1534088568595-a066f410bcda](https://images.unsplash.com/photo-1534088568595-a066f410bcda) | Unsplash License |
| `plan.jpg` | [City street · photo-1449824913935-59a10b8d2000](https://images.unsplash.com/photo-1449824913935-59a10b8d2000) | Unsplash License |
| `route.jpg` | [Desert road · photo-1500530855697-b586d89ba3ee](https://images.unsplash.com/photo-1500530855697-b586d89ba3ee) | Unsplash License |

## Township photographs (switcher previews, 23 October 2026)

Local files in `public/images/townships/`, resized to 1200 px; one real photograph per bundled township, credited on the card itself. CC BY-SA requires attribution and a link to the licence; the images are unaltered apart from resizing (Cyberjaya: centre crop of the panorama).

| File | Photograph | Author | Licence |
|---|---|---|---|
| `bukit-raja.jpg` | [Bandar Bukit Raja from Setia Alam (230115)](https://commons.wikimedia.org/wiki/File:Bandar_Bukit_Raja_from_Setia_Alam_(230115).jpg) | \*angys\* | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `cyberjaya-selangor.jpg` | [Cyberjaya Aerial](https://commons.wikimedia.org/wiki/File:Cyberjaya_Aerial.jpg) | Vimobe | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `taman-sri-muda.jpg` | [Jalan Mewah 25 66 and Plaza Sri Muda (250318)](https://commons.wikimedia.org/wiki/File:Jalan_Mewah_25_66_and_Plaza_Sri_Muda_(250318).jpg) | \*angys\* | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `universiti-teknikal-malaysia-melaka-jalan-simpang-gading-kesang-pajak.jpg` | [Masjid Sayyidina Abu Bakar dari jauh (1)](https://commons.wikimedia.org/wiki/File:Masjid_Sayyidina_Abu_Bakar_dari_jauh_(1).jpg) (UTeM main campus) | Jeluang Terluang | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

## Hosted service terms

| Name | Used for | Terms |
|---|---|---|
| Supabase (free plan, project `hydrotwin`, Danish's org) | Postgres, Realtime, Auth | [Terms of Service](https://supabase.com/terms) · free plan = non-production, pauses after 7 days idle |
| Vercel (Hobby plan, project `hydrotwin` on Azim's account) — https://hydrotwin-sdp.vercel.app (also hydrotwin-three.vercel.app) | Public demo of the web app, deployed 23 Oct from `main` with the Vercel CLI; no environment variables (Local Sim, no Supabase service key) | [Terms of Service](https://vercel.com/legal/terms) · Hobby = personal, non-commercial use · server state is in memory, so the phone help loop is not reliable there — the live demo runs on the laptop |

## Agent skills (`.claude/skills/`, added 16 Oct)

Copied verbatim from the vendors' official repos, pinned to a commit, licence file in each folder. Full table + update procedure: `.claude/skills/README.md`.

| Skill | Source · commit | Licence | Modified? |
|---|---|---|---|
| `supabase` | supabase/agent-skills `c9be0e9` | MIT | yes — upstream "Skill Feedback" reference removed |
| `supabase-postgres-best-practices` | supabase/agent-skills `c9be0e9` | MIT | no |
| `vercel-react-best-practices` | vercel-labs/agent-skills `063bee9` | MIT (declared in SKILL.md; repo has no LICENSE file) | no |
| `maplibre-tile-sources` | maplibre/maplibre-agent-skills `76a1942` | MIT (+ NOTICE, Mapbox) | no |
| `maplibre-source-wiring` | maplibre/maplibre-agent-skills `76a1942` | MIT (+ NOTICE, Mapbox) | no |

## Pitch presentation assets (22 October 2026)

| Asset | Use | Origin / licence | Disclosure |
|---|---|---|---|
| Fictional township retention landscape | Background in the HydroTwin pitch deck | Original OpenAI-generated project illustration; no external photograph or dataset | AI-generated illustration credited in slide notes. User supplied the design reference; its image is not redistributed in the deck. |
| Sime Darby Property logo — `video/public/v3/sdp-logo.png` | Pitch video v3: title and end card, identifying the hackathon's organiser | Trademark of Sime Darby Property; file supplied by the team (Hurin) for this SDP hackathon submission; shown unaltered | Not used to imply endorsement of HydroTwin |
| Storm-township background — `video/public/v3/backdrop-storm.jpg` | Softly blurred background of the v3 pitch video (a fictional Malaysian terrace-house township under storm clouds) | Original image generated with ChatGPT (OpenAI) on 23 Oct 2026, the deck's landscape attached as a style reference; no external photograph or dataset | AI-generated; disclosed in docs/ai-use-log.md and on the video's end card |
| HydroTwin product screenshots | Dashboard, flood replay, planning comparison and resident route | Original app UI with existing OSM/OpenFreeMap/OpenMapTiles map data and Open-Meteo elevations under the licences already listed above | Map attribution remains visible and source credits appear in slide notes. |
