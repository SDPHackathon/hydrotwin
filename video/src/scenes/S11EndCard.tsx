import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Water } from "../components/Water";
import { fontFamily } from "../font";
import { appear } from "../lib/anim";
import { C, MARGIN, T, sec } from "../tokens";

// Scene 11 — end card. The water line returns, calm, at the bottom of the frame.

export const S11_DURATION = sec(16);

const TEAM = "Danish, Azim, Hurin, Amni, Ashwin";

export const S11EndCard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily, color: C.ink }}>
      <Water level={930} frame={f} opacity={0.35} />

      <div style={{ position: "absolute", left: MARGIN, top: 150, width: 1200 }}>
        <div style={{ fontSize: 144, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, opacity: appear(f, sec(0.4)) }}>HydroTwin</div>
        <div style={{ fontSize: T.caption, lineHeight: 1.25, marginTop: 26, maxWidth: 1000, opacity: appear(f, sec(1.2)) }}>
          Warn residents today. Plan a township that floods less tomorrow.
        </div>
        <div style={{ fontSize: 36, marginTop: 56, opacity: appear(f, sec(2.4)) }}>Team: {TEAM}</div>
        <div style={{ fontSize: 32, marginTop: 14, opacity: 0.75 * appear(f, sec(2.8)) }}>github.com/SDPHackathon/hydrotwin</div>
      </div>

      <div style={{ position: "absolute", left: MARGIN, top: 690, width: 1500, fontSize: 24, lineHeight: 1.5, opacity: 0.72 * appear(f, sec(4)) }}>
        <div>Prototype: drain sensors are simulated; water is a per-street depth, not a hydraulic model; residents and guards are fictional.</div>
        <div>Built with AI assistance (Claude Code, Antigravity, Codex), declared in docs/ai-use-log.md.</div>
        <div>
          Sources: The Star (5 June 2023; 14 Nov 2022); DOSM, Special Report on the Impact of Floods in Malaysia 2021. Map data © OpenStreetMap
          contributors.
        </div>
      </div>
    </AbsoluteFill>
  );
};
