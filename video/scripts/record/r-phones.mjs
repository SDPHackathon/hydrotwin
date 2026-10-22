// v3 scenes 6–7 — one continuous take of two phones, following the deck's demo (slide 9):
// a resident on Jalan Gamelan 1F confirms her street and gets a route to a demo dry point;
// the storm floods drain zone D08, her street turns red and the walking route is withdrawn;
// she asks for help; Guard Rahim gets it, goes, and resolves it with an outcome.
// The storm is the app's own engine pushed to the server (feed.mjs), as /control does.
// Writes public/rec/r-resident.mp4 + r-guard.mp4 and r-phones.json (time marks + tap positions).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, PHONE, APP, OUT, wait } from "./rig.mjs";
import { stormFeed } from "./feed.mjs";

const NAME = "Aina"; // fictional resident
const feed = stormFeed();
await feed.reset();
await feed.jumpTo(40); // before the rain peaks: every street still green
feed.hold();

// One browser per phone: two pages in one headless browser capture the second at the wrong size.
const [b1, b2] = [await launch(), await launch()];
const gctx = await b1.newContext(PHONE);
await gctx.addInitScript(() => localStorage.setItem("hydrotwin_guard_name", "Rahim"));
const guard = await gctx.newPage();
const res = await (await b2.newContext(PHONE)).newPage();
await guard.goto(APP + "/guard");
await res.goto(APP + "/resident");
await guard.locator("#guard-select").selectOption({ label: "Guard Rahim" });
await wait(2500);

const stopG = await capture(guard, "r-guard");
const stopR = await capture(res, "r-resident");
const t0 = Date.now();
const since = () => +((Date.now() - t0) / 1000).toFixed(2);
const marks = { taps: [] };
const mark = (k) => (marks[k] = since());
const until = async (page, text, key, timeout = 20000) => {
  try {
    await page.getByText(text).first().waitFor({ timeout });
    mark(key);
  } catch {
    console.warn(`missed: ${key} (${text})`);
  }
};
// Taps are logged in CSS pixels of the 390×844 phone, for ripples and callouts in the edit.
const tap = async (page, phone, loc, label) => {
  const b = await loc.boundingBox();
  marks.taps.push({ phone, label, t: since(), x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  await loc.click();
};
const scrollTo = async (page, loc, offset = 96) => {
  await loc.evaluate((el, off) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" }), offset);
  await wait(900);
};

await wait(1200);
await tap(guard, "guard", guard.getByRole("button", { name: /Start shift/ }), "Start shift");

// Resident: find and confirm the street.
const search = res.locator("#resident-street-search");
await tap(res, "resident", search, "search");
await search.pressSequentially("Gamelan 1F", { delay: 85 });
const result = res.locator("#resident-location-results button", { hasText: "Gamelan 1F" }).first();
await result.waitFor();
mark("results");
await wait(900);
await tap(res, "resident", result, "Gamelan 1F");
const confirm = res.getByRole("button", { name: /starting point/i });
await confirm.waitFor();
await wait(1400);
await tap(res, "resident", confirm, "Use this starting point");
mark("confirmed");
await until(res, /Green in the current simulation/, "green");
await until(res, "Demo route available", "route");
await scrollTo(res, res.getByText("Demo route available").first(), 140);
await wait(3500); // the route map paints

// The storm: D08 turns amber at minute 60 and red at 90 — the resident's street.
mark("stormStart");
const flood = feed.runTo(95, 4);
await until(res, /Elevated flood risk/, "amber", 30000);
await until(res, /Street flooded/, "red", 30000);
await until(res, /starting street is flooded/, "withdrawn", 15000);
await flood;
feed.hold();
mark("stormHeld");
await until(guard, "Pak Dollah", "autoTasks", 10000);
await wait(2500);

// Every screen in Bahasa Melayu, and back.
await scrollTo(res, res.locator("body"), 0);
const lang = res.getByRole("button", { name: "Change language" });
await tap(res, "resident", lang, "BM");
mark("bm");
await wait(2200);
await tap(res, "resident", lang, "EN");
mark("en");
await wait(1000);

// She asks for help.
const helpBtn = res.getByRole("button", { name: "I need help" });
await scrollTo(res, helpBtn, 220);
await tap(res, "resident", helpBtn, "I need help");
mark("form");
await wait(900);
const name = res.getByLabel("Name", { exact: true });
await tap(res, "resident", name, "Name");
await name.pressSequentially(NAME, { delay: 90 });
await wait(500);
await res.getByLabel("Help needed").selectOption("trapped"); // "Trapped / cut off"
mark("helpType");
await wait(700);
const people = res.getByLabel("People needing help");
await tap(res, "resident", people, "people");
await people.fill("3");
await wait(500);
const note = res.getByLabel(/Optional note/);
await tap(res, "resident", note, "note");
await note.pressSequentially("Mother uses a wheelchair", { delay: 55 });
await wait(700);
await tap(res, "resident", res.getByRole("button", { name: "Send help request" }), "Send help request");
mark("sent");

// The guard: the SOS lands next to the auto-flagged vulnerable residents.
const card = guard.locator("div.rounded-xl.p-4", { hasText: NAME }).first();
await card.waitFor({ timeout: 15000 });
mark("sos");
await scrollTo(guard, card, 120);
await wait(1500);
await tap(guard, "guard", card.getByRole("button", { name: "Route", exact: true }), "Route");
mark("guardRoute");
await wait(6500); // the route map paints its tiles
await tap(guard, "guard", guard.getByRole("button", { name: "Close route" }), "Close route");
await wait(900);
await tap(guard, "guard", card.getByRole("button", { name: "On my way" }), "On my way");
mark("onTheWay");
await until(res, /on the way/i, "residentOnTheWay");
const cancel = res.getByRole("button", { name: "Cancel request" });
await scrollTo(res, cancel, 360);
const cb = await cancel.boundingBox();
marks.cancelBox = { x: Math.round(cb.x), y: Math.round(cb.y), w: Math.round(cb.width), h: Math.round(cb.height) };
await wait(3500);

// Resolved, with an outcome, on both phones.
await tap(guard, "guard", card.getByRole("button", { name: /Resolved/ }), "Resolved");
// The outcome picker is a modal without a dialog role — scope by its overlay.
const dialog = guard.locator("div.fixed.inset-0").filter({ hasText: "Select Outcome" });
await dialog.waitFor();
mark("outcomeDialog");
await wait(1200);
await tap(guard, "guard", dialog.getByLabel("Evacuated"), "Evacuated");
await wait(800);
await tap(guard, "guard", dialog.getByRole("button", { name: /Confirm & Resolve/ }), "Confirm & Resolve");
mark("resolved");
await until(res, "Evacuated", "residentResolved");
await wait(3500);
mark("end");

await stopG();
await stopR();
feed.stop();
writeFileSync(join(OUT, "r-phones.json"), JSON.stringify(marks, null, 2));
console.log(JSON.stringify({ ...marks, taps: marks.taps.length }, null, 1));
await b1.close();
await b2.close();
await feed.reset();
