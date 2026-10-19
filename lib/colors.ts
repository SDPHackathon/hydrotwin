import type { Status } from "@/lib/engine/types";

export const STATUS_COLOR: Record<Status, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
};

export const WATER_COLOR = "#2563eb";

// Keep route guidance visually separate from the green, amber, and red road statuses.
export const SAFE_ROUTE_COLOR = "#7c3aed";

// Draw with a white casing to stay visible over road statuses and blue water.
export const DEVELOPMENT_ACCESS_COLOR = "#111827";
