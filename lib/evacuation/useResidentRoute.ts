"use client";
import { useEffect, useState } from "react";
import { routeChange, withdrawRoute, type RouteChange, type RouteEnvelope } from "@/lib/engine/evacuation";
import type { RoadPoint } from "@/lib/engine/route";

interface RouteState { id: string; envelope: RouteEnvelope | null; notice: RouteChange | null; noticeId: number }
export function useResidentRoute(input: string | { area_slug: string; origin: RoadPoint } | null) {
  const legacy = typeof input === "string";
  const area = typeof input === "object" ? input?.area_slug : undefined;
  const street = typeof input === "object" ? input?.origin.street_id : undefined;
  const segment = typeof input === "object" ? input?.origin.position.segment_index : undefined;
  const fraction = typeof input === "object" ? input?.origin.position.fraction : undefined;
  const residentId = legacy ? input : input ? `${area}:${street}:${segment}:${fraction}` : "";
  const [state, setState] = useState<RouteState>({ id: residentId, envelope: null, notice: null, noticeId: 0 });
  useEffect(() => {
    if (!residentId) return;
    let active = true, fetching = false, deadline = 0, sequence = 0;
    let previous: RouteEnvelope | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const publish = (envelope: RouteEnvelope) => {
      if (!active) return;
      const notice = routeChange(previous, envelope);
      previous = envelope;
      if (notice) {
        try { navigator.vibrate?.([180, 100, 180]); } catch { /* Optional browser capability. */ }
      }
      setState((old) => ({ id: residentId, envelope, notice: notice ?? (old.id === residentId ? old.notice : null), noticeId: old.noticeId + (notice ? 1 : 0) }));
    };
    const poll = async () => {
      if (fetching || !active) return;
      fetching = true;
      const request = ++sequence;
      const startedAt = Date.now();
      try {
        const res = await fetch(legacy ? `/api/resident/safe-route?resident_id=${encodeURIComponent(residentId)}` : "/api/resident/safe-route", {
          method: legacy ? "GET" : "POST", headers: legacy ? undefined : { "Content-Type": "application/json" },
          body: legacy ? undefined : JSON.stringify({ area_slug: area, origin: { street_id: street, position: { segment_index: segment, fraction } } }),
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        if (!res.ok) throw new Error("Route unavailable");
        const envelope: RouteEnvelope = await res.json();
        if (envelope.version !== 1 || envelope.resident_id !== residentId || !envelope.route || !envelope.statuses ||
            !Number.isFinite(envelope.valid_for_ms) || envelope.valid_for_ms < 0) throw new Error("Invalid route envelope");
        if (!active || request !== sequence) return;
        deadline = startedAt + envelope.valid_for_ms;
        publish(Date.now() >= deadline && envelope.route.found ? withdrawRoute(envelope, "stale") : envelope);
      } catch {
        if (active && previous) publish(withdrawRoute(previous, "offline"));
        else if (active) setState({ id: residentId, envelope: null, notice: "unavailable", noticeId: 1 });
      } finally {
        fetching = false;
        if (active) timer = setTimeout(poll, 1500);
      }
    };
    const foreground = () => {
      if (document.visibilityState === "visible") {
        if (previous && Date.now() >= deadline && previous.route.found) publish(withdrawRoute(previous, "stale"));
        clearTimeout(timer);
        void poll();
      }
    };
    void poll();
    // Expiry is independent of request completion and incoming events.
    const expiry = setInterval(() => {
      if (previous && Date.now() >= deadline && ["current", "frozen"].includes(previous.conditions)) publish(withdrawRoute(previous, "stale"));
    }, 250);
    document.addEventListener("visibilitychange", foreground);
    return () => { active = false; sequence++; controller.abort(); clearTimeout(timer); clearInterval(expiry); document.removeEventListener("visibilitychange", foreground); };
  }, [residentId, legacy, area, street, segment, fraction]);
  // Discard old geometry synchronously when the selected identity changes.
  return state.id === residentId ? state : { id: residentId, envelope: null, notice: null, noticeId: 0 };
}
