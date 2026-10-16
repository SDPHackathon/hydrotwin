# AI-use log

SDP Hackathon T&C cl. 13: material use of AI tools must be declared, and SDP may ask for details. One line per working session — keep it honest and short. This log feeds the AI disclosure in the README and the pitch deck.

| Date | Who | Tool | What for | Which part |
|---|---|---|---|---|
| 2026-10-15 | Azim | Claude Code (Anthropic) | Repo setup: structure, agent rules, data script, engine + tests, dashboard map, database schema, docs | Whole repo at the first commit |
| 2026-10-16 | Danish | Antigravity (Gemini 3.8 Flash) | Environment verification, test suite fix for Node on Windows, Supabase connection, schema & seed execution, parameterized data pipeline, dynamic multi-township selector (Taman Sri Muda), on-demand township downloader with Nominatim geocoding/drawing & IndexedDB local persistence | Step B setup, database initialization, and on-demand dynamic township architecture |
| 2026-10-16 | Danish | Antigravity (Gemini 3.8 Pro) | Implemented Step D (Plan Mode): intervention types, pure engine plan calculations & replayStorm, unit tests, 3D MapLibre intervention layers (ponds, green areas, culverts), interactive Before/After delta scorecard, scenario saving, and ESLint React 19 compliance | lib/engine/plan.ts, tests/plan.test.ts, components/Dashboard.tsx, components/TownshipMap.tsx |
| 2026-10-16 | Danish | Antigravity (Gemini 3.8 Pro) | Implemented Steps B, C, and E: Mobile Phone Control page (`/control`), Resident Early Warning Portal (`/resident`), Guard Incident Desk (`/guard`), Server Risk Engine API (`/api/risk-engine`), Fictional resident seed dataset, and Dijkstra safe evacuation router (`lib/engine/route.ts`) with 3D map emerald route overlay | app/control, app/resident, app/guard, app/api/*, lib/engine/route.ts, tests/route.test.ts, components/Dashboard.tsx |
| 2026-10-16 | Azim | Claude Code (Anthropic) | Review of the 16 Oct commit (build, tests, pages, Supabase policies); vetted skills copied from the vendor repos into `.claude/skills/` + their rows in `docs/third-party.md` | `.claude/skills/`, docs |
