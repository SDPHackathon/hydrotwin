"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Drain } from "@/lib/engine/types";
import type { SitePoint } from "@/lib/engine/development";

const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotion = () => true;

// A direct schematic connection to the simulated receiving zone, not a surveyed flow path.
export default function DevelopmentFlowOverlay({ map, boundary, drain }: { map: MapLibreMap; boundary: SitePoint[]; drain: Drain }) {
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, serverMotion);
  useEffect(() => {
    const project = () => {
      const center: [number, number] = [boundary.reduce((sum, p) => sum + p[0], 0) / boundary.length, boundary.reduce((sum, p) => sum + p[1], 0) / boundary.length];
      const start = map.project(center);
      const end = map.project([drain.lng, drain.lat]);
      setLine({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    };
    project();
    map.on("move", project);
    map.on("resize", project);
    return () => { map.off("move", project); map.off("resize", project); };
  }, [map, boundary, drain]);
  if (!line) return null;
  const { x1, y1, x2, y2 } = line;
  if (Math.hypot(x2 - x1, y2 - y1) < 24) return null;
  const path = `M ${x1} ${y1} L ${x2} ${y2}`;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" role="img" aria-label={`Assumed runoff direction from proposed site to receiving zone ${drain.id}. Schematic connection, not a surveyed water flow path.`}>
    <path d={path} fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" />
    <path d={path} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeDasharray="5 7" />
    {[0, 1, 2].map(index => <g key={index} transform={reduce ? `translate(${x1 + (x2 - x1) * (index + 1) / 4} ${y1 + (y2 - y1) * (index + 1) / 4}) rotate(${angle})` : undefined}>
      {!reduce && <animateMotion path={path} dur="3s" begin={`${-index}s`} repeatCount="indefinite" rotate="auto" />}
      <path d="M 8 0 L -5 -6 L -2 0 L -5 6 Z" fill="#0f766e" stroke="white" strokeWidth="2" strokeLinejoin="round" />
    </g>)}
    <g transform={`translate(${Math.max(96, Math.min(map.getCanvas().clientWidth - 96, (x1 + x2) / 2))},${Math.max(96, (y1 + y2) / 2 - 28)})`}>
      <rect x="-91" y="-18" width="182" height="39" rx="7" fill="white" stroke="#99f6e4" />
      <text textAnchor="middle" y="-2" fontSize="11" fontWeight="600" fill="#115e59">Assumed runoff → {drain.id}</text>
      <text textAnchor="middle" y="12" fontSize="9" fill="#57534e">Site to drain zone · indicative only</text>
    </g>
  </svg>;
}
