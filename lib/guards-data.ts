import type { GuardPost } from "./engine/help";

// FICTIONAL guard posts and guards (AGENTS.md rule 8). Both posts sit on streets that stay off red
// for the whole demo storm (checked in tests/help.test.ts): Jalan Gamelan 1D (D04) covers the
// Gamelan / Batu Belah side, Jalan Cendana 9 (D10, the high ground) covers the Zapin / Cendana
// estate. Two posts because the OSM extract leaves those two parts of the road network unconnected
// (see docs/data-contracts.md › Responder route); the router picks whichever can reach the resident.
export const GUARD_POSTS: GuardPost[] = [
  { id: "post-gamelan", name: "Pondok Pengawal Gamelan", street_id: "w767416157" },
  { id: "post-cendana", name: "Pondok Pengawal Cendana", street_id: "w164812591" },
];

// Display names a guard picks on /guard — there is no guard login in the demo.
export const GUARDS = ["Rahim", "Lim Wei", "Kavitha"];
