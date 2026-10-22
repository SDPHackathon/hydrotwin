"use client";
import { useState } from "react";
import PhoneHeader from "@/components/PhoneHeader";
import ResidentSafeRoute from "@/components/ResidentSafeRoute";
import ResidentLocationPicker from "@/components/ResidentLocationPicker";
import LocationHelpCard from "@/components/LocationHelpCard";
import { useLanguage } from "@/lib/language";
import { useTownshipData } from "@/lib/evacuation/useTownshipData";
import { useResidentRoute } from "@/lib/evacuation/useResidentRoute";
import { coverageLabel, type CoverageMatch } from "@/lib/engine/coverage";

export default function ResidentPage() {
  const { language, toggleLanguage } = useLanguage("resident"), bm = language === "bm";
  const { areas, slug, select, bundle, error: areaError } = useTownshipData();
  const [confirmed, setConfirmed] = useState<CoverageMatch | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const current = confirmed?.area.slug === slug ? confirmed : null;
  const routeState = useResidentRoute(current ? { area_slug: slug, origin: current.origin } : null);
  const startRoad = bundle?.streets.features.find((s) => s.properties.id === current?.origin.street_id);
  const status = startRoad && routeState.envelope?.statuses[startRoad.properties.drain_id];
  return <div className="min-h-screen bg-stone-100 pb-[calc(2rem+env(safe-area-inset-bottom))] text-stone-900">
    <PhoneHeader title={bm ? "HydroTwin Penduduk" : "HydroTwin Resident"} subtitle={bm ? "Lokasi anda · laluan demo" : "Your location · demo routes"}
      badge={current?.area.name ?? (bm ? "Semak liputan" : "Check coverage")} badgeClassName="max-w-44 truncate bg-blue-100 text-blue-800" language={language} onToggleLanguage={toggleLanguage} />
    <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <ResidentLocationPicker areas={areas} current={current} language={language}
        onEdit={() => setConfirmed(null)} onConfirm={(match) => { select(match.area.slug); setConfirmed(match); }} />
      {current && <>
        {areaError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{areaError}</p>}
        <section className={`space-y-2 rounded-xl border p-4 shadow-xs ${!status ? "border-stone-200 bg-white" : status.status === "red" ? "border-rose-300 bg-rose-50" : status.status === "amber" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`} role="status">
          <div className="flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${!status ? "bg-stone-400" : status.status === "red" ? "bg-rose-600" : status.status === "amber" ? "bg-amber-500" : "bg-emerald-600"}`} /><h2 className="text-xs font-medium text-stone-600">{coverageLabel(current, language)}</h2></div><p className="text-base font-semibold tracking-tight">{!status ? (bm ? "Keadaan jalan tidak diketahui" : "Street conditions unknown") : status.status === "red" ? (bm ? "Jalan dinaiki air" : "Street flooded") : status.status === "amber" ? (bm ? "Risiko banjir meningkat" : "Elevated flood risk") : (bm ? "Hijau dalam simulasi semasa" : "Green in the current simulation")}</p>
          {status?.status === "red" && <p className="text-xs">{status.street_depth_cm} cm · {bm ? "Jangan meredah air banjir." : "Do not walk through floodwater."}</p>}
          {!status && <p className="text-xs">{bm ? "Mulakan atau set semula simulator telefon bagi kawasan ini." : "Start or reset this township’s phone simulator to initialize conditions."}</p>}
        </section>
        {bundle && <ResidentSafeRoute envelope={routeState.envelope} notice={routeState.notice} language={language} streets={bundle.streets.features} />}
      </>}
      <LocationHelpCard area={slug} origin={current?.origin ?? null} open={helpOpen} onOpen={setHelpOpen} language={language} />
    </main>
  </div>;
}
