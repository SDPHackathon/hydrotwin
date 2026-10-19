// Copies the township data the video draws (streets, buildings, drains) from the app's
// public/data into src/data as .json, so scenes can import it directly.
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "../../public/data/bukit-raja");
const to = join(here, "../src/data");
mkdirSync(to, { recursive: true });
for (const name of ["streets", "buildings"]) {
  copyFileSync(join(from, `${name}.geojson`), join(to, `${name}.json`));
}
copyFileSync(join(from, "drains.json"), join(to, "drains.json"));
console.log("video: copied streets + buildings + drains → src/data/");
