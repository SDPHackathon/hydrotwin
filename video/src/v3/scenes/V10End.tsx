import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { drawTown } from "../../lib/township";
import { Backdrop, SANS, Voice, clamp, enter, sceneFrames } from "../kit";
import { GoldTown } from "../town";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 10 — end card: name, line, team, repo, the honesty line (deck slide 10), AI and sources.
const ID = "v10";
export const V10_DURATION = sceneFrames(ID, 11); // long enough to read the names

// As on the deck's "Meet team pipol" slide (names only; no contact details in a public video).
const TEAM = [
  "Danish Syazwan bin Zaihairul, team leader",
  "Hurin Bisyri binti Nazri",
  "Muhamad Nurfitri Azim bin Ruzain",
  "Amni Nur Aqilah binti Rozwardi",
  "Ashwin a/l Yathipan",
];
const town = drawTown({ x: 980, y: 90, w: 860, h: 820 });

export const V10End: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop drift={9} />
      <AbsoluteFill style={{ opacity: interpolate(f, [0, 30], [0, 0.55], clamp) }}>
        <GoldTown town={town} drawAt={-100} buildings={0.12} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: MARGIN, top: 130, width: 900 }}>
        <div style={{ ...enter(f, 2), fontFamily: SERIF, fontSize: 120, lineHeight: 1, color: V.cream }}>HydroTwin</div>
        <div style={{ ...enter(f, 12), fontFamily: SERIF, fontSize: 46, lineHeight: 1.22, color: V.sageLight, marginTop: 24 }}>
          Warn residents today. Plan a township that floods less tomorrow.
        </div>
        <div style={{ ...enter(f, 28), marginTop: 44, fontFamily: SERIF, fontSize: 38, color: V.cream }}>Team pipol</div>
        <div style={{ ...enter(f, 32), marginTop: 6, fontSize: TY.label, color: V.sage }}>Universiti Teknikal Malaysia Melaka (UTeM)</div>
        <div style={{ marginTop: 22 }}>
          {TEAM.map((name, i) => (
            <div key={name} style={{ ...enter(f, 38 + i * 4, undefined, 14), fontSize: TY.label, lineHeight: 1.55, color: V.cream }}>
              {name}
            </div>
          ))}
        </div>
        <div style={{ ...enter(f, 62), marginTop: 26, display: "flex", alignItems: "center", gap: 22 }}>
          <Img src={staticFile("v3/sdp-logo.png")} style={{ height: 76 }} />
          <div>
            <div style={{ fontSize: TY.small, color: V.sage }}>SDP University Hackathon 2026, Planet track</div>
            <div style={{ marginTop: 6, fontSize: TY.small, color: V.gold }}>github.com/SDPHackathon/hydrotwin</div>
          </div>
        </div>
      </div>
      <div style={{ ...enter(f, 72), position: "absolute", left: MARGIN, bottom: 60, width: 1680, fontSize: 20, lineHeight: 1.5, color: V.sage }}>
        Simulated drain zones and street depth; operational use requires field validation. Residents and guards in the demo are fictional.
        <br />
        Voice-over generated with ElevenLabs, background image with ChatGPT; AI-assisted development is logged in the repository. Map data © OpenStreetMap contributors (ODbL), elevation
        Open-Meteo, base map OpenFreeMap / OpenMapTiles. Sources: The Star, 5 June 2023; DOSM 2021.
      </div>
      <Voice id={ID} captions={false} />
    </AbsoluteFill>
  );
};
