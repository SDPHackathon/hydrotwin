# Demo storm rain on the map — implementation plan

Status: implemented 20 Oct 2026. Original plan prepared 19 Oct; validation results and remaining manual checks are recorded in `docs/progress.md`.

## Goal

Make an active demo storm immediately visible on the township map. Falling rain should build, peak and ease with the simulator's rainfall, and respond visibly to replay speed. Keep streets, drains, water depths, route markers and map controls readable.

## Findings from the current implementation

- `lib/useLocalStorm.ts` already exposes `minute`, `running`, `speed`, `finished` and `rainMmPerHour`. Local playback options are 1, 2 and 4 simulated minutes per real second.
- `lib/engine/storm.ts` supplies the authoritative synthetic rainfall curve: zero at minute 0, increasing to about 126 mm/h at minute 45, holding through minute 100, then tapering to zero at minute 150. The local replay continues until minute 210 to show drainage. Rain must stop at minute 150 even when replay continues.
- `components/TownshipMap.tsx` has a wrapper suitable for an overlay and already hosts `DevelopmentFlowOverlay.tsx`. It receives drain statuses, but currently no storm playback state.
- The phone's `/control` page sends `minute`, `running` and `speed`; `lib/server-state.ts` stores them and `/api/risk-engine` returns them. Dashboard polls every 1.5 seconds, but retains only cloud minute/running and still displays local rainfall. Phone speed options include 5 and 10.
- `/control` is tied to Bukit Raja. Its storm must not be presented as a synced storm over an unrelated township.
- Development screening displays each zone's independent peak, rather than a shared replay instant. Traffic has an independent workspace.

## Proposed experience

Use a transparent Canvas 2D overlay clipped to the map container. Draw subtle blue-grey falling streaks with a consistent slight slant and restrained variation in size and opacity. This is a screen-space rain effect over the map, not volumetric rain with building occlusion. No added dependency, downloaded image or weather service is needed.

Place a compact label inside the map, clear of navigation, attribution and other overlays. Example: **Demo storm running · 84 mm/h · Playback 2×**. It explicitly identifies synthetic weather and remains visible with animation disabled.

| State | Rain and label |
|---|---|
| Before start / reset | Clear map; small “Demo storm ready” label |
| Started at minute 0 | Immediately show “Demo storm running”; drops begin once the curve becomes positive |
| Rising / peak / easing rain | Increasing / maximum / decreasing density and motion based on current mm/h |
| Paused during rain | Freeze the current streaks; label “Demo storm paused” |
| Running after minute 150 | No drops; label “Rain ended · drains emptying” |
| Paused after rain ends | No drops; label “Demo replay paused · rain ended” |
| Replay complete | Clear rain; label “Demo storm complete” |
| Phone state loading / unavailable | No inferred local rain; show “Waiting for phone sync” / “Phone sync lost” |

Use the overlay in Live Warning, Safe Routes and timed Plan upgrade replays. Hide it for development peak-result previews and Traffic. Resolve source by workflow: Plan upgrade replay always uses its local replay; Live and Routes use the selected local/phone source. For a non-Bukit-Raja township, phone storm presentation is unavailable and must say why rather than draw Bukit Raja's rain there.

## Rain intensity and speed

Keep the two existing controls conceptually separate:

- **Rainfall intensity (mm/h)** determines particle density, streak length, opacity and a modest increase in falling speed. Normalize against the existing peak constant rather than duplicate 126 as a magic number. Zero rain always means zero particles.
- **Replay speed** determines the existing simulation clock and adds a modest, capped visual speed multiplier. For example, start with a square-root response capped at 2× visual speed, so 10× playback is perceptibly quicker without turning the map into a blur. Tune in browser.

These mappings are artistic display choices, not physical drop velocities or a new hydrological model. Changing playback speed must not increase rainfall values or alter engine outcomes for the same simulated minute. Smooth visual changes briefly while running; pause and reset must take effect immediately.

## Implementation sequence

1. **Unify the displayed storm state.** In `Dashboard.tsx`, derive one presentation object containing source, minute, running, speed, rainfall and phase. Read cloud speed from the existing API response and calculate cloud rainfall with `rainAt(cloudMinute)`. Use the same object for the map label and sidebar rainfall/clock/speed. Track successful sync time; after a proposed six seconds without a valid response, stop presenting the storm as actively synced. Preserve existing drain-status behavior without generating any statuses in the presentation layer.
2. **Ensure phone completion is observable.** In `app/control/page.tsx`, publish `running: false` when the replay naturally finishes; currently the final automatic stop changes local state only. Preserve explicit start/pause/reset/speed behavior. No new endpoint or database schema is required.
3. **Build the overlay.** Add `components/StormRainOverlay.tsx` with a small reusable particle pool, elapsed-time movement via `requestAnimationFrame`, and refs for per-frame values. Use `ResizeObserver`, cap device-pixel scaling and bound particle counts by viewport size. Keep browser APIs inside client effects. Avoid a DOM element per drop and React state updates per frame.
4. **Connect the map and label.** Add an optional storm presentation prop to `TownshipMap.tsx`; render the overlay within its existing wrapper. Keep it below map UI and above map imagery, with `pointer-events: none` and decorative canvas accessibility treatment. Keep the text label accessible without announcing every rainfall tick. Do not rebuild the MapLibre instance or reload GeoJSON for animation.
5. **Handle motion and lifecycle.** Honor reduced motion with a static rain cue and the same label. Provide a small “Rain animation” toggle so presenters can disable motion without pausing the storm. Stop rendering while the tab is hidden, clear immediately on reset, and release frames/observers/listeners on unmount or township/source/workflow changes. Resume from current authoritative playback state without advancing the engine independently.
6. **Verify and document.** Add focused tests for presentation mapping if extracted into a pure helper: zero rain, relative density/speed, caps, pause/complete, source selection and stale phone state. Run `npm run lint`, `npm test`, `npm run build` and inspect the browser as required by `AGENTS.md`. The progress log records a prior default-build issue; if it recurs, report it and distinguish any successful documented Webpack fallback from the default build. Update `docs/data-contracts.md` with presentation/sync semantics, `docs/progress.md`, `docs/ai-use-log.md` and README's synthetic-storm explanation. Add a third-party entry only if implementation introduces an external dependency or asset.

## Acceptance checks

- Starting a storm gives an immediate on-map indication, including the initial dry minute.
- Light, peak and easing rainfall look visibly different; equal rainfall at faster playback moves faster within the cap.
- Local 1/2/4 and phone 1/2/5/10 speeds work. Phone pause, speed, reset and natural completion update the map through the existing polling cadence.
- Sidebar and map show the same source, minute, rainfall, playback speed and run state. Missing/stale phone state never substitutes a local running storm.
- No rain falls after minute 150; flood-water drainage can continue until completion at minute 210.
- Pause freezes animation; reset clears it; switching townships or entering Traffic/development previews leaves no particles or orphaned animation loops.
- Zoom, pan, rotate, drain clicks, route picking and site drawing retain their existing behavior. Street status colours, labels, water depths, attribution and controls remain readable.
- Reduced motion and animation-off still communicate the storm state clearly.
- Check laptop and narrow layouts, repeated starts/resets/mode switches and background-tab return. Aim for a smooth 60 fps on the demo laptop; reduce particle budget on smaller/slower devices rather than degrade map interaction. Compare with animation disabled and check for console errors.
- Engine outputs remain identical with animation on or off. The UI continues to explain that storms/drain zones are simulated and street depths are not a hydraulic model.
