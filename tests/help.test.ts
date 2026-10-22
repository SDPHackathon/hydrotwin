import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyTaskAction, findResponderRoute, parseHelpName, parseHelpRequest, MAX_HELP_NAME_CHARS, MAX_NOTE_CHARS, WATER_PENALTY,
  type GuardPost,
} from "../lib/engine/help.ts";
import type { StreetFeature } from "../lib/engine/route.ts";
import type { Drain, GuardTask, Status } from "../lib/engine/types.ts";
import { readFileSync } from "node:fs";
import { GUARD_POSTS } from "../lib/guards-data.ts";
import { stepLevel } from "../lib/engine/sim.ts";
import { rainAt, STORM_MINUTES } from "../lib/engine/storm.ts";
import { assess } from "../lib/engine/risk.ts";

// --- help request ---------------------------------------------------------------------------

test("help names are required, bounded and normalized without excluding Unicode names", () => {
  assert.equal(parseHelpName("  Demo   Resident  "), "Demo Resident");
  assert.equal(parseHelpName("Demo José"), "Demo José");
  assert.equal(parseHelpName("A".repeat(MAX_HELP_NAME_CHARS)).length, MAX_HELP_NAME_CHARS);
  for (const value of [undefined, null, 4, {}, "", "   ", "A".repeat(MAX_HELP_NAME_CHARS + 1), "Demo\nResident", "Demo\u0000Resident"]) {
    assert.throws(() => parseHelpName(value));
  }
});

test("a bare check-in becomes a plain 'something else, 1 person' request", () => {
  const parsed = parseHelpRequest({});
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.request, { help_type: "other", people: 1, note: null });
});

test("help request keeps the type and people, trims the note, blanks an empty note", () => {
  const parsed = parseHelpRequest({ help_type: "medical", people: 3, note: "  insulin ran out  " });
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.request, { help_type: "medical", people: 3, note: "insulin ran out" });
  const blank = parseHelpRequest({ help_type: "trapped", note: "   " });
  assert.ok(blank.ok);
  assert.equal(blank.request.note, null);
});

test("help request rejects an unknown type, bad people counts and a long note", () => {
  assert.equal(parseHelpRequest({ help_type: "helicopter" }).ok, false);
  for (const people of [0, 11, 2.5, "2"]) assert.equal(parseHelpRequest({ people }).ok, false, `people ${people}`);
  assert.equal(parseHelpRequest({ note: "x".repeat(MAX_NOTE_CHARS + 1) }).ok, false);
  assert.equal(parseHelpRequest({ note: 42 }).ok, false);
});

// --- task lifecycle -------------------------------------------------------------------------

const openTask: GuardTask = {
  id: "t1", resident_id: "r1", resident_name: "Pak Dollah", needs: null, street_id: "s1",
  drain_id: "D08", state: "open", check_in_state: "need_help", created_at: "2026-10-17T10:00:00Z",
};

test("accept moves open → on_the_way with the responder and time, without mutating the input", () => {
  const result = applyTaskAction(openTask, "accept", "Guard Rahim", "2026-10-17T10:01:00Z");
  assert.ok(result.ok);
  assert.equal(result.task.state, "on_the_way");
  assert.equal(result.task.responder_name, "Guard Rahim");
  assert.equal(result.task.accepted_at, "2026-10-17T10:01:00Z");
  assert.equal(openTask.state, "open");
});

test("a task can be accepted once; resolve keeps the responder who accepted it", () => {
  const accepted = applyTaskAction(openTask, "accept", "Guard Rahim", "2026-10-17T10:01:00Z");
  assert.ok(accepted.ok);
  assert.equal(applyTaskAction(accepted.task, "accept", "Guard Lim", "2026-10-17T10:02:00Z").ok, false);
  const done = applyTaskAction(accepted.task, "resolve", null, "2026-10-17T10:20:00Z");
  assert.ok(done.ok);
  assert.equal(done.task.state, "done");
  assert.equal(done.task.responder_name, "Guard Rahim");
  assert.equal(done.task.done_at, "2026-10-17T10:20:00Z");
  assert.equal(applyTaskAction(done.task, "resolve", null, "2026-10-17T10:21:00Z").ok, false);
  assert.equal(applyTaskAction(done.task, "accept", null, "2026-10-17T10:21:00Z").ok, false);
});

test("resolve works straight from open (guard arrived without tapping On my way)", () => {
  const done = applyTaskAction(openTask, "resolve", "Guard Lim", "2026-10-17T10:20:00Z");
  assert.ok(done.ok);
  assert.equal(done.task.state, "done");
  assert.equal(done.task.responder_name, "Guard Lim");
  assert.equal(done.task.outcome, "other");
});

