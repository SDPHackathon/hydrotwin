// Storm feed for the phone scenes. The resident route and the guard desk follow the server's
// storm (what /control pushes), and a resident route is withdrawn once readings are older than
// 6 s — so, exactly like /control, this steps the app's own engine and posts every drain's level
// on each tick, and keeps re-posting while the storm is held.
import { readFileSync } from "node:fs";
import { rainAt } from "../../../lib/engine/storm.ts";
import { stepLevel } from "../../../lib/engine/sim.ts";
import { APP, wait } from "./rig.mjs";

const AREA = "bukit-raja";
const drains = JSON.parse(readFileSync(new URL("../../../public/data/bukit-raja/drains.json", import.meta.url), "utf8"));

export const post = (path, body) =>
  fetch(APP + path, { method: "POST", headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) });

export function stormFeed() {
  const level = Object.fromEntries(drains.map((d) => [d.id, 0]));
  let minute = 0;
  let running = false;
  let keepAlive = null;

  const push = () =>
    post(`/api/risk-engine?area=${AREA}`, {
      readings: drains.map((d) => ({ drain_id: d.id, level_cm: level[d.id], rain_mm: rainAt(minute), sim_minute: minute, source: "sim" })),
      minute,
      running,
      speed: 1,
    });
  const step = () => {
    const rain = rainAt(minute);
    for (const d of drains) level[d.id] = Math.round(stepLevel(d, level[d.id], rain) * 10) / 10;
    minute++;
  };

  return {
    get minute() {
      return minute;
    },
    async reset() {
      await post(`/api/risk-engine/reset?area=${AREA}`);
    },
    // Fast-forward (every minute posted, so the server's history matches a real run).
    async jumpTo(m) {
      while (minute < m) {
        step();
        await push();
      }
    },
    // Play the storm forward at `perSecond` storm minutes per second.
    async runTo(m, perSecond) {
      running = true;
      while (minute < m) {
        const t = Date.now();
        step();
        await push();
        await wait(Math.max(0, 1000 / perSecond - (Date.now() - t)));
      }
      running = false;
      await push();
    },
    // Re-post the current state every second so phone readings never go stale.
    hold() {
      clearInterval(keepAlive);
      keepAlive = setInterval(push, 1000);
    },
    stop() {
      clearInterval(keepAlive);
    },
  };
}
