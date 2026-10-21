import "server-only";
import { listAreas, loadArea } from "@/lib/area";
import { parseRouteTownship, type RouteTownship } from "@/lib/engine/township";
import { roadFingerprint } from "@/lib/engine/evacuation";
import { drainFingerprint } from "@/lib/engine/demo-refuges";

// Laptop demo registry. Existing IndexedDB downloads republish on dashboard startup.
const globalRegistry = globalThis as unknown as { __HYDROTWIN_SHARED_AREAS__?: Map<string, RouteTownship> };
const registry = globalRegistry.__HYDROTWIN_SHARED_AREAS__ ??= new Map();
export async function sharedTownships() {
  const builtins = await listAreas();
  return [...builtins, ...[...registry.values()].map((b) => b.area).filter((a) => !builtins.some((b) => b.slug === a.slug))];
}
export async function readSharedTownship(slug: string): Promise<RouteTownship | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return null;
  const cached = registry.get(slug);
  if (cached) return cached;
  const known = (await listAreas()).find((a) => a.slug === slug);
  if (!known) return null;
  const bundle = parseRouteTownship(await loadArea(known.slug));
  registry.set(slug, bundle);
  return bundle;
}
export async function registerSharedTownship(input: unknown) {
  const bundle = parseRouteTownship(input);
  const existing = await readSharedTownship(bundle.area.slug);
  if (existing) {
    if (roadFingerprint(existing.streets.features) !== roadFingerprint(bundle.streets.features) || drainFingerprint(existing.drains) !== drainFingerprint(bundle.drains)) throw new Error("This township ID already has a different network. Download it using a new name.");
    return existing;
  }
  if (registry.size >= 24) throw new Error("The demo session has reached its shared-township limit.");
  registry.set(bundle.area.slug, bundle);
  return bundle;
}
export async function boundedJson(request: Request, maximum = 8_000_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const chunks: Uint8Array[] = [];
  let count = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    count += value.byteLength;
    if (count > maximum) { await reader.cancel(); throw new Error("Request exceeds the demo limit"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