test("cancel moves open → cancelled with cancelled_at, without mutating the input", () => {
  const result = applyTaskAction(openTask, "cancel", null, "2026-10-17T10:05:00Z");
  assert.ok(result.ok);
  assert.equal(result.task.state, "cancelled");
  assert.equal(result.task.cancelled_at, "2026-10-17T10:05:00Z");
  assert.equal(openTask.state, "open");
});

test("cancel moves on_the_way → cancelled and preserves the responding guard", () => {
  const accepted = applyTaskAction(openTask, "accept", "Guard Rahim", "2026-10-17T10:01:00Z");
  assert.ok(accepted.ok);
  const cancelled = applyTaskAction(accepted.task, "cancel", null, "2026-10-17T10:04:00Z");
  assert.ok(cancelled.ok);
  assert.equal(cancelled.task.state, "cancelled");
  assert.equal(cancelled.task.responder_name, "Guard Rahim");
  assert.equal(cancelled.task.cancelled_at, "2026-10-17T10:04:00Z");
});

test("a done task cannot be cancelled; a cancelled task cannot be accepted, resolved, or re-cancelled", () => {
  const done = applyTaskAction(openTask, "resolve", "Guard Rahim", "2026-10-17T10:10:00Z");
  assert.ok(done.ok);
  assert.equal(applyTaskAction(done.task, "cancel", null, "2026-10-17T10:11:00Z").ok, false);

  const cancelled = applyTaskAction(openTask, "cancel", null, "2026-10-17T10:05:00Z");
  assert.ok(cancelled.ok);
  assert.equal(applyTaskAction(cancelled.task, "cancel", null, "2026-10-17T10:06:00Z").ok, false);
  assert.equal(applyTaskAction(cancelled.task, "accept", "Guard Rahim", "2026-10-17T10:06:00Z").ok, false);
  assert.equal(applyTaskAction(cancelled.task, "resolve", "Guard Rahim", "2026-10-17T10:06:00Z").ok, false);
});

test("resolve records the selected outcome and rejects invalid outcomes", () => {
  for (const outcome of ["assisted_upstairs", "evacuated", "confirmed_safe", "other"] as const) {
    const res = applyTaskAction(openTask, "resolve", "Guard Rahim", "2026-10-17T10:10:00Z", outcome);
    assert.ok(res.ok);
    assert.equal(res.task.outcome, outcome);
  }
  const withNote = applyTaskAction(
    openTask,
    "resolve",
    "Guard Rahim",
    "2026-10-17T10:10:00Z",
    "other",
    "  Delivered rations and blankets  ",
  );
  assert.ok(withNote.ok);
  assert.equal(withNote.task.outcome, "other");
  assert.equal(withNote.task.outcome_note, "Delivered rations and blankets");

  const tooLong = applyTaskAction(
    openTask,
    "resolve",
    "Guard Rahim",
    "2026-10-17T10:10:00Z",
    "other",
    "a".repeat(141),
  );
  assert.equal(tooLong.ok, false);

  const invalid = applyTaskAction(
    openTask,
    "resolve",
    "Guard Rahim",
    "2026-10-17T10:10:00Z",
    "teleported" as unknown as import("../lib/engine/types.ts").TaskOutcome,
  );
  assert.equal(invalid.ok, false);
});

// --- responder route ------------------------------------------------------------------------
// Grid in thousandths of a degree around Bukit Raja: one step ≈ 111 m east–west, ≈ 111 m north–south.

const LNG = 101.44, LAT = 3.08;
const at = (x: number, y: number) => [LNG + x / 1000, LAT + y / 1000];
const road = (id: string, zone: string, points: [number, number][]): StreetFeature => ({
  properties: { id, name: id, drain_id: zone, highway: "residential" },
  geometry: { type: "LineString", coordinates: points.map(([x, y]) => at(x, y)) },
});
const post = (id: string, street_id: string): GuardPost => ({ id, name: `Post ${id}`, street_id });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 3, `${actual} ≉ ${expected}`);

test("route runs dry roads to the resident's street and wades only its flooded half", () => {
  const streets = [
    road("post-rd", "P", [[0, 0], [1, 0]]),
    road("mid", "Q", [[1, 0], [2, 0]]),
    road("home", "R", [[2, 0], [3, 0], [4, 0]]),
  ];
  const route = findResponderRoute(streets, [post("p1", "post-rd")], "home", { P: "green", Q: "green", R: "red" });
  assert.equal(route.outcome, "found");
  assert.equal(route.post?.id, "p1");
  near(route.dry_m, 222);
  near(route.water_m, 111);
  assert.deepEqual(route.legs.map((l) => l.status), ["green", "red"]);
  assert.deepEqual(route.destination, at(3, 0));
  assert.deepEqual(route.coordinates, [at(0, 0), at(1, 0), at(2, 0), at(3, 0)]);
  assert.equal(route.uses_amber, false);
});

