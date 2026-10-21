"use client";
import type { LocalTownship } from "./township-db";
export async function shareTownship(township: LocalTownship) {
  const { area, drains, streets } = township.data;
  const res = await fetch("/api/township/shared", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ area, drains, streets }), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("This downloaded township could not be shared with phones. Try reopening it on the dashboard.");
}
