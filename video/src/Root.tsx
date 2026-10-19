import React from "react";
import { Composition, Series } from "remotion";
import { S01ColdOpen, S01_DURATION } from "./scenes/S01ColdOpen";
import { FPS, H, W } from "./tokens";

// One composition per scene (fast to preview on its own) + the full film.
// Scenes follow docs/video-storyboard.md.
const scenes = [{ id: "S01-ColdOpen", component: S01ColdOpen, duration: S01_DURATION }];

const Film: React.FC = () => (
  <Series>
    {scenes.map((s) => (
      <Series.Sequence key={s.id} durationInFrames={s.duration}>
        <s.component />
      </Series.Sequence>
    ))}
  </Series>
);

export const Root: React.FC = () => (
  <>
    <Composition
      id="HydroTwin"
      component={Film}
      durationInFrames={scenes.reduce((t, s) => t + s.duration, 0)}
      fps={FPS}
      width={W}
      height={H}
    />
    {scenes.map((s) => (
      <Composition key={s.id} id={s.id} component={s.component} durationInFrames={s.duration} fps={FPS} width={W} height={H} />
    ))}
  </>
);
