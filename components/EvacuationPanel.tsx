"use client";

import { useState } from "react";
import type { RouteDestination, RouteResult, StreetFeature } from "@/lib/engine/route";
import type { EvacuationCatalogue } from "@/lib/engine/evacuation";
import { ROUTE_MESSAGES } from "@/lib/evacuation/messages";

type Props = {
  catalogue: EvacuationCatalogue | null;
  catalogueError: string | null;
  usingDrafts: boolean;
  draftDestinations: RouteDestination[];
  onUseDrafts: (value: boolean) => void;
  streets: StreetFeature[];
  startStreetId: string;
  onStartChange: (id: string) => void;
  destinations: RouteDestination[];
  onDestinationsChange: (next: RouteDestination[]) => void;
  selectedDestinationId: string | null;
  onDestinationChange: (id: string | null) => void;
  result: RouteResult | null;
  saveError: boolean;
  pickMode: "origin" | "destination" | null;
  onPickModeChange: (mode: "origin" | "destination" | null) => void;
  pickMessage: string;
};

export default function EvacuationPanel(p: Props) {
  const [name, setName] = useState("");
  const [streetId, setStreetId] = useState(p.streets[0]?.properties.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const options = p.streets.map((s) => <option key={s.properties.id} value={s.properties.id}>
    {s.properties.name || "Residential Road"} ({s.properties.id}) · {s.properties.drain_id}
  </option>);
  const selectClass = "w-full rounded-lg border border-stone-300 bg-white p-2 text-xs text-stone-900";
  const saveDestinationName = (id: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;
    p.onDestinationsChange(p.draftDestinations.map((destination) => destination.id === id
      ? { ...destination, name: trimmedName }
      : destination));
    setEditingId(null);
    setEditingName("");
  };
  return <div className="flex flex-col gap-4 text-xs">
    <section className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <h2 className="font-bold">Suggested safe destinations</h2>
      <p>{p.catalogue ? `${p.catalogue.destinations.length} road locations stayed dry in the baseline simulation.` : p.catalogueError ?? "Checking the simulation…"}</p>
      <p>These are suggestions, not confirmed shelters. Check that the route is green before travelling.</p>
      {p.catalogue?.destinations.length === 0 && <p role="status">No qualifying unflooded road point was found. No destination is invented.</p>}
      <p className="text-stone-600">Based on the storm simulated on this dashboard.</p>
    </section>
    <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <h2 className="font-semibold uppercase tracking-wider">Evacuation Route Finder</h2>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-violet-300 px-3 py-2 text-violet-800" aria-pressed={p.pickMode === "origin"} onClick={() => p.onPickModeChange(p.pickMode === "origin" ? null : "origin")}>Pin starting point on map</button>
        {p.usingDrafts && <button className="rounded-lg border border-violet-300 px-3 py-2 text-violet-800" aria-pressed={p.pickMode === "destination"} onClick={() => p.onPickModeChange(p.pickMode === "destination" ? null : "destination")}>Pin personal demo destination</button>}
      </div>
      {p.pickMode && <div className="rounded-lg bg-violet-100 p-2 text-violet-900">
        Click a road on the map to place the {p.pickMode === "origin" ? "starting" : "safe destination"} pin. The pin snaps to the nearby road.
        <button className="ml-2 underline" onClick={() => p.onPickModeChange(null)}>Cancel</button>
      </div>}
      <p role="status">{p.pickMessage}</p>
      <label className="block space-y-1"><span>Starting street (select to use its endpoint)</span>
        <select className={selectClass} value={p.startStreetId} onChange={(e) => p.onStartChange(e.target.value)}>{options}</select>
      </label>
      <label className="block space-y-1"><span>Destination</span>
        <select className={selectClass} value={p.selectedDestinationId ?? ""} onChange={(e) => p.onDestinationChange(e.target.value || null)}>
          <option value="">Nearest reachable destination (automatic)</option>
          {p.destinations.map((d) => <option key={d.id} value={d.id}>{d.name} · Demo</option>)}
        </select>
      </label>
    </section>
    {p.result && <section aria-live="polite" className={`space-y-1.5 rounded-xl border p-3.5 ${p.result.found ? "border-violet-300 bg-violet-50" : "border-amber-300 bg-amber-50"}`}>
      <h3 className="font-semibold text-stone-900">{ROUTE_MESSAGES[p.result.outcome]}</h3>
      {p.result.found && <>
        <p className="font-medium text-violet-950">{p.result.destination_name} · {p.result.distance_m} m</p>
        {p.result.distance_m === 0 && <p className="text-stone-500">Already at the destination endpoint.</p>}
        {p.result.uses_amber && <p className="text-amber-800">⚠️ Route includes amber roads</p>}
        {(p.result.excluded_streets > 0 || p.result.unknown_streets > 0) && (
          <p className="text-stone-500">Township totals: {p.result.excluded_streets} flooded streets{p.result.unknown_streets > 0 ? `, ${p.result.unknown_streets} unknown` : ""}. These counts do not describe a previous route.</p>
        )}
      </>}
    </section>}
    <details className="space-y-3 rounded-xl border border-stone-200 p-4">
      <summary className="cursor-pointer font-semibold">Personal demo drafts</summary>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={p.usingDrafts} onChange={(e) => p.onUseDrafts(e.target.checked)} />Use personal drafts instead of shared destinations</label>
      <p>Stored only on this device. Never shared with residents or promoted to verified centres.</p>
      {p.usingDrafts && <>
      <label className="block space-y-1"><span>Destination name</span>
        <input className={selectClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Safe destination name" maxLength={80} />
      </label>
      <label className="block space-y-1"><span>Destination street endpoint</span>
        <select className={selectClass} value={streetId} onChange={(e) => setStreetId(e.target.value)}>{options}</select>
      </label>
      <button className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={!name.trim() || !streetId} onClick={() => {
        p.onDestinationsChange([...p.draftDestinations, { id: crypto.randomUUID(), name: name.trim(), street_id: streetId, kind: "demo" }]);
        setName("");
      }}>Add safe destination</button>
      <ul className="space-y-2">{p.draftDestinations.map((d) => <li className="flex flex-wrap items-center justify-between gap-2" key={d.id}>
        {editingId === d.id ? <>
          <label className="sr-only" htmlFor={`destination-name-${d.id}`}>Edit name for {d.name}</label>
          <input
            id={`destination-name-${d.id}`}
            aria-label={`Edit name for ${d.name}`}
            className={`${selectClass} min-w-40 flex-1`}
            value={editingName}
            maxLength={80}
            autoFocus
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveDestinationName(d.id);
              if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
            }}
          />
          <div className="flex gap-2">
            <button className="text-violet-800 disabled:opacity-50" disabled={!editingName.trim()} onClick={() => saveDestinationName(d.id)}>Save</button>
            <button className="text-stone-600" onClick={() => { setEditingId(null); setEditingName(""); }}>Cancel</button>
          </div>
        </> : <>
          <span>{d.name} · {d.street_id}</span>
          <div className="flex gap-3">
            <button aria-label={`Edit ${d.name}`} className="text-violet-800" onClick={() => { setEditingId(d.id); setEditingName(d.name); }}>Edit</button>
            <button aria-label={`Remove ${d.name}`} className="text-rose-700" onClick={() => p.onDestinationsChange(p.draftDestinations.filter((item) => item.id !== d.id))}>Remove</button>
          </div>
        </>}
      </li>)}</ul>
      <p>{p.saveError ? "Device storage is unavailable; these points last for this session only." : "Saved on this device for this township."}</p>
      </>}
    </details>
    <p className="text-[11px] text-stone-500">Demo only. Simulated drain zones and per-street depth, not hydraulics. Green-first walking routes describe the supplied snapshot, not future conditions or accessibility.</p>
  </div>;
}
