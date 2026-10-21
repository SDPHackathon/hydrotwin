"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { coverageLabel, insideCoverage, type Coordinate, type CoverageArea, type CoverageMatch, type CoverageResponse } from "@/lib/engine/coverage";
import type { Language } from "@/lib/language";
import ResidentSectionHeading from "@/components/ResidentSectionHeading";

const CoverageMap = dynamic(() => import("./ResidentCoverageMap"), { ssr: false, loading: () => <p className="p-4 text-xs">Loading coverage map… / Memuatkan peta…</p> });
type Results = { response: CoverageResponse; kind: "search" | "point" };
export default function ResidentLocationPicker({ areas, onConfirm, onEdit, current, language }: {
  areas: CoverageArea[]; onConfirm: (match: CoverageMatch) => void; onEdit: () => void;
  current: CoverageMatch | null; language: Language;
}) {
  const bm = language === "bm";
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null), [pending, setPending] = useState<CoverageMatch | null>(null);
  const [mapOpen, setMapOpen] = useState(false), [point, setPoint] = useState<Coordinate | null>(null);
  const [focusSlug, setFocusSlug] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0), request = useRef<AbortController | null>(null);
  const available = results?.response.areas ?? areas;
  const invalidate = () => {
    sequence.current++; request.current?.abort(); setBusy(false); setError(""); setPending(null); setResults(null); onEdit();
  };
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController(), seq = ++sequence.current;
    request.current = controller;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coverage?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!res.ok) throw new Error("search");
        const response: CoverageResponse = await res.json();
        if (seq === sequence.current) { setResults({ response, kind: "search" }); setError(""); }
      } catch { if (seq === sequence.current && !controller.signal.aborted) setError(bm ? "Carian tidak tersedia. Cuba semula." : "Street search is unavailable. Please try again."); }
      finally { if (seq === sequence.current) setBusy(false); }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, bm, retry]);

  useEffect(() => {
    if (results?.kind === "point" || error) feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [results, error]);

  const lookup = async (coordinate: Coordinate, seq: number, openMap = true) => {
    const controller = new AbortController(); request.current = controller;
    setPoint(coordinate); if (openMap) setMapOpen(true);
    try {
      const res = await fetch("/api/coverage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ point: coordinate }),
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (!res.ok) throw new Error("coverage");
      const response: CoverageResponse = await res.json();
      if (seq !== sequence.current) return;
      setResults({ response, kind: "point" });
      // Several overlapping areas require the resident to choose. A single match still needs confirmation.
      if (response.matches.length === 1) setPending(response.matches[0]);
    } catch { if (seq === sequence.current && !controller.signal.aborted) setError(bm ? "Tidak dapat menyemak liputan. Cuba semula; keadaan tidak diketahui." : "Could not check coverage. Please retry; conditions are unknown."); }
    finally { if (seq === sequence.current) setBusy(false); }
  };
  const pick = (coordinate: Coordinate) => {
    invalidate(); setQuery(""); setBusy(true); void lookup(coordinate, sequence.current);
  };
  const locate = () => {
    invalidate(); setQuery(""); setPoint(null); setMapOpen(false);
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(bm ? "Lokasi memerlukan HTTPS atau sokongan pelayar. Cari jalan atau pilih pada peta." : "Location access needs HTTPS and browser support. Search for your street or choose on the map."); return;
    }
    setBusy(true);
    const seq = sequence.current;
    navigator.geolocation.getCurrentPosition((position) => {
      if (seq !== sequence.current) return;
      if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 100) {
        setBusy(false); setError(bm ? "Lokasi kurang tepat. Cari jalan atau pilih pada peta." : "Location accuracy is too low. Search for your street or choose on the map."); return;
      }
      void lookup([position.coords.longitude, position.coords.latitude], seq, false);
    }, () => {
      if (seq !== sequence.current) return;
      setBusy(false); setError(bm ? "Lokasi ditolak atau tidak tersedia. Cari jalan atau pilih pada peta." : "Location was denied or unavailable. Search for your street or choose on the map.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  const matches = results?.response.matches ?? [];
  const noMatch = results && !matches.length;
  const missing = !!results?.response.incomplete.length;
  const inBoundary = point && available.some((area) => insideCoverage(area, point));
  const choose = (match: CoverageMatch) => { request.current?.abort(); sequence.current++; setBusy(false); setPending(match); setMapOpen(false); setError(""); };

  const feedback = <div ref={feedbackRef} className="space-y-2">
      <div aria-live="polite" role="status" className="space-y-2 text-xs">
        {busy && <p>{bm ? "Menyemak lokasi…" : "Checking location…"}</p>}
        {missing && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{bm ? "Sesetengah kawasan tidak dapat disemak. Hasil ini tidak lengkap; cuba semula." : "Some areas could not be checked. These results are incomplete; please retry."}</p>}
        {noMatch && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><strong className="mb-1 block">{bm ? "Titik permulaan tidak tersedia" : "Starting point unavailable"}</strong>{missing ? (bm ? "Liputan belum dapat dipastikan." : "Coverage could not be established.") : results.kind === "search" ? (bm ? "Tiada jalan sepadan dalam kawasan demo yang dikongsi. Cuba nama lain atau semak pada peta." : "No matching street in the shared demo areas. Try another name or check on the map.") : inBoundary ? (bm ? "Tiada jalan yang dimuatkan dalam 75 m dari pin jingga. Cari jalan atau laraskan pin ke lokasi sebenar anda." : "No loaded road within 75 m of the orange pin. Search for your street or adjust the pin to your actual location.") : (bm ? "Pin jingga ini di luar liputan HydroTwin. Jika ini lokasi anda, maklumat laluan belum tersedia." : "This orange pin is outside HydroTwin coverage. If this is your location, route information is unavailable.")} {bm ? "Tiada data tidak bermaksud selamat." : "Missing information does not mean safe."}</p>}
        {results?.kind === "point" && matches.length > 1 && <p className="font-semibold">{bm ? "Kawasan liputan bertindih. Pilih jalan dan kawasan yang sesuai." : "Coverage areas overlap here. Choose the road and area that match your location."}</p>}
        {results?.response.truncated && <p>{bm ? "Menunjukkan 24 hasil pertama. Taip nama jalan yang lebih khusus." : "Showing the first 24 matches. Use a more specific street name."}</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
      {(error || missing) && (point || query.trim().length >= 2) && <button type="button" disabled={busy} onClick={() => {
        const previousPoint = point; invalidate(); setBusy(true);
        if (previousPoint) void lookup(previousPoint, sequence.current, mapOpen); else setRetry((n) => n + 1);
      }} className="min-h-11 w-full rounded-lg border border-stone-300 text-xs font-semibold disabled:opacity-50">{bm ? "Cuba semakan semula" : "Retry coverage check"}</button>}
      {!pending && matches.length > 0 && <ul id="resident-location-results" aria-label={bm ? "Lokasi sepadan" : "Matching locations"} className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
        {matches.map((match) => <li key={`${match.area.slug}:${match.origin.street_id}`}><button type="button" onClick={() => choose(match)} className="min-h-12 w-full px-3 py-2 text-left text-xs transition hover:bg-stone-50 focus:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">
          <strong>{coverageLabel(match, language)}</strong><span className="block text-stone-600">{match.area.name} · {match.area.slug}</span>
          {match.distance_m !== null && <span className="block text-stone-500">{Math.round(match.distance_m)} m {bm ? "dari titik pilihan" : "from selected location"}</span>}
        </button></li>)}
      </ul>}
      {pending && <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
        <p className="font-bold">{bm ? "Titik permulaan ditemui" : "Starting point found"}</p><p className="font-bold">{coverageLabel(pending, language)}</p><p>{bm ? "Liputan demo" : "Demo coverage"}: {pending.area.name} · {pending.area.slug}</p>
        <p>{bm ? "Semak titik hitam dan batas ungu sebelum mengesahkan. Nama kawasan tidak bermaksud seluruh bandar diliputi." : "Check the black road point and purple boundary before confirming. The area name does not mean the whole town is covered."}</p>
        <p>{pending.distance_m !== null && <strong>{Math.round(pending.distance_m)} m {bm ? "dari pin jingga. " : "from the orange pin. "}</strong>}{pending.distance_m === null ? (bm ? "Titik contoh pada jalan ini, bukan alamat rumah tepat. Pilih pada peta untuk melaraskannya." : "A representative point on this road, not an exact house address. Choose on map to adjust it.") : (bm ? "Titik dipadankan pada jalan terdekat dalam liputan." : "Matched to the nearest loaded road inside coverage.")}</p>
        {matches.length > 1 && <button type="button" onClick={() => setPending(null)} className="min-h-11 w-full rounded-lg border border-stone-300 bg-white font-semibold text-stone-700 hover:bg-stone-50">{bm ? "Pilih hasil lain" : "Choose another match"}</button>}
        <button type="button" onClick={() => { onConfirm(pending); setPending(null); setResults(null); setPoint(null); setMapOpen(false); }} className="min-h-11 w-full rounded-lg bg-stone-900 font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900">{bm ? "Gunakan titik permulaan ini" : "Use this starting point"}</button>
      </div>}
  </div>;

  return <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
    <ResidentSectionHeading kind="location" level="h1" title={current ? (bm ? "Lokasi anda" : "Your location") : (bm ? "Cari lokasi anda" : "Find your location")}
      subtitle={current ? undefined : (bm ? "Semak keadaan jalan dan titik selamat berhampiran." : "Check your street and nearby safe points.")} />
    {current ? <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
      <div><p className="text-sm font-semibold">{coverageLabel(current, language)}</p><p className="mt-1 text-stone-500">{current.area.name}</p></div>
      <button type="button" onClick={() => { invalidate(); setPoint(null); setQuery(""); }} className="min-h-11 w-full rounded-lg border border-stone-300 bg-white font-semibold text-stone-700 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{bm ? "Tukar lokasi" : "Change location"}</button>
    </div> : <>
      <button type="button" disabled={busy} onClick={locate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-stone-900 text-sm font-semibold text-white shadow-xs transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>{bm ? "Gunakan lokasi saya" : "Use my location"}</button>
      <label className="block text-xs font-semibold" htmlFor="resident-street-search">{bm ? "Cari jalan di semua kawasan demo" : "Search streets across all demo areas"}</label>
      <div className="relative"><svg aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-stone-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input id="resident-street-search" value={query} onChange={(event) => {
        invalidate(); setPoint(null); const value = event.target.value; setQuery(value); setBusy(value.trim().length >= 2);
      }} maxLength={120} placeholder={bm ? "Taip nama jalan…" : "Type a street name…"} autoComplete="off" aria-controls="resident-location-results" className="min-h-12 w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-base outline-none transition placeholder:text-stone-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
      <button type="button" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)} className="min-h-11 w-full rounded-lg border border-stone-300 bg-stone-100 text-xs font-semibold text-stone-700 transition hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{mapOpen ? (bm ? "Tutup pemilih peta" : "Close map picker") : (bm ? "Pilih pada peta" : "Choose on map")}</button>
      {(mapOpen || pending) && <div className="space-y-2">
        {mapOpen && <><p className="text-xs">{bm ? "Ketik lokasi anda berhampiran jalan biru, atau gerakkan peta dan semak titik di tengahnya." : "Tap your location near a blue loaded road, or move the map and check its centre."}</p>
          <label className="block text-xs font-semibold">{bm ? "Zum ke kawasan liputan" : "Zoom to a coverage area"}<select value={focusSlug ?? ""} onChange={(e) => { invalidate(); setPoint(null); setQuery(""); setFocusSlug(e.target.value || null); }} className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white p-2 font-normal"><option value="">{bm ? "Semua kawasan" : "All areas"}</option>{available.map((a) => <option key={a.slug} value={a.slug}>{a.name} · {a.slug}</option>)}</select></label></>}
        <CoverageMap areas={available} selection={pending} point={point} focusSlug={focusSlug} onPick={mapOpen ? pick : undefined} language={language}>{feedback}</CoverageMap>
      </div>}
      {!mapOpen && !pending && feedback}
      <p className="text-[11px] text-stone-500">{bm ? "Liputan berdasarkan kawasan demo yang dikongsi oleh papan pemuka, bukan sempadan rasmi bandar." : "Coverage comes from demo areas shared by the dashboard, not official town boundaries."}</p>
    </>}
  </section>;
}
