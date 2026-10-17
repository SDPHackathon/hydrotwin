"use client";

// Runs the storm in this browser tab. Step B replaces this with readings from the phone
// control page → risk-engine Edge Function → Supabase Realtime (docs/progress.md).

import { useCallback, useEffect, useRef, useState } from "react";
import { assess } from "@/lib/engine/risk";
import { stepLevel } from "@/lib/engine/sim";
import { rainAt, STORM_MINUTES } from "@/lib/engine/storm";
import type { Drain, DrainStatus } from "@/lib/engine/types";

const END_MINUTE = STORM_MINUTES + 30; // keep going after the rain to watch drains empty
const HISTORY = 30;

const emptyHistories = (drains: Drain[]) => Object.fromEntries(drains.map((d) => [d.id, [0]]));
const statusesFrom = (drains: Drain[], histories: Record<string, number[]>) =>
  Object.fromEntries(drains.map((d) => [d.id, assess(d, histories[d.id])]));

export function useLocalStorm(drains: Drain[]) {
  const [minute, setMinute] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1); // simulated minutes per real second
  const minuteRef = useRef(0);
  const histories = useRef<Record<string, number[]>>(emptyHistories(drains));
  const [prevDrains, setPrevDrains] = useState(drains);
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>(() =>
    statusesFrom(drains, emptyHistories(drains)),
  );

  // When drains change (e.g. baseline vs with upgrades toggle, township switch),
  // adjust state during render (official React pattern) without accessing refs.
  if (drains !== prevDrains) {
    setPrevDrains(drains);
    setRunning(false);
    setMinute(0);
    setStatuses(statusesFrom(drains, emptyHistories(drains)));
  }

  // Update refs inside an effect (refs should only be written outside render).
  useEffect(() => {
    minuteRef.current = 0;
    histories.current = emptyHistories(drains);
  }, [drains]);

  const tick = useCallback(() => {
    const m = minuteRef.current;
    if (m >= END_MINUTE) {
      setRunning(false);
      return;
    }
    const rain = rainAt(m);
    for (const d of drains) {
      const h = histories.current[d.id] ?? (histories.current[d.id] = [0]);
      h.push(stepLevel(d, h.at(-1) ?? 0, rain));
      if (h.length > HISTORY) h.shift();
    }
    minuteRef.current = m + 1;
    setMinute(m + 1);
    setStatuses(statusesFrom(drains, histories.current));
  }, [drains]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 1000 / speed);
    return () => clearInterval(id);
  }, [running, speed, tick]);

  const reset = useCallback(() => {
    setRunning(false);
    histories.current = emptyHistories(drains);
    minuteRef.current = 0;
    setStatuses(statusesFrom(drains, histories.current));
    setMinute(0);
  }, [drains]);

  return {
    minute,
    rainMmPerHour: Math.round(rainAt(minute) * 60),
    running,
    finished: minute >= END_MINUTE,
    speed,
    statuses,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset,
    setSpeed,
  };
}