test("a dry detour beats a shorter road through water, up to the water penalty", () => {
  const streets = [
    road("post-rd", "P", [[0, 0], [1, 0]]),
    road("wet", "W", [[1, 0], [2, 0]]),
    road("dry", "Q", [[1, 0], [1, 1], [2, 1], [2, 0]]),
    road("home", "R", [[2, 0], [3, 0], [4, 0]]),
  ];
  assert.ok(WATER_PENALTY > 3, "the detour below is 3× longer than the wet road");
  const route = findResponderRoute(streets, [post("p1", "post-rd")], "home", { P: "green", W: "red", Q: "green", R: "red" });
  assert.equal(route.outcome, "found");
  near(route.dry_m, 444);
  near(route.water_m, 111);
});

test("picks the nearest post that can start; a post on a red street is skipped", () => {
  const streets = [
    road("far", "P", [[0, 0], [1, 0]]),
    road("link", "Q", [[1, 0], [2, 0], [3, 0]]),
    road("flooded-post", "R", [[3, 0], [4, 0]]),
    road("home", "H", [[4, 0], [5, 0], [6, 0]]),
  ];
  const posts = [post("near", "flooded-post"), post("far", "far")];
  const statuses = { P: "green", Q: "green", R: "red", H: "amber" } as const;
  const route = findResponderRoute(streets, posts, "home", statuses);
  assert.equal(route.outcome, "found");
  assert.equal(route.post?.id, "far");
  assert.equal(route.uses_amber, true);
  near(route.water_m, 111);
  const both = findResponderRoute(streets, posts, "home", { P: "red", Q: "green", R: "red", H: "amber" });
  assert.equal(both.outcome, "posts_blocked");
  assert.equal(findResponderRoute(streets, [], "home", statuses).outcome, "no_posts");
});

test("reports honestly when the resident cannot be reached or assessed", () => {
  const streets = [
    road("post-rd", "P", [[0, 0], [1, 0]]),
    road("island", "R", [[5, 5], [6, 5]]),
    road("mystery", "X", [[1, 0], [2, 0]]),
  ];
  const posts = [post("p1", "post-rd")];
  assert.equal(findResponderRoute(streets, posts, "island", { P: "green", R: "red", X: "green" }).outcome, "unreachable");
  assert.equal(findResponderRoute(streets, posts, "nowhere", { P: "green" }).outcome, "invalid_resident");
  assert.equal(findResponderRoute(streets, posts, "mystery", { P: "green" }).outcome, "resident_unknown");
});

// --- Bukit Raja data ------------------------------------------------------------------------

const dataFile = (name: string) =>
  JSON.parse(readFileSync(new URL(`../public/data/bukit-raja/${name}`, import.meta.url), "utf8"));

test("Bukit Raja: both guard posts stay off red streets for the whole demo storm", () => {
  const drains = dataFile("drains.json") as Drain[];
  const streets = (dataFile("streets.geojson") as { features: StreetFeature[] }).features;
  const postZones = GUARD_POSTS.map((post) => {
    const street = streets.find((s) => s.properties.id === post.street_id);
    assert.ok(street, `${post.id} is on a real street`);
    return { post, drain_id: street.properties.drain_id };
  });
  const history = Object.fromEntries(drains.map((d) => [d.id, [0]]));
  for (let minute = 1; minute <= STORM_MINUTES; minute++) {
    for (const d of drains) {
      const h = history[d.id];
      h.push(stepLevel(d, h[h.length - 1], rainAt(minute)));
      const status = assess(d, h.slice(-30)).status;
      for (const { post, drain_id } of postZones) {
        if (drain_id === d.id) assert.notEqual(status, "red", `${post.id} is red at minute ${minute}`);
      }
    }
  }
});

test("Bukit Raja: with D07/D08 red, a post reaches Pak Dollah and Cikgu Aminah, dry first", () => {
  const streets = (dataFile("streets.geojson") as { features: StreetFeature[] }).features;
  const statuses: Record<string, Status> = {
    D01: "green", D02: "green", D03: "amber", D04: "amber", D05: "amber",
    D06: "amber", D07: "red", D08: "red", D09: "green", D10: "green",
  };
  // Each resident is served by the post on their side of the (unconnected) road network, under 1 km away.
  for (const [street, who, postId] of [["w164812609", "Pak Dollah", "post-gamelan"], ["w164812569", "Cikgu Aminah", "post-cendana"]]) {
    const route = findResponderRoute(streets, GUARD_POSTS, street, statuses);
    assert.equal(route.outcome, "found", who);
    assert.equal(route.post?.id, postId, who);
    assert.ok(route.water_m > 0 && route.dry_m > 0, `${who}: ${route.dry_m} m dry, ${route.water_m} m water`);
    assert.ok(route.dry_m + route.water_m < 1000, `${who}: ${route.dry_m + route.water_m} m is not a short response`);
    assert.equal(route.legs[route.legs.length - 1].status, "red", who);
  }
});
