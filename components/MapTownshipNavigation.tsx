"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import "./MapTownshipNavigation.css";

type Township = { slug: string; name: string; custom?: boolean };
const PREVIEWS = ["/images/navigation/plan.jpg", "/images/navigation/route.jpg", "/images/navigation/live.jpg"];
// Real photographs of the bundled townships (Wikimedia Commons, credited on the card and in
// docs/third-party.md). A township without one, e.g. a newly downloaded area, uses the generic previews.
const PHOTOS: Record<string, { src: string; credit: string }> = {
  "bukit-raja": { src: "/images/townships/bukit-raja.jpg", credit: "Photo: *angys*, CC BY-SA 4.0, via Wikimedia Commons" },
  "cyberjaya-selangor": { src: "/images/townships/cyberjaya-selangor.jpg", credit: "Photo: Vimobe, CC BY-SA 4.0, via Wikimedia Commons" },
  "taman-sri-muda": { src: "/images/townships/taman-sri-muda.jpg", credit: "Photo: *angys*, CC BY-SA 4.0, via Wikimedia Commons" },
  "universiti-teknikal-malaysia-melaka-jalan-simpang-gading-kesang-pajak": {
    src: "/images/townships/universiti-teknikal-malaysia-melaka-jalan-simpang-gading-kesang-pajak.jpg",
    credit: "Photo: Jeluang Terluang, CC BY-SA 4.0, via Wikimedia Commons",
  },
};
const SOURCES = [...Object.values(PHOTOS).map((photo) => photo.src), ...PREVIEWS];

export default function MapTownshipNavigation({ current, townships, onSelect, onDownload }: {
  current: Township;
  townships: Township[];
  onSelect: (slug: string) => void;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(current.slug);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const options = townships.some(item => item.slug === current.slug) ? townships : [current, ...townships];
  const previewIndex = Math.max(0, options.findIndex(item => item.slug === preview));
  const previewTownship = options[previewIndex];
  const photo = PHOTOS[previewTownship.slug];
  const activeSrc = photo?.src ?? PREVIEWS[previewIndex % PREVIEWS.length];

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

  const close = () => { setOpen(false); toggle.current?.focus(); };
  return <div ref={root} className="map-mode-shell" data-open={open} onClick={() => { if (!open) { setPreview(current.slug); setOpen(true); } }}>
    <div className="map-mode-header">
      <svg className="map-mode-mark" width="24" height="28" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1C10 5 2 12 2 17a10 10 0 0 0 20 0C22 12 14 5 12 1Z" fill="#047857" /><path d="M6 18c0 3 2 5 5 5" fill="none" stroke="#ecfdf5" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <div className="township-menu-heading"><span>Township location</span><strong title={current.name}>{current.name}</strong></div>
      <button ref={toggle} type="button" className="map-mode-toggle" aria-label={open ? "Close township selection" : `Choose township: ${current.name}`} aria-expanded={open} aria-controls={id} onClick={event => { event.stopPropagation(); if (!open) setPreview(current.slug); setOpen(!open); }}><span /><span /></button>
    </div>
    <div id={id} className="map-mode-content" inert={!open} aria-hidden={!open}>
      <div className="township-menu-options">
        <nav className="map-mode-links" aria-label="Township locations">
          {options.map((item, index) => <button key={item.slug} type="button" className="map-mode-link township-menu-link" style={{ transitionDelay: open ? `${100 + Math.min(index, 5) * 50}ms` : "0ms" }} aria-pressed={current.slug === item.slug} onMouseEnter={() => setPreview(item.slug)} onFocus={() => setPreview(item.slug)} onClick={() => { close(); if (current.slug !== item.slug) onSelect(item.slug); }}>
            <span className="map-mode-dash" aria-hidden="true">—</span><span className="township-menu-name"><span>{item.name.split(",")[0]}</span><small>{item.custom ? "Downloaded township" : item.name.split(",").slice(1).join(",").trim() || "Included township"}</small></span><span className="map-mode-current" aria-hidden="true" />
          </button>)}
        </nav>
        <button type="button" className="township-menu-download" onClick={() => { close(); onDownload(); }}>+ Download a new township <span aria-hidden="true">↗</span></button>
      </div>
      <div className="map-mode-preview">
        {SOURCES.map((src) => <Image key={src} src={src} alt="" fill sizes="(max-width: 600px) 1px, 340px" className="map-mode-image" data-active={src === activeSrc} />)}
        <div className="township-menu-caption">
          {photo ? <><strong>{previewTownship.name.split(",")[0]}</strong><small className="township-menu-credit">{photo.credit}</small></>
            : <><span>Illustrative preview</span><strong>{previewTownship.name}</strong></>}
        </div>
      </div>
    </div>
  </div>;
}
