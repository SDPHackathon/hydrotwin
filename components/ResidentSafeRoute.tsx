"use client";
import dynamic from "next/dynamic";
import type { RouteEnvelope, RouteChange } from "@/lib/engine/evacuation";
import type { StreetFeature } from "@/lib/engine/route";
import { ROUTE_MESSAGES, ROUTE_MESSAGES_BM } from "@/lib/evacuation/messages";
import { googleMapsWalkingUrl } from "@/lib/evacuation/google-maps";
import ResidentSectionHeading from "@/components/ResidentSectionHeading";
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
export default function ResidentSafeRoute({ envelope, notice, language, streets }: {
  envelope: RouteEnvelope | null; notice: RouteChange | null; language: "en" | "bm"; streets: StreetFeature[];
}) {
  const route = envelope?.route;
  const bm = language === "bm";
  const mapsUrl = googleMapsWalkingUrl(route);
  return <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
    <div className="flex items-center justify-between gap-2"><ResidentSectionHeading kind="route" title={bm ? "Laluan pemindahan demo" : "Demo evacuation route"} /><span className="shrink-0 rounded bg-stone-100 px-2 py-1 text-[10px] font-semibold tracking-wide text-stone-500">{bm ? "SIMULASI" : "SIMULATION"}</span></div>
    <div aria-live="polite" role="status" className="space-y-2 text-xs">
      {notice && <p className="rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">{(bm ? NOTICES_BM : NOTICES)[notice]} {route?.found ? (bm ? "Laluan semasa dipaparkan di bawah." : "The current route is shown below.") : ""}</p>}
      <p className="font-semibold text-stone-900">{route ? (bm ? ROUTE_MESSAGES_BM : ROUTE_MESSAGES)[route.outcome] : notice ? (bm ? ROUTE_MESSAGES_BM.conditions_unavailable : ROUTE_MESSAGES.conditions_unavailable) : bm ? "Menunggu bacaan pertama simulator telefon…" : "Waiting for the phone simulator’s first readings…"}</p>
      {route?.found && <>
        <p className="text-sm font-semibold text-stone-900">{route.destination_name} · {route.distance_m} m</p>
        <p>{route.distance_m === 0 ? (bm ? "Sudah berada di titik destinasi pada peta." : "Already at the mapped destination anchor.") : bm ? "Laluan ke titik yang kekal tidak banjir dalam demo asas." : "Walking route to a point that stayed unflooded throughout the baseline demo."}</p>
        {route.uses_amber ? <p className="font-semibold text-amber-900">{bm ? "Laluan ini merangkumi jalan berisiko banjir. Keadaan boleh bertambah buruk." : "This route includes streets at flood risk. Conditions may worsen."}</p> : <p>{bm ? "Tiada jalan merah dalam simulasi semasa." : "No red streets in the current simulation."}</p>}
      </>}
    </div>
    {route?.outcome === "origin_blocked" && <p className="text-xs text-stone-600">{bm ? "Titik selamat masih ditunjukkan pada peta. Jangan meredah air banjir untuk mencapainya." : "Safe points are still shown on the map. Do not walk through floodwater to reach them."}</p>}
    {envelope && streets.length > 0 && <RouteMap streets={streets} envelope={envelope} language={language} />}
    {mapsUrl && <div>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-center text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        {bm ? "Buka dalam Google Maps" : "Open in Google Maps"}<span aria-hidden="true">↗</span>
      </a>
    </div>}
  </section>;
}
