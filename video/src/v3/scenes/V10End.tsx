import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { drawTown } from "../../lib/township";
import { Backdrop, SANS, Voice, clamp, enter, sceneFrames } from "../kit";
import { GoldTown } from "../town";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 10 — end card: name, line, team, repo, the honesty line (deck slide 10), AI and sources.
const ID = "v10";
export const V10_DURATION = sceneFrames(ID, 9);

const TEAM = "Danish, Hurin, Amni, Ashwin, Azim"; // full names to come from the team
const town = drawTown({ x: 980, y: 90, w: 860, h: 820 });

export const V10End: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop drift={9} />
      <AbsoluteFill style={{ opacity: interpolate(f, [0, 30], [0, 0.55], clamp) }}>
        <GoldTown town={town} drawAt={-100} buildings={0.12} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: MARGIN, top: 200, width: 900 }}>
        <div style={{ ...enter(f, 2), fontFamily: SERIF, fontSize: 130, lineHeight: 1, color: V.cream }}>HydroTwin</div>
        <div style={{ ...enter(f, 12), fontFamily: SERIF, fontSize: 50, lineHeight: 1.22, color: V.sageLight, marginTop: 28 }}>
          Warn residents today. Plan a township that floods less tomorrow.
        </div>
        <div style={{ ...enter(f, 30), marginTop: 56, fontSize: TY.lead, color: V.cream }}>{TEAM}</div>
        <div style={{ ...enter(f, 36), marginTop: 10, fontSize: TY.label, color: V.sage }}>SDP University Hackathon 2026, Planet track</div>
        <div style={{ ...enter(f, 42), marginTop: 10, fontSize: TY.label, color: V.gold }}>github.com/SDPHackathon/hydrotwin</div>
      </div>
      <div style={{ ...enter(f, 50), position: "absolute", left: MARGIN, bottom: 70, width: 1680, fontSize: 21, lineHeight: 1.5, color: V.sage }}>
        Simulated drain zones and street depth; operational use requires field validation. Residents and guards in the demo are fictional.
        <br />
        Voice-over generated with ElevenLabs, background image with ChatGPT; AI-assisted development is logged in the repository. Map data © OpenStreetMap contributors (ODbL), elevation
        Open-Meteo, base map OpenFreeMap / OpenMapTiles. Sources: The Star, 5 June 2023; DOSM 2021.
      </div>
      <Voice id={ID} captions={false} />
    </AbsoluteFill>
  );
};
