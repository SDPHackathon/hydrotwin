"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import "./MapModeNavigation.css";

type Mode = "live" | "plan" | "route";
const MODES: { id: Mode; label: string; image: string; alt: string }[] = [
  { id: "live", label: "Live Warning", image: "/images/navigation/live.jpg", alt: "Clouds gathering across the sky" },
  { id: "plan", label: "Plan Mode", image: "/images/navigation/plan.jpg", alt: "A city street framed by tall buildings" },
  { id: "route", label: "Safe Routes", image: "/images/navigation/route.jpg", alt: "An open road winding through red mountains" },
];

export default function MapModeNavigation({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Mode>(mode);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div ref={root} className="map-mode-shell" data-open={open} onClick={() => { if (!open) { setPreview(mode); setOpen(true); } }}>
    <div className="map-mode-header">
      <svg className="map-mode-mark" width="24" height="28" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1C10 5 2 12 2 17a10 10 0 0 0 20 0C22 12 14 5 12 1Z" fill="#047857" /><path d="M6 18c0 3 2 5 5 5" fill="none" stroke="#ecfdf5" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <button ref={toggle} type="button" className="map-mode-toggle" aria-label={open ? "Close mode navigation" : "Open mode navigation"} aria-expanded={open} aria-controls={id} onClick={event => { event.stopPropagation(); if (!open) setPreview(mode); setOpen(!open); }}>
        <span /><span />
      </button>
    </div>
    <div id={id} className="map-mode-content" inert={!open} aria-hidden={!open}>
      <nav className="map-mode-links" aria-label="Dashboard modes">
        {MODES.map((item, index) => <button key={item.id} type="button" className="map-mode-link" style={{ transitionDelay: open ? `${100 + index * 65}ms` : "0ms" }} aria-pressed={mode === item.id} onMouseEnter={() => setPreview(item.id)} onFocus={() => setPreview(item.id)} onClick={() => { onChange(item.id); setOpen(false); toggle.current?.focus(); }}>
          <span className="map-mode-dash" aria-hidden="true">—</span><span>{item.label}</span><span className="map-mode-current" aria-hidden="true" />
        </button>)}
      </nav>
      <div className="map-mode-preview">
        {MODES.map(item => <Image key={item.id} src={item.image} alt={item.alt} fill sizes="(max-width: 600px) 40vw, 310px" className="map-mode-image" data-active={preview === item.id} aria-hidden={preview !== item.id} />)}
      </div>
    </div>
  </div>;
}
