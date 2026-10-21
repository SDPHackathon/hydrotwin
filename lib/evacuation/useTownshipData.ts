"use client";
import { useEffect, useState } from "react";
import { parseRouteTownship, type RouteTownship } from "@/lib/engine/township";
type Area = RouteTownship["area"];
export function useTownshipData() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [slug, setSlug] = useState("bukit-raja");
  const [data, setData] = useState<{ slug: string; bundle: RouteTownship | null; error: string | null }>({ slug, bundle: null, error: null });
  useEffect(() => {
    let active = true, first = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("/api/township/shared", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (!res.ok) throw new Error("Townships unavailable");
        const { areas: available } = await res.json() as { areas: Area[] };
        if (active) {
          setAreas(available);
          if (first) {
            const query = new URLSearchParams(window.location.search).get("area");
            if (query && /^[a-z0-9][a-z0-9-]{0,79}$/.test(query)) setSlug(query);
          }
          first = false;
        }
      } catch { /* Bundle loader exposes an actionable error independently. */ }
      finally { if (active) timer = setTimeout(load, 10000); }
    };
    void load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch(`/api/township/shared?area=${encodeURIComponent(slug)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (!res.ok) throw new Error("Open this township on the laptop dashboard to share it with phones.");
        const bundle = parseRouteTownship(await res.json());
        if (!controller.signal.aborted) setData({ slug, bundle, error: null });
      } catch (error) {
        if (!controller.signal.aborted) {
          setData({ slug, bundle: null, error: error instanceof Error ? error.message : "Township unavailable" });
          timer = setTimeout(load, 5000);
        }
      }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [slug]);
  const select = (next: string) => {
    setSlug(next);
    const url = new URL(window.location.href); url.searchParams.set("area", next); window.history.replaceState({}, "", url);
  };
  return { areas, slug, select, bundle: data.slug === slug ? data.bundle : null, error: data.slug === slug ? data.error : null };
}
