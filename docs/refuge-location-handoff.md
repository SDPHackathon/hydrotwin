# Algorithmic dry points and location-based resident flow — completed

Resumed and completed on 21 October 2026 after the user's “just continue”. Existing uncommitted work was preserved; no commit or deployment was made.

The approved flow is implemented: baseline-simulation dry road points for built-in and shared downloaded townships; current green access and green-first routing; no resident persona; Locate me/manual street hints with explicit road-anchor confirmation; anonymous location-based demo assistance that keeps its original location. No AI API or new dependency is needed. Points are simulation results, not verified shelters.

Validation: clean lint, 100 tests, TypeScript, production build, local HTTP harnesses, and production browser review. The browser covered manual routing, maps, flood withdrawal, guard resolution, origin changes, township switching, matching dashboard/resident sources, a new shared area on a fresh tab, EN/BM and deliberate API loss. The temporary production server and its test registry were stopped; the existing development server was preserved. No real GPS permission was granted and no fresh upstream township extraction was performed.

Current implementation details and known limits are maintained in [data-contracts.md](data-contracts.md), [evacuation-demo.md](evacuation-demo.md) and [progress.md](progress.md). Custom-township registry and anonymous help are process-local demo facilities. Reopen the dashboard after restart to reshare cached custom areas. Physical-phone GPS, installation/vibration, map-provider failure and operational verification remain future checks.
