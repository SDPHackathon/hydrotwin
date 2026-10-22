import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { drawTown } from "../../lib/township";
import { centroid } from "../../lib/geo";
import { Backdrop, Out, Rain, SANS, Voice, Words, clamp, cue, enter, fall, sceneFrames } from "../kit";
import { Callout } from "../frames";
import { GoldTown } from "../town";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 1 — 4 June 2023 in Bukit Raja, then what floods cost the country.
// Facts: The Star, 5 June 2023 (rain "for over two hours"; Phase 1, "especially the Jalan
// Makyong area, was badly hit") · DOSM, Special Report on the Impact of Floods 2021 (RM6.1 bn).
const ID = "v01";
export const V01_DURATION = sceneFrames(ID);

const town = drawTown({ x: 760, y: 70, w: 1100, h: 940 });
const makyong = town.streets.filter((s) => /makyong/i.test(s.name));
const mk = centroid(
  makyong.map((s) => s.line),
  town.project,
);

export const V01Flood: React.FC = () => {
  const f = useCurrentFrame();
  const tMakyong = cue(ID, "makyong");
  const tCost = cue(ID, "across");
  const tNumber = cue(ID, "six");

  // Slow push toward Phase 1 while the town draws.
  const push = interpolate(f, [0, tCost], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const s = 1 + 0.35 * push;
  const transform = `translate(${mk.x} ${mk.y}) scale(${s}) translate(${-mk.x} ${-mk.y})`;
  const toScreen = (p: { x: number; y: number }) => ({ x: mk.x + (p.x - mk.x) * s, y: mk.y + (p.y - mk.y) * s });
  const hot = interpolate(f, [tMakyong - 4, tMakyong + 10], [0, 1], clamp);
  const townOut = fall(f, tCost, 18);
  const pin = toScreen(mk);

  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop />
      <Out at={V01_DURATION - 16}>
      <Rain opacity={interpolate(f, [0, 20, tCost, tCost + 30], [0, 1, 1, 0.35], clamp)} />
      <AbsoluteFill style={{ opacity: 1 - townOut * 0.85 }}>
        <GoldTown town={town} drawAt={6} drawLen={80} buildings={0.16} transform={transform} focus={(st) => hot > 0 && /makyong/i.test(st.name)}>
          {makyong.map((st) => (
            <path key={st.id} d={st.d} fill="none" stroke={V.redLit} strokeOpacity={hot} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </GoldTown>
      </AbsoluteFill>
      <Callout at={tMakyong + 6} exitAt={tCost} x={pin.x - 420} y={pin.y - 120} tx={pin.x} ty={pin.y} tone={V.redLit}>
        Jalan Makyong
      </Callout>

      {/* The day */}
      <div style={{ position: "absolute", left: MARGIN, top: 330, width: 700 }}>
        <Words text="4 June 2023" at={12} exitAt={tCost - 6} style={{ fontSize: TY.display, lineHeight: 1 }} />
        <div style={{ ...enter(f, 30, tCost - 6), marginTop: 34, fontSize: TY.lead, lineHeight: 1.4, color: V.sage, maxWidth: 640 }}>
          Over two hours of rain flooded Phase 1 of Bandar Bukit Raja, Klang.
        </div>
      </div>

      {/* The country */}
      <div style={{ position: "absolute", left: MARGIN, top: 290, width: 1400 }}>
        <div style={{ ...enter(f, tCost + 4), fontSize: TY.lead, color: V.gold, fontWeight: 500 }}>Across Malaysia, 2021</div>
        <div style={{ ...enter(f, tNumber - 2), marginTop: 24, fontFamily: SERIF, fontSize: 210, lineHeight: 1, color: V.cream, letterSpacing: -2 }}>
          RM6.1 billion
        </div>
        <div style={{ ...enter(f, tNumber + 10), marginTop: 30, fontSize: TY.lead, color: V.sage }}>lost to floods</div>
      </div>

      <div style={{ position: "absolute", left: MARGIN, bottom: 150, fontSize: 20, color: V.sage, opacity: 0.75 * (1 - fall(f, tCost)) }}>
        Source: The Star, 5 June 2023
      </div>
      <div style={{ position: "absolute", left: MARGIN, bottom: 150, fontSize: 20, color: V.sage, opacity: 0.75 * (enter(f, tNumber + 14).opacity as number) }}>
        Source: DOSM, Special Report on the Impact of Floods in Malaysia 2021
      </div>
      </Out>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
