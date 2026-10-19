import React from "react";
import { Composition, Series } from "remotion";
import { S01ColdOpen, S01_DURATION } from "./scenes/S01ColdOpen";
import { S02Cost, S02_DURATION } from "./scenes/S02Cost";
import { S03Questions, S03_DURATION } from "./scenes/S03Questions";
import { S04Title, S04_DURATION } from "./scenes/S04Title";
import { S05HowItWorks, S05_DURATION } from "./scenes/S05HowItWorks";
import { FPS, H, W } from "./tokens";

// One composition per scene (fast to preview on its own) + the full film.
// Scenes follow docs/video-storyboard.md.
const scenes = [
  { id: "S01-ColdOpen", component: S01ColdOpen, duration: S01_DURATION },
  { id: "S02-Cost", component: S02Cost, duration: S02_DURATION },
  { id: "S03-Questions", component: S03Questions, duration: S03_DURATION },
  { id: "S04-Title", component: S04Title, duration: S04_DURATION },
  { id: "S05-HowItWorks", component: S05HowItWorks, duration: S05_DURATION },
];

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
