// Shared shapes. Field names match the database (docs/data-contracts.md) — change both together.

export type Status = "green" | "amber" | "red";

export interface Drain {
  id: string; // "D01"
  name: string;
  lng: number;
  lat: number;
  elevation_m: number;
  bank_cm: number; // drain depth — water above this spills onto the streets
  catchment_factor: number; // cm of level rise per mm of rain (low ground > 1)
  outflow_cm_per_min: number; // how fast the drain empties
}

export interface DrainStatus {
  drain_id: string;
  level_cm: number;
  status: Status;
  rate_cm_per_min: number; // average over the last few minutes; > 0 = rising
  minutes_to_red: number | null; // null when red already or not rising
  street_depth_cm: number; // water on the street = level above the bank
}

export type InterventionKind = "bigger_drain" | "retention_pond" | "green_area";

export interface PlanIntervention {
  drain_id: string;
  kind: InterventionKind;
}

export interface ScenarioResult {
  streets_flooded: number;
  deepest_cm: number;
  minutes_to_first_red: number | null;
  flooded_drain_ids: string[];
}

export interface DemoResident {
  id: string;
  display_name: string;
  street_id: string;
  street_name?: string;
  drain_id: string;
  vulnerable: boolean;
  needs: string | null;
}

export interface GuardTask {
  id: string | number;
  resident_id: string;
  resident_name: string;
  needs: string | null;
  street_id: string;
  street_name?: string;
  drain_id: string;
  state: "open" | "done";
  check_in_state?: "safe" | "need_help" | null;
  created_at: string;
}

