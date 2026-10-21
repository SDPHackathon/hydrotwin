import type { RouteOutcome } from "@/lib/engine/route";
export const ROUTE_MESSAGES: Record<RouteOutcome, string> = {
  found: "Demo route available",
  no_destinations: "No shared evacuation destinations are available for this township.",
  invalid_origin: "The starting street is missing from the loaded road data.",
  origin_blocked: "Your starting street is flooded. No walking route from your location is available.",
  origin_unknown: "Your starting street has no current flood reading. No walking route is shown.",
  destination_unavailable: "No eligible open evacuation destination on a green street is available.",
  disconnected: "The mapped road network does not connect this origin to an eligible destination.",
  no_route: "Flooded roads or roads with unknown conditions prevent a route to an eligible destination.",
  conditions_unavailable: "Current road conditions are unavailable. Route guidance is paused.",
  catalogue_unavailable: "The shared destination catalogue is unavailable. Help remains available.",
};
export const ROUTE_MESSAGES_BM: Record<RouteOutcome, string> = {
  found: "Laluan demo tersedia",
  no_destinations: "Tiada destinasi pemindahan bersama untuk kawasan ini.",
  invalid_origin: "Jalan permulaan tiada dalam data peta.",
  origin_blocked: "Jalan permulaan anda dinaiki air. Tiada laluan berjalan kaki dari lokasi anda tersedia.",
  origin_unknown: "Tiada bacaan banjir semasa untuk jalan permulaan anda. Tiada laluan dipaparkan.",
  destination_unavailable: "Tiada destinasi pemindahan layak yang dibuka pada jalan hijau.",
  disconnected: "Rangkaian jalan dalam peta tidak menghubungkan lokasi ini ke destinasi yang layak.",
  no_route: "Jalan dinaiki air atau keadaan tidak diketahui menghalang laluan ke destinasi yang layak.",
  conditions_unavailable: "Keadaan jalan semasa tidak tersedia. Panduan laluan dihentikan sementara.",
  catalogue_unavailable: "Senarai destinasi bersama tidak tersedia. Bantuan masih tersedia.",
};
