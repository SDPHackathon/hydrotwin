import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Render with the Google Chrome already installed on this machine (macOS path, or
// REMOTION_CHROME), instead of downloading Remotion's 98 MB headless Chrome.
// Neither present → Remotion downloads its own, as usual.
const chrome = process.env.REMOTION_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (existsSync(chrome)) {
  Config.setBrowserExecutable(chrome);
  Config.setChromeMode("chrome-for-testing");
}
