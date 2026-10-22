"use client";
import { useMemo } from "react";
import { buildDemoRefuges } from "@/lib/engine/demo-refuges";
import type { StreetFeature } from "@/lib/engine/route";
import type { Drain } from "@/lib/engine/types";
export function useSharedCatalogue(area: string, streets: StreetFeature[], drains: Drain[]) {
  return useMemo(() => {
    try { return { area, catalogue: buildDemoRefuges(area, streets, drains), error: null }; }
    catch { return { area, catalogue: null, error: "Could not assess demo refuge points for this township." }; }
  }, [area, streets, drains]);
}
