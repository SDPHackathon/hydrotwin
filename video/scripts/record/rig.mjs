// Recording rig: drives the real app in Chrome and captures crisp frames through the
// DevTools screencast (sharper than Playwright's built-in video), then turns them into
// a constant 30 fps MP4 with Remotion's bundled ffmpeg.
//
// The app must be running as a production build (`npm run build && npm run start -- -p 3001`
// in the repo root) — `next dev` reloads in a loop under headless Chrome.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const OUT = join(here, "../../public/rec");
export const APP = process.env.APP_URL ?? "http://localhost:3001";
const CHROME = process.env.REMOTION_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function launch() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} — set REMOTION_CHROME`);
  return chromium.launch({
    executablePath: CHROME,
    headless: true,
    // swiftshader = software WebGL, so the MapLibre map renders headless
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });
}

export const LAPTOP = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// Starts capturing a page. Returns stop() → writes <name>.mp4 into public/rec.
export async function capture(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize();
  const scale = (await page.evaluate(() => window.devicePixelRatio)) || 1;
  const frames = []; // { t: seconds, data: base64 jpeg }
  cdp.on("Page.screencastFrame", async (e) => {
    frames.push({ t: e.metadata.timestamp, data: e.data });
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId });
    } catch {}
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: Math.round(vp.width * scale),
    maxHeight: Math.round(vp.height * scale),
    everyNthFrame: 1,
  });
  const started = Date.now() / 1000;

  return async function stop() {
    const ended = Date.now() / 1000;
    await cdp.send("Page.stopScreencast").catch(() => {});
    if (!frames.length) throw new Error(`${name}: no frames captured`);
    const dir = join(OUT, `${name}-frames`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    // Constant 30 fps: each output frame shows the latest captured frame at that moment.
    const t0 = Math.min(started, frames[0].t);
    const n = Math.round((ended - t0) * 30);
    let j = 0;
    let last = null;
    for (let i = 0; i < n; i++) {
      const t = t0 + i / 30;
      while (j < frames.length && frames[j].t <= t) j++;
      const src = frames[Math.max(0, j - 1)];
      const file = join(dir, `${String(i).padStart(5, "0")}.jpg`);
      if (src === last && i > 0) copyFileSync(join(dir, `${String(i - 1).padStart(5, "0")}.jpg`), file);
      else writeFileSync(file, Buffer.from(src.data, "base64"));
      last = src;
    }
    const mp4 = join(OUT, `${name}.mp4`);
    execFileSync(
      "npx",
      ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", join(dir, "%05d.jpg"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", mp4],
      { cwd: join(here, "../.."), stdio: "inherit" },
    );
    rmSync(dir, { recursive: true, force: true });
    console.log(`rec: ${name}.mp4 — ${(n / 30).toFixed(1)} s, ${frames.length} source frames`);
    return mp4;
  };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
