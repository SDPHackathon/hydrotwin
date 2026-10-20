"use client";

import { useState } from "react";
import type { RouteDestination, RouteOutcome, RouteResult, StreetFeature } from "@/lib/engine/route";

const messages: Record<RouteOutcome, string> = {
  found: "Route found",
  no_destinations: "No safe destinations configured. Add one below.",
  invalid_origin: "The starting street is missing from the loaded road data.",
  origin_blocked: "The starting street is flooded. No traversable exit is modeled from this origin.",
  origin_unknown: "The starting street has no flood status. A route cannot be confirmed.",
  destination_unavailable: "No selected destination is on a green street with known status.",
  disconnected: "The supplied road data does not connect this origin to an eligible destination.",
  no_route: "Flooded roads or roads with unknown status prevent a route to an eligible destination.",
};

type Props = {
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
    p.onDestinationsChange(p.destinations.map((destination) => destination.id === id
      ? { ...destination, name: trimmedName }
      : destination));
    setEditingId(null);
    setEditingName("");
  };
  return <div className="flex flex-col gap-4 text-xs">
    <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <h2 className="font-semibold uppercase tracking-wider">Evacuation Route Finder</h2>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-violet-300 px-3 py-2 text-violet-800" aria-pressed={p.pickMode === "origin"} onClick={() => p.onPickModeChange(p.pickMode === "origin" ? null : "origin")}>Pin starting point on map</button>
        <button className="rounded-lg border border-violet-300 px-3 py-2 text-violet-800" aria-pressed={p.pickMode === "destination"} onClick={() => p.onPickModeChange(p.pickMode === "destination" ? null : "destination")}>Pin safe destination on map</button>
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
      <h3 className="font-semibold text-stone-900">{messages[p.result.outcome]}</h3>
      {p.result.found && <>
        <p className="font-medium text-violet-950">{p.result.destination_name} · {p.result.distance_m} m ({Math.ceil(p.result.distance_m / 70)} min walk)</p>
        {p.result.distance_m === 0 && <p className="text-stone-500">Already at the destination endpoint.</p>}
        {p.result.uses_amber && <p className="text-amber-800">⚠️ Route includes amber roads</p>}
        {(p.result.excluded_streets > 0 || p.result.unknown_streets > 0) && (
          <p className="text-stone-500">Avoids {p.result.excluded_streets} flooded streets{p.result.unknown_streets > 0 ? `, ${p.result.unknown_streets} unverified` : ""}.</p>
        )}
      </>}
    </section>}
    <section className="space-y-3 rounded-xl border border-stone-200 p-4">
      <h3 className="font-semibold">Configure safe destinations</h3>
      <label className="block space-y-1"><span>Destination name</span>
        <input className={selectClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Safe destination name" maxLength={80} />
      </label>
      <label className="block space-y-1"><span>Destination street endpoint</span>
        <select className={selectClass} value={streetId} onChange={(e) => setStreetId(e.target.value)}>{options}</select>
      </label>
      <button className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={!name.trim() || !streetId} onClick={() => {
        p.onDestinationsChange([...p.destinations, { id: crypto.randomUUID(), name: name.trim(), street_id: streetId, kind: "demo" }]);
        setName("");
      }}>Add safe destination</button>
      <ul className="space-y-2">{p.destinations.map((d) => <li className="flex flex-wrap items-center justify-between gap-2" key={d.id}>
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
            <button aria-label={`Remove ${d.name}`} className="text-rose-700" onClick={() => p.onDestinationsChange(p.destinations.filter((item) => item.id !== d.id))}>Remove</button>
          </div>
        </>}
      </li>)}</ul>
      <p>{p.saveError ? "Device storage is unavailable; these points last for this session only." : "Saved on this device for this township."}</p>
    </section>
  </div>;
}
