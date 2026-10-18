"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Area, Streets } from "@/lib/area";
import type { Drain } from "@/lib/engine/types";
import {
  boundaryError, DEVELOPMENT_LABELS, DEVELOPMENT_MODEL, DEVELOPMENT_STAGES,
  developmentError, evaluateDevelopment, parseDevelopments, siteAreaHa, suggestDevelopmentConnections,
  type DevelopmentDraft, type DevelopmentResult, type DevelopmentStage, type SavedDevelopment,
} from "@/lib/engine/development";

const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium disabled:opacity-40";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("hydrotwin-development", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("hydrotwin-development", notify); };
};
const serverSnapshot = () => null;
const minutes = (n: number | null) => n === null ? "No overflow" : `${n} min`;

interface Props {
  area: Area;
  drains: Drain[];
  streets: Streets;
  draft: DevelopmentDraft;
  onChange: (draft: DevelopmentDraft) => void;
  drawing: boolean;
  onDrawing: (drawing: boolean) => void;
  result: DevelopmentResult | null;
  error: string | null;
  stage: DevelopmentStage;
  onStage: (stage: DevelopmentStage) => void;
}

export default function DevelopmentPanel({ area, drains, streets, draft, onChange, drawing, onDrawing, result, error, stage, onStage }: Props) {
  const key = `hydrotwin_developments_v1_${area.slug}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key); } catch { return null; } }, serverSnapshot);
  const saved = useMemo(() => parseDevelopments(raw), [raw]);
  const [message, setMessage] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareStage, setCompareStage] = useState<DevelopmentStage>("proposed");
  const update = (patch: Partial<DevelopmentDraft>) => { onChange({ ...draft, ...patch }); setMessage(""); };
  const persist = (items: SavedDevelopment[], success: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
      window.dispatchEvent(new Event("hydrotwin-development"));
      setMessage(success);
    } catch { setMessage("Could not save to this browser. Your open proposal is still available; storage may be full or disabled."); }
  };
  const save = () => {
    if (!result || drawing || !draft.name.trim()) return;
    if (saved.length >= 30) { setMessage("This township has 30 saved proposals. Delete one before saving another."); return; }
    persist([{ id: crypto.randomUUID(), model: DEVELOPMENT_MODEL, created_at: new Date().toISOString(), draft: { ...draft, name: draft.name.trim() }, results: result }, ...saved], "Proposal saved to this browser.");
  };
  const comparisons = useMemo(() => saved.filter(s => compareIds.includes(s.id)).map(s => {
    const invalid = developmentError(s.draft, drains, streets.features, area.bbox);
    return { saved: s, error: invalid, result: invalid ? null : evaluateDevelopment(s.draft, drains, streets.features, area.bbox) };
  }), [saved, compareIds, drains, streets, area.bbox]);
  const geometryError = boundaryError(draft.boundary);
  const suggestion = useMemo(() => suggestDevelopmentConnections(draft.boundary, streets.features, drains), [draft.boundary, streets, drains]);
  const applySuggestions = () => {
    if (suggestion) update(suggestion);
    else setMessage("No mapped road with a known drain zone could be suggested. Choose manually.");
  };
  const accessZone = streets.features.find(s => s.properties.id === draft.access_street_id)?.properties.drain_id;

  return <div className="flex flex-col gap-4 text-stone-800">
    <div>
      <h2 className="text-lg font-semibold">Evaluate a new development</h2>
      <p className="mt-1 text-xs text-stone-600">Compare existing conditions, construction, and mitigation under the same synthetic storm.</p>
    </div>
    <section className="space-y-3 rounded-xl border border-stone-200 p-3">
      <h3 className="text-sm font-semibold">1. Define the site</h3>
      <label className="block text-xs">Proposal name<input className={`${field} mt-1`} maxLength={80} value={draft.name} onChange={e => update({ name: e.target.value })} /></label>
      <label className="block text-xs">Development type<select className={`${field} mt-1`} value={draft.kind} onChange={e => update({ kind: e.target.value as DevelopmentDraft["kind"], proposed_paved_pct: e.target.value === "housing" ? 60 : 85 })}>
        <option value="housing">Housing</option><option value="commercial">Commercial</option>
      </select></label>
      <p className="text-xs text-stone-500">Changing type applies an editable paving preset: housing 60%, commercial 85%.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={() => { update({ boundary: [] }); onDrawing(true); }}>Draw new site</button>
        {drawing && <>
          <button className={button} disabled={!draft.boundary.length} onClick={() => update({ boundary: draft.boundary.slice(0, -1) })}>Undo corner</button>
          <button className={`${button} bg-indigo-600 text-white`} disabled={!!geometryError} onClick={() => { applySuggestions(); onDrawing(false); }}>Finish boundary</button>
          <button className={button} onClick={() => { update({ boundary: [] }); onDrawing(false); }}>Cancel drawing</button>
        </>}
      </div>
      <p className="text-xs" role="status">{drawing ? `Click corners on the map (${draft.boundary.length}/50). ${geometryError ?? "Ready to finish."}` : draft.boundary.length ? `Site area: ${siteAreaHa(draft.boundary).toFixed(2)} ha. Boundary identifies the proposal only.` : "Draw at least three corners inside the loaded township."}</p>
    </section>
    <section className="space-y-3 rounded-xl border border-stone-200 p-3">
      <h3 className="text-sm font-semibold">2. Set drainage and land cover</h3>
      <label className="block text-xs">Receiving drain zone<select className={`${field} mt-1`} value={draft.drain_id} onChange={e => update({ drain_id: e.target.value })}>{drains.map(d => <option key={d.id} value={d.id}>{d.id} · {d.name}</option>)}</select></label>
      <p className="text-xs text-stone-500">Uses the same street groups as Live Warning. Finishing the boundary suggests the zone of the road nearest the site’s outline centre. You can change it here or click a drain on the map.</p>
      <button className={button} disabled={!suggestion || drawing} onClick={applySuggestions}>Use suggested zone and road</button>
      {suggestion && !drawing && <p className="text-xs text-stone-500">Suggested zone: {suggestion.drain_id}. Your selected zone: {draft.drain_id}. Proximity is an estimate of the connection.</p>}
      {(["existing_paved_pct", "proposed_paved_pct"] as const).map((key, i) => <label key={key} className="block text-xs">
        {i === 0 ? "Before construction" : "After construction"} buildings and paving: <strong>{draft[key]}%</strong> · permeable: {100 - draft[key]}%
        <input className="mt-2 w-full accent-indigo-600" type="range" min={0} max={100} value={draft[key]} onChange={e => update({ [key]: Number(e.target.value) })} />
      </label>)}
      <p className="text-xs text-stone-500">Both percentages apply only to your drawn site. Before is the estimated current cover; after is the planned total cover.</p>
      <label className="block text-xs">Proposed access road<select className={`${field} mt-1`} value={draft.access_street_id} onChange={e => update({ access_street_id: e.target.value })}>
        <option value="">Choose an existing road</option>{streets.features.map(s => <option key={s.properties.id} value={s.properties.id}>{s.properties.name || s.properties.id} · {s.properties.drain_id}</option>)}
      </select></label>
      <p className="text-xs text-stone-500">The nearest mapped road is suggested automatically. You can choose a different access road.</p>
      {accessZone && accessZone !== draft.drain_id && <p className="text-xs text-amber-800">Access is in {accessZone}; development changes only {draft.drain_id}. Cross-zone water movement is not modelled.</p>}
      <label className="block text-xs">Mitigation for the receiving zone<select className={`${field} mt-1`} value={draft.mitigation} onChange={e => update({ mitigation: e.target.value as DevelopmentDraft["mitigation"] })}>
        <option value="none">None</option><option value="bigger_drain">Bigger drain · assumed outflow ×1.5</option><option value="retention_pond">Retention pond · assumed inflow ×0.6</option>
      </select></label>
      <p className="text-xs text-stone-500">To test green space, reduce proposed paving. It is counted once through land cover.</p>
    </section>
    <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
      <h3 className="text-sm font-semibold">3. Compare the storm results</h3>
      {drawing ? <p className="text-xs">Finish the boundary to calculate results.</p> : error ? <p className="text-xs text-amber-800" role="status">{error}</p> : result && <>
        <p className="text-xs">{draft.drain_id} · {result.area_ha.toFixed(2)} ha site · development inflow ×{result.inflow_multiplier.toFixed(3)} before mitigation.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-[11px]">
          <caption className="sr-only">Receiving zone results for the three development scenarios</caption>
          <thead><tr><th className="py-2">Zone metric</th>{DEVELOPMENT_STAGES.map(s => <th key={s} className="px-1">{DEVELOPMENT_LABELS[s]}</th>)}</tr></thead>
          <tbody>
            <tr className="border-t border-indigo-100"><th className="py-2 font-normal">Peak depth</th>{DEVELOPMENT_STAGES.map(s => <td key={s} className="px-1">{result.stages[s].deepest_cm} cm</td>)}</tr>
            <tr className="border-t border-indigo-100"><th className="py-2 font-normal">First overflow</th>{DEVELOPMENT_STAGES.map(s => <td key={s} className="px-1">{minutes(result.stages[s].minutes_to_first_red)}</td>)}</tr>
            <tr className="border-t border-indigo-100"><th className="py-2 font-normal">Streets affected</th>{DEVELOPMENT_STAGES.map(s => <td key={s} className="px-1">{result.stages[s].streets_flooded}</td>)}</tr>
            <tr className="border-t border-indigo-100"><th className="py-2 font-normal">Access road</th>{DEVELOPMENT_STAGES.map(s => <td key={s} className="px-1">{result.stages[s].access_flooded ? "Overflows" : "No overflow"}</td>)}</tr>
          </tbody>
        </table></div>
        <label className="block text-xs">Map preview<select className={`${field} mt-1`} value={stage} onChange={e => onStage(e.target.value as DevelopmentStage)}>{DEVELOPMENT_STAGES.map(s => <option key={s} value={s}>{DEVELOPMENT_LABELS[s]}</option>)}</select></label>
        <p className="text-xs text-stone-600">Map shows each zone at its own peak, not one instant. Access checks this road only, not a complete evacuation route.</p>
      </>}
      <details className="text-xs text-stone-600"><summary className="cursor-pointer font-medium">Model assumptions and limits</summary><p className="mt-2">The zone’s size is estimated from the extent of its mapped streets with a 50 m margin on each side. The site’s share is capped at 100% of that estimate. {result ? `Selected zone estimate: ${result.zone_area_ha.toFixed(2)} ha. ` : ""}This is a demo footprint, not a measured drainage area. Demo runoff coefficients: permeable ground 0.2, paving 0.9; the rest of the zone shares the site’s existing mix. Development changes only the selected zone. Existing streets represent zone overflow, not flooding inside individual plots. Storm: synthetic 180 minutes plus 30 minutes drainage. Older saved proposals are recalculated with this model.</p></details>
    </section>
    <section className="space-y-3 rounded-xl border border-stone-200 p-3">
      <h3 className="text-sm font-semibold">4. Save and compare proposals</h3>
      <button className={`${button} bg-indigo-600 text-white`} disabled={!result || drawing || !draft.name.trim()} onClick={save}>Save proposal to this browser</button>
      {message && <p role="status" className="text-xs">{message}</p>}
      {saved.length === 0 ? <p className="text-xs text-stone-500">Save two sites or layouts to compare them here.</p> : <>
        <p className="text-xs text-stone-500">Select up to two proposals. Comparisons are recalculated using the current township data and the same storm.</p>
        {saved.map(s => <div key={s.id} className="rounded-lg border border-stone-200 p-2 text-xs">
          <label className="flex items-start gap-2"><input type="checkbox" aria-label={`Compare ${s.draft.name}`} checked={compareIds.includes(s.id)} disabled={!compareIds.includes(s.id) && compareIds.length >= 2} onChange={e => setCompareIds(e.target.checked ? [...compareIds, s.id] : compareIds.filter(id => id !== s.id))} /><span className="min-w-0 break-words font-medium">{s.draft.name} · {s.draft.drain_id}</span></label>
          <div className="mt-2 flex gap-2"><button className={button} onClick={() => { onChange(s.draft); onDrawing(false); setMessage("Saved proposal loaded; results recalculated."); }}>Load</button><button className={button} onClick={() => { persist(saved.filter(x => x.id !== s.id), "Proposal removed."); setCompareIds(compareIds.filter(id => id !== s.id)); }}>Delete</button></div>
        </div>)}
        {comparisons.length > 0 && <>
          <label className="block text-xs">Compare saved proposals at<select className={`${field} mt-1`} value={compareStage} onChange={e => setCompareStage(e.target.value as DevelopmentStage)}>{DEVELOPMENT_STAGES.map(s => <option key={s} value={s}>{DEVELOPMENT_LABELS[s]}</option>)}</select></label>
          <div className="overflow-x-auto"><table className="w-full min-w-96 text-left text-xs [&_th]:p-2 [&_td]:p-2"><caption className="mb-2 text-left font-medium">Saved proposals · {DEVELOPMENT_LABELS[compareStage]}</caption><thead><tr><th>Proposal</th><th>Peak</th><th>First overflow</th><th>Streets</th><th>Access</th></tr></thead><tbody>{comparisons.map(c => <tr key={c.saved.id} className="border-t border-stone-200"><th className="max-w-24 break-words font-normal">{c.saved.draft.name}<br />{c.saved.draft.drain_id}</th>{c.result ? <><td>{c.result.stages[compareStage].deepest_cm} cm</td><td>{minutes(c.result.stages[compareStage].minutes_to_first_red)}</td><td>{c.result.stages[compareStage].streets_flooded}</td><td>{c.result.stages[compareStage].access_flooded ? "Overflows" : "No overflow"}</td></> : <td colSpan={4}>{c.error}</td>}</tr>)}</tbody></table></div>
        </>}
      </>}
    </section>
  </div>;
}
