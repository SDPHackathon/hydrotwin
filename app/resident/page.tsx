"use client";
import { useMemo, useRef, useState } from "react";
import PhoneHeader from "@/components/PhoneHeader";
import ResidentSafeRoute from "@/components/ResidentSafeRoute";
import LocationHelpCard from "@/components/LocationHelpCard";
import { useLanguage } from "@/lib/language";
import { useTownshipData } from "@/lib/evacuation/useTownshipData";
import { useResidentRoute } from "@/lib/evacuation/useResidentRoute";
import { snapToRoad } from "@/lib/engine/demo-refuges";
import { parseRouteTownship } from "@/lib/engine/township";
import type { RoadPoint } from "@/lib/engine/route";

type StartingPoint = { area: string; origin: RoadPoint; label: string; description: string };
export default function ResidentPage() {
  const { language, toggleLanguage } = useLanguage("resident"), bm = language === "bm";
  const { areas, slug, select, bundle, error: areaError } = useTownshipData();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<StartingPoint | null>(null), [confirmed, setConfirmed] = useState<StartingPoint | null>(null);
  const [geoBusy, setGeoBusy] = useState(false), [locationError, setLocationError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const geoSequence = useRef(0);
  const current = confirmed?.area === slug ? confirmed : null;
  const routeState = useResidentRoute(current ? { area_slug: slug, origin: current.origin } : null);
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q.length < 2 ? [] : (bundle?.streets.features ?? []).filter((s) => `${s.properties.name ?? ""} ${s.properties.id}`.toLocaleLowerCase().includes(q)).slice(0, 8);
  }, [query, bundle]);
  const chooseArea = (value: string) => {
    geoSequence.current++; setGeoBusy(false); select(value); setPending(null); setConfirmed(null); setQuery(""); setLocationError("");
  };
  const locate = () => {
    const seq = ++geoSequence.current;
    setLocationError(""); setPending(null); setConfirmed(null);
    if (!window.isSecureContext) { setLocationError(bm ? "Lokasi memerlukan HTTPS. Gunakan carian jalan pada sambungan ini." : "Location access requires HTTPS. Use street search on this connection."); return; }
    if (!navigator.geolocation) { setLocationError(bm ? "Lokasi tidak disokong. Gunakan carian jalan." : "Location is unavailable in this browser. Use street search."); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (seq !== geoSequence.current) return;
      try {
        const { longitude, latitude, accuracy } = position.coords;
        if (!Number.isFinite(accuracy) || accuracy > 100) throw new Error(bm ? "Lokasi terlalu kurang tepat. Cari jalan anda secara manual." : "Location accuracy is too low. Select your street manually.");
        const inside = areas.filter((a) => latitude >= a.bbox[0] && latitude <= a.bbox[2] && longitude >= a.bbox[1] && longitude <= a.bbox[3]);
        const area = inside.find((a) => a.slug === slug) ?? inside.sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]))[0];
        if (!area) throw new Error(bm ? "Lokasi anda di luar kawasan yang dikongsi. Pilih kawasan dan jalan secara manual." : "You are outside the shared township coverage. Choose a township and street manually.");
        const res = await fetch(`/api/township/shared?area=${encodeURIComponent(area.slug)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error("Township roads are unavailable");
        const target = parseRouteTownship(await res.json());
        const snapped = snapToRoad(target.streets.features, [longitude, latitude], 75);
        if (!snapped) throw new Error(bm ? "Tiada jalan dipetakan dalam 75 m. Pilih jalan secara manual." : "No mapped road is within 75 m. Choose your street manually.");
        if (seq !== geoSequence.current) return;
        const road = target.streets.features.find((s) => s.properties.id === snapped.street_id)!;
        select(area.slug); setQuery("");
        setPending({ area: area.slug, origin: { street_id: snapped.street_id, position: snapped.position }, label: road.properties.name || road.properties.id,
          description: `${bm ? "Ketepatan lokasi" : "Location accuracy"} ±${Math.round(accuracy)} m · ${bm ? "titik jalan" : "road anchor"} ${Math.round(snapped.distance_m)} m ${bm ? "dari bacaan" : "from reading"}` });
      } catch (e) { if (seq === geoSequence.current) setLocationError(e instanceof Error ? e.message : "Could not locate this road"); }
      finally { if (seq === geoSequence.current) setGeoBusy(false); }
    }, (failure) => {
      if (seq !== geoSequence.current) return;
      setGeoBusy(false);
      setLocationError(failure.code === 1 ? (bm ? "Kebenaran lokasi ditolak. Gunakan carian jalan." : "Location permission was denied. Use street search.") : bm ? "Lokasi tidak tersedia atau tamat masa. Gunakan carian jalan." : "Location is unavailable or timed out. Use street search.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  const openHelp = () => {
    setHelpOpen(true);
    requestAnimationFrame(() => document.getElementById("location-help")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
  };
  const startRoad = bundle?.streets.features.find((s) => s.properties.id === current?.origin.street_id);
  const status = startRoad && routeState.envelope?.statuses[startRoad.properties.drain_id];
  return <div className="min-h-screen bg-stone-100 pb-12 text-stone-900">
    <PhoneHeader title={bm ? "HydroTwin Penduduk" : "HydroTwin Resident"} subtitle={bm ? "Lokasi anda · laluan demo" : "Your location · demo routes"}
      badge={bundle?.area.name ?? "Township"} badgeClassName="max-w-44 truncate bg-blue-100 text-blue-800" language={language} onToggleLanguage={toggleLanguage}
      links={[{ href: `/?area=${slug}`, label: bm ? "Peta" : "Map" }, { href: `/control?area=${slug}`, label: bm ? "Kawalan" : "Control" }, { href: "/guard", label: bm ? "Pengawal" : "Guard" }]} />
    <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
        <h1 className="text-base font-bold">{bm ? "Di manakah titik permulaan anda?" : "Where are you starting from?"}</h1>
        <label className="block text-xs font-semibold">{bm ? "Kawasan" : "Township"}<select value={slug} onChange={(e) => chooseArea(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm">{areas.length ? areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>) : <option value="bukit-raja">Bandar Bukit Raja</option>}</select></label>
        {areaError && <p role="alert" className="text-xs text-rose-800">{areaError}</p>}
        <button disabled={geoBusy || !areas.length} onClick={locate} className="min-h-12 w-full rounded-lg bg-violet-700 text-sm font-bold text-white disabled:opacity-50">{geoBusy ? (bm ? "Mencari lokasi…" : "Locating…") : (bm ? "Cari lokasi saya" : "Locate me")}</button>
        <p className="text-[11px] text-stone-500">{bm ? "Lokasi sekali sahaja dengan kebenaran anda. Tiada penjejakan latar atau koordinat GPS disimpan." : "One-time location with your permission. No background tracking or stored GPS coordinates."}</p>
        <label className="block text-xs font-semibold">{bm ? "Atau cari jalan secara manual" : "Or search your street manually"}<input value={query} onChange={(e) => { geoSequence.current++; setGeoBusy(false); setQuery(e.target.value); setPending(null); setConfirmed(null); }} placeholder={bm ? "Taip nama jalan…" : "Type a street name…"} disabled={!bundle} autoComplete="off" aria-controls="street-hints" className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 p-2 text-base font-normal" /></label>
        <p className="text-[11px] text-stone-500">{bm ? "Cadangan daripada jalan yang dimuat turun. Carian alamat rumah penuh belum tersedia." : "Suggestions use downloaded street names. Full house-address search is not available."}</p>
        {query.trim().length >= 2 && <ul id="street-hints" className="divide-y divide-stone-100 rounded-lg border border-stone-200">{matches.map((s) => <li key={s.properties.id}><button className="min-h-11 w-full px-3 py-2 text-left text-xs hover:bg-violet-50 focus:bg-violet-50" onClick={() => { geoSequence.current++; setGeoBusy(false); setPending({ area: slug, origin: { street_id: s.properties.id, position: { segment_index: 0, fraction: 0 } }, label: s.properties.name || s.properties.id, description: bm ? "Hujung jalan dipetakan, bukan alamat rumah tepat." : "Mapped street endpoint, not an exact house address." }); setQuery(""); setLocationError(""); }}><strong>{s.properties.name || "Unnamed road"}</strong><span className="block text-stone-500">{s.properties.id}</span></button></li>)}{!matches.length && <li className="p-3 text-xs text-stone-500">{bm ? "Tiada jalan sepadan dalam kawasan ini." : "No matching mapped streets in this township."}</li>}</ul>}
        {locationError && <p role="alert" className="text-xs text-rose-800">{locationError}</p>}
        {pending?.area === slug && <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs"><p className="font-bold">{pending.label}</p><p>{pending.description}</p><p>{bm ? "Pastikan jalan ini sepadan dengan tempat anda sebelum meneruskan." : "Check that this road matches your starting location."}</p><button disabled={!bundle} onClick={() => { setConfirmed(pending); setPending(null); }} className="min-h-11 w-full rounded-lg bg-violet-700 font-bold text-white">{bm ? "Gunakan titik permulaan ini" : "Use this starting point"}</button></div>}
      </section>
      {current && <>
        <section className={`space-y-1 rounded-xl border p-4 ${!status ? "border-stone-300 bg-stone-50" : status.status === "red" ? "border-rose-300 bg-rose-50" : status.status === "amber" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`} role="status">
          <h2 className="text-xs font-bold">{current.label}</h2><p className="text-sm font-bold">{!status ? (bm ? "Keadaan jalan tidak diketahui" : "Street conditions unknown") : status.status === "red" ? (bm ? "Jalan dinaiki air" : "Street flooded") : status.status === "amber" ? (bm ? "Risiko banjir meningkat" : "Elevated flood risk") : (bm ? "Hijau dalam simulasi semasa" : "Green in the current simulation")}</p>
          {status?.status === "red" && <p className="text-xs">{status.street_depth_cm} cm · {bm ? "Jangan meredah air banjir." : "Do not walk through floodwater."}</p>}
          {!status && <p className="text-xs">{bm ? "Mulakan atau set semula simulator telefon bagi kawasan ini." : "Start or reset this township’s phone simulator to initialize conditions."}</p>}
        </section>
        {bundle && <ResidentSafeRoute envelope={routeState.envelope} notice={routeState.notice} onHelp={openHelp} language={language} streets={bundle.streets.features} />}
      </>}
      <LocationHelpCard area={slug} origin={current?.origin ?? null} open={helpOpen} onOpen={setHelpOpen} language={language} />
      <footer className="text-[11px] text-stone-500">{bm ? "Demo sahaja: titik dipilih daripada simulasi ribut asas, bukan pusat perlindungan disahkan. Zon longkang dan kedalaman jalan disimulasikan, bukan hidraulik." : "Demo only: points are selected from the baseline storm simulation, not verified shelters. Simulated drain zones and per-street water depth, not hydraulics."}</footer>
    </main>
  </div>;
}
