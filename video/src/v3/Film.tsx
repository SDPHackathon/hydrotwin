import React from "react";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { zoomThrough } from "./frames";
import { V01Flood, V01_DURATION } from "./scenes/V01Flood";
import { V02Problem, V02_DURATION } from "./scenes/V02Problem";
import { V03Title, V03_DURATION } from "./scenes/V03Title";
import { V04HowItWorks, V04_DURATION } from "./scenes/V04HowItWorks";
import { V05Dashboard, V05_DURATION } from "./scenes/V05Dashboard";
import { V06Resident, V06_DURATION } from "./scenes/V06Resident";
import { V07Help, V07_DURATION } from "./scenes/V07Help";
import { V08Plan, V08_DURATION } from "./scenes/V08Plan";
import { V09Next, V09_DURATION } from "./scenes/V09Next";
import { V10End, V10_DURATION } from "./scenes/V10End";
import { Music } from "./music";

// The v3 film: scenes in the deck's order, each cut to its voice-over line.
// Three transitions only: fade between motion scenes, slide-up into the product, and the
// zoom-through at the two act breaks (problem → HydroTwin, tonight → tomorrow).
type Cut = "fade" | "slide" | "zoom";
export const SCENES_V3: { id: string; component: React.FC; duration: number; cut?: Cut }[] = [
  { id: "V01-Flood", component: V01Flood, duration: V01_DURATION, cut: "fade" },
  { id: "V02-Problem", component: V02Problem, duration: V02_DURATION, cut: "zoom" },
  { id: "V03-Title", component: V03Title, duration: V03_DURATION, cut: "fade" },
  { id: "V04-HowItWorks", component: V04HowItWorks, duration: V04_DURATION, cut: "slide" },
  { id: "V05-Dashboard", component: V05Dashboard, duration: V05_DURATION, cut: "slide" },
  { id: "V06-Resident", component: V06Resident, duration: V06_DURATION, cut: "fade" },
  { id: "V07-Help", component: V07Help, duration: V07_DURATION, cut: "zoom" },
  { id: "V08-Plan", component: V08Plan, duration: V08_DURATION, cut: "fade" },
  { id: "V09-Next", component: V09Next, duration: V09_DURATION, cut: "fade" },
  { id: "V10-End", component: V10End, duration: V10_DURATION },
];
const CUT_FRAMES: Record<Cut, number> = { fade: 14, slide: 20, zoom: 24 };

export const FILM_V3_FRAMES = SCENES_V3.reduce((n, s) => n + s.duration - (s.cut ? CUT_FRAMES[s.cut] : 0), 0);

// Where each scene starts in the film (frames), for the soundtrack.
export const SCENE_START: Record<string, number> = {};
SCENES_V3.reduce((t, s) => {
  SCENE_START[s.id] = t;
  return t + s.duration - (s.cut ? CUT_FRAMES[s.cut] : 0);
}, 0);

export const FilmV3: React.FC = () => (
  <>
    <TransitionSeries>
      {SCENES_V3.flatMap((s) => {
        const out = [
          <TransitionSeries.Sequence key={s.id} durationInFrames={s.duration}>
            <s.component />
          </TransitionSeries.Sequence>,
        ];
        if (s.cut === "zoom")
          out.push(<TransitionSeries.Transition key={`${s.id}-cut`} timing={linearTiming({ durationInFrames: CUT_FRAMES.zoom })} presentation={zoomThrough()} />);
        else if (s.cut === "slide")
          out.push(
            <TransitionSeries.Transition
              key={`${s.id}-cut`}
              timing={springTiming({ config: { damping: 200 }, durationInFrames: CUT_FRAMES.slide })}
              presentation={slide({ direction: "from-bottom" })}
            />,
          );
        else if (s.cut === "fade")
          out.push(<TransitionSeries.Transition key={`${s.id}-cut`} timing={linearTiming({ durationInFrames: CUT_FRAMES.fade })} presentation={fade()} />);
        return out;
      })}
    </TransitionSeries>
    <Music start={SCENE_START} end={FILM_V3_FRAMES} />
  </>
);
