# HydroTwin pitch video

The 4-minute pitch video, written as code with [Remotion](https://www.remotion.dev) (React → MP4). The scene list and every caption live in [`docs/video-storyboard.md`](../docs/video-storyboard.md).

```bash
cd video
npm install
npm run studio     # preview with a timeline at http://localhost:3002
npm run render     # → out/hydrotwin.mp4
```

- `src/scenes/` — one file per storyboard scene; `src/Root.tsx` lines them up into the film.
- `src/tokens.ts` — colours (the app's flood-status colours mean status only), type sizes, timing helper.
- The map is drawn from the app's own OpenStreetMap extract (`public/data/bukit-raja`, copied in by `npm run data`) — credit "© OpenStreetMap contributors" stays on every map scene.
- Screen recordings of the app go in `public/rec/` (not committed — re-recorded by script).
- Licence: Remotion's Free License (see `docs/third-party.md`). Don't pass a licence key — without one Remotion sends no usage events.
