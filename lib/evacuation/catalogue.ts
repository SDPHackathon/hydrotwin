import "server-only";
import { readSharedTownship } from "@/lib/shared-townships";
import { buildDemoRefuges, drainFingerprint } from "@/lib/engine/demo-refuges";
import { roadFingerprint, type EvacuationCatalogue } from "@/lib/engine/evacuation";
const cache = new Map<string, EvacuationCatalogue>();

export async function loadEvacuationCatalogue(area: string) {
  const bundle = await readSharedTownship(area);
  if (!bundle) return null;
  const key = `${area}:${roadFingerprint(bundle.streets.features)}:${drainFingerprint(bundle.drains)}`;
  if (!cache.has(key)) cache.set(key, buildDemoRefuges(area, bundle.streets.features, bundle.drains));
  return structuredClone(cache.get(key)!);
}
