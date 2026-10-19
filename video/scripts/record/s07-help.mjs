// Scene 7 — the help loop on two phones: a resident on a flooded street asks for help,
// Guard Rahim gets it with a route around the deep water, goes, and resolves it.
// The resident is Tan Wei Ming (fictional, not vulnerable) so the full help form shows;
// the flood is set through the app's own API, the same call /control makes.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, PHONE, APP, OUT, wait } from "./rig.mjs";

const RESIDENT = "33333333-3333-4333-8333-333333333333"; // Tan Wei Ming, Jalan Gamelan 1F, D08
const post = (path, body) =>
  fetch(APP + path, { method: "POST", headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) });

await post("/api/risk-engine/reset");

// One browser per phone: two pages in one headless browser capture the second at the wrong size.
const browser = await launch();
const browser2 = await launch();
const gctx = await browser.newContext(PHONE);
await gctx.addInitScript(() => localStorage.setItem("hydrotwin_guard_name", "Rahim"));
const guard = await gctx.newPage();
const res = await (await browser2.newContext(PHONE)).newPage();
await guard.goto(APP + "/guard");
await res.goto(APP + "/resident");
await res.selectOption("#resident-select", RESIDENT);
await guard.getByLabel("On duty").selectOption("Rahim");
await wait(2500);

const stopG = await capture(guard, "s07-guard");
const stopR = await capture(res, "s07-resident");
const t0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = +((Date.now() - t0) / 1000).toFixed(2));

await wait(1500);
await guard.getByRole("button", { name: /Start shift/ }).click();
mark("shift");
await wait(2000);

// The storm reaches drain D08: water on Jalan Gamelan 1F.
await post("/api/risk-engine", { readings: [{ drain_id: "D08", level_cm: 150 }], minute: 95, running: true, speed: 1 });
mark("flood");
await res.getByText("water on the street").first().waitFor();
mark("residentRed");
await wait(2500);

await res.getByRole("button", { name: /I need help/i }).click();
mark("sheet");
await wait(1200);
await res.getByRole("group", { name: "Type of help" }).getByRole("button", { name: "Need help to evacuate" }).click();
await wait(700);
await res.getByRole("button", { name: "More people" }).click();
await wait(600);
await res.getByPlaceholder("e.g. back gate is open").pressSequentially("Mother uses a wheelchair", { delay: 55 });
await wait(900);
await res.getByRole("button", { name: /Send help request/ }).click();
mark("sent");

const card = guard.locator("div.rounded-xl.p-4", { hasText: "Tan Wei Ming" }).first();
await card.getByText("SOS").first().waitFor();
mark("sos");
await wait(2500);
await card.getByRole("button", { name: "Route", exact: true }).click();
mark("route");
await wait(8500); // the route map needs ~2 s to paint its tiles
await guard.getByRole("button", { name: "Close route" }).click();
await wait(900);
await card.getByRole("button", { name: "On my way" }).click();
mark("onTheWay");
await res.getByText("Guard Rahim is on the way").waitFor();
mark("residentSeesGuard");
await wait(4000);
await card.getByRole("button", { name: /^Resolved/ }).click();
mark("resolved");
await res.getByText("Guard Rahim responded").waitFor();
mark("residentResolved");
await wait(3000);
mark("end");

await stopG();
await stopR();
writeFileSync(join(OUT, "s07-help.json"), JSON.stringify(marks, null, 2));
console.log(marks);
await browser.close();
await browser2.close();
await post("/api/risk-engine/reset");
