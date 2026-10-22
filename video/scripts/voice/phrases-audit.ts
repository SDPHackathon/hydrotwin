// Prints every subtitle phrase of the film, to check the line breaks: node scripts/voice/phrases-audit.ts
import { readFileSync } from "node:fs";
import { phrases } from "../../src/v3/phrases.ts";

for (let i = 1; i <= 10; i++) {
  const id = `v${String(i).padStart(2, "0")}`;
  const line = JSON.parse(readFileSync(new URL(`./out/${id}.json`, import.meta.url), "utf8"));
  console.log(`${id}: ` + phrases(line.words).map((p) => p.map((w) => w.word).join(" ")).join("  |  "));
}
