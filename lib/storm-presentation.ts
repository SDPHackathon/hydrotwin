// Display-only weather. The engine remains the authority for rainfall and drain status.
import { PEAK_MM_PER_MIN, rainAt, STORM_MINUTES } from "./engine/storm.ts";

export const REPLAY_END_MINUTE = STORM_MINUTES + 30;
export const PHONE_SYNC_TIMEOUT_MS = 6000;
export type StormPlayback = { minute: number; running: boolean; speed: number };
export type PhoneSync = "waiting" | "connected" | "lost";
export type StormPresentation = StormPlayback & {
  source: "local" | "phone";
  rainMmPerHour: number | null;
  phase: "ready" | "running" | "paused" | "draining" | "complete" | "waiting" | "lost" | "unavailable";
  label: string;
};

export function isStormPlayback(value: unknown): value is StormPlayback {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<StormPlayback>;
  return typeof state.minute === "number" && Number.isFinite(state.minute) && state.minute >= 0 &&
    typeof state.speed === "number" && Number.isFinite(state.speed) && state.speed > 0 &&
    typeof state.running === "boolean";
}

export function phoneSyncState(playback: StormPlayback, ageMs: unknown): PhoneSync {
  if (typeof ageMs !== "number" || !Number.isFinite(ageMs) || ageMs < 0) return "waiting";
  // Paused/complete snapshots need no heartbeat, but a running phone should keep sending ticks.
  return playback.running && playback.minute < REPLAY_END_MINUTE && ageMs >= PHONE_SYNC_TIMEOUT_MS ? "lost" : "connected";
}

export function presentStorm({ local, phone, usePhone, phoneSupported, sync }: {
  local: StormPlayback; phone: StormPlayback | null; usePhone: boolean; phoneSupported: boolean; sync: PhoneSync;
}): StormPresentation {
  const source = usePhone ? "phone" : "local";
  if (usePhone && (!phoneSupported || sync !== "connected" || !phone)) {
    const phase = !phoneSupported ? "unavailable" : sync === "lost" ? "lost" : "waiting";
    const label = phase === "unavailable" ? "Phone sync is available for Bukit Raja only" :
      phase === "lost" ? "Phone sync lost" : "Waiting for phone sync";
    return { source, minute: 0, speed: 1, running: false, rainMmPerHour: null, phase, label };
  }
  const playback = usePhone ? phone! : local;
  const rainMmPerHour = Math.round(rainAt(playback.minute) * 60);
  const finished = playback.minute >= REPLAY_END_MINUTE;
  const running = playback.running && !finished;
  const phase = finished ? "complete" : running ? (rainMmPerHour === 0 && playback.minute > 0 ? "draining" : "running") :
    playback.minute === 0 ? "ready" : "paused";
  const label = phase === "complete" ? "Demo storm complete" : phase === "ready" ? "Demo storm ready" :
    phase === "paused" ? (rainMmPerHour === 0 ? "Demo replay paused · rain ended" : "Demo storm paused") :
      phase === "draining" ? "Rain ended · drains emptying" : "Demo storm running";
  return { ...playback, source, running, rainMmPerHour, phase, label };
}

// Artistic parameters, not measured raindrop velocities. Playback never changes mm/h.
export function rainAppearance(rainMmPerHour: number | null, speed: number, pixels: number) {
  const intensity = Math.max(0, Math.min(1, (rainMmPerHour ?? 0) / (PEAK_MM_PER_MIN * 60)));
  const area = Math.max(0.2, Math.min(1.25, pixels / 900_000));
  return {
    count: intensity === 0 ? 0 : Math.ceil((35 + 235 * intensity) * area),
    velocity: (180 + 240 * intensity) * Math.min(2.5, Math.sqrt(Math.max(1, speed))),
    length: 9 + 16 * intensity,
    opacity: 0.24 + 0.18 * intensity,
  };
}
