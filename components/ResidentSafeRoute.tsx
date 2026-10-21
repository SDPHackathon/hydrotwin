"use client";
import dynamic from "next/dynamic";
import type { RouteEnvelope, RouteChange } from "@/lib/engine/evacuation";
import type { StreetFeature } from "@/lib/engine/route";
import { ROUTE_MESSAGES, ROUTE_MESSAGES_BM } from "@/lib/evacuation/messages";
const RouteMap = dynamic(() => import("./EvacuationRouteMap"), { ssr: false, loading: () => <p className="text-xs">Loading route map…</p> });
const NOTICES: Record<RouteChange, string> = {
  flooded: "Your previous route is now blocked by flooding.", unknown: "Conditions on your previous route are now unknown.",
  destination: "The previous destination is no longer available.", unavailable: "Current route guidance is unavailable.",
  alternative: "An alternative destination is now selected.", changed: "Your demo route has changed.", recovered: "A demo route is available again.",
};
const NOTICES_BM: Record<RouteChange, string> = {
  flooded: "Laluan terdahulu anda kini dihalang banjir.", unknown: "Keadaan laluan terdahulu kini tidak diketahui.",
  destination: "Destinasi terdahulu tidak lagi tersedia.", unavailable: "Panduan laluan semasa tidak tersedia.",
  alternative: "Destinasi alternatif kini dipilih.", changed: "Laluan demo anda telah berubah.", recovered: "Laluan demo tersedia semula.",
};
export default function ResidentSafeRoute({ envelope, notice, onHelp, language, streets }: {
  envelope: RouteEnvelope | null; notice: RouteChange | null; onHelp: () => void; language: "en" | "bm"; streets: StreetFeature[];
}) {
  const route = envelope?.route;
  const bm = language === "bm";
  return <section className="space-y-3 rounded-xl border border-violet-200 bg-white p-4 shadow-xs">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">{bm ? "Laluan pemindahan demo" : "Demo evacuation route"}</h2><span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-900">{bm ? "SIMULASI" : "SIMULATION"}</span></div>
    <div aria-live="polite" role="status" className="space-y-2 text-xs">
      {notice && <p className="rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">{(bm ? NOTICES_BM : NOTICES)[notice]} {route?.found ? (bm ? "Laluan semasa dipaparkan di bawah." : "The current route is shown below.") : ""}</p>}
      <p className="font-semibold text-stone-900">{route ? (bm ? ROUTE_MESSAGES_BM : ROUTE_MESSAGES)[route.outcome] : notice ? (bm ? ROUTE_MESSAGES_BM.conditions_unavailable : ROUTE_MESSAGES.conditions_unavailable) : bm ? "Menunggu bacaan pertama simulator telefon…" : "Waiting for the phone simulator’s first readings…"}</p>
      {route?.found && <>
        <p className="font-bold text-violet-900">{route.destination_name} · {route.distance_m} m</p>
        <p>{route.distance_m === 0 ? (bm ? "Sudah berada di titik destinasi pada peta." : "Already at the mapped destination anchor.") : bm ? "Laluan ke titik yang kekal tidak banjir dalam demo asas." : "Walking route to a point that stayed unflooded throughout the baseline demo."}</p>
        {route.uses_amber ? <p className="font-semibold text-amber-900">{bm ? "Laluan ini merangkumi jalan berisiko banjir. Keadaan boleh bertambah buruk." : "This route includes streets at flood risk. Conditions may worsen."}</p> : <p>{bm ? "Tiada jalan merah dalam simulasi semasa." : "No red streets in the current simulation."}</p>}
      </>}
    </div>
    {envelope && streets.length > 0 && <RouteMap streets={streets} envelope={envelope} />}
    {envelope && <p className="text-[11px] text-stone-600">Phone/server simulation · {envelope.conditions === "frozen" ? "Frozen simulated conditions" : envelope.conditions} · checked {new Date(envelope.calculated_at).toLocaleTimeString("en-MY")}</p>}
    <p className="text-[11px] text-stone-500">{bm ? "Titik demo dipilih melalui simulasi, bukan pusat perlindungan yang disahkan. Laluan bermula dari titik jalan yang anda sahkan. Perjalanan tidak dijejak. Akses pejalan kaki dan kerusi roda belum disahkan." : "Simulation-selected road points, not verified shelters. Routes start at your confirmed mapped location and do not track your journey. Pedestrian and wheelchair access are unverified."}</p>
    <button type="button" onClick={onHelp} className="min-h-11 w-full rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-bold text-rose-800">{language === "bm" ? "Saya perlukan bantuan" : "I need help"}</button>
  </section>;
}
