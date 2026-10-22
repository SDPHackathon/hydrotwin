// Subtitle phrases from a voice line's word timings: break at clause punctuation, split long
// clauses where the halves balance, never inside a name ("Jalan Gamelan 1F", "Sime Darby
// Property") or after a small word ("the", "a"), and fold a short lead-in into the next part.
// Pure (no React) so it can be checked from Node: node scripts/voice/phrases-audit.ts
export type Wd = { word: string; start: number; end: number };

export const MAX = 46; // characters per subtitle phrase
const chars = (ws: Wd[]) => ws.reduce((n, w) => n + w.word.length + 1, 0) - 1;
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "");
// Never break after these: articles, prepositions, possessives, determiners, and the script's adjectives.
const HOLD = new Set(
  ("a an the of to on in at for by with from into around and or her his its their our your every each all this these those " +
    "new live real digital same deepest nearest walking vulnerable automated working retention").split(" "),
);
// Breaking just before these reads naturally; conjunctions most of all.
const BEFORE: Record<string, number> = Object.fromEntries([
  ...["and", "or", "but", "if", "when", "where", "who", "what", "how", "which", "that", "then", "instead"].map((w) => [w, 20]),
  ...["to", "from", "with", "for", "in", "on", "at", "by", "into", "around"].map((w) => [w, 14]),
  ...["a", "an", "the"].map((w) => [w, 10]),
]);
const NUMBER = /^(\d[\d.,-]*|zero|one|two|three|four|five|six|seven|eight|nine|ten|point|hundred|thousand|million|billion)$/;
const capital = (w: string) => /^[\p{Lu}\p{N}]/u.test(w);

// May the line break between ws[i] and ws[i + 1]?
const breakable = (ws: Wd[], i: number) => {
  const a = ws[i].word;
  const b = ws[i + 1].word;
  if (HOLD.has(bare(a))) return false; // "the | outcome", "every | reading"
  if (capital(a) && capital(b) && !/[,.;:!?]$/.test(a)) return false; // "Gamelan | 1F", "Bukit | Raja"
  if (NUMBER.test(bare(a)) && NUMBER.test(bare(b))) return false; // "six | point one billion"
  return true;
};

function split(ws: Wd[]): Wd[][] {
  if (chars(ws) <= MAX || ws.length < 2) return [ws];
  let best = -1;
  let cost = Infinity;
  for (let i = 0; i < ws.length - 1; i++) {
    if (!breakable(ws, i)) continue;
    const l = chars(ws.slice(0, i + 1));
    const r = chars(ws.slice(i + 1));
    const c = Math.abs(l - r) - (BEFORE[bare(ws[i + 1].word)] ?? 0) + (l > MAX ? 400 : 0) + (r > MAX ? 400 : 0);
    if (c < cost) [best, cost] = [i, c];
  }
  if (best < 0) return [ws];
  return [...split(ws.slice(0, best + 1)), ...split(ws.slice(best + 1))];
}

export function phrases(words: Wd[]): Wd[][] {
  const clauses: Wd[][] = [];
  let cur: Wd[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.?!:;,]$/.test(w.word)) {
      clauses.push(cur);
      cur = [];
    }
  }
  if (cur.length) clauses.push(cur);
  const parts = clauses.flatMap(split);
  const out: Wd[][] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    const ends = prev?.[prev.length - 1].word ?? "";
    const short = prev && (chars(prev) < 20 || chars(p) < 12);
    // a colon introduces what follows ("street: green, amber or red"), so nothing folds back into it
    if (prev && short && !/[.?!:]$/.test(ends) && chars(prev) + 1 + chars(p) <= MAX) prev.push(...p);
    else out.push([...p]);
  }
  return out;
}
