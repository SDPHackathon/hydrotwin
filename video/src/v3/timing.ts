import { VOICE, type Word } from "./voice";

// Breathing room in the demo scenes (Azim, 23 Oct: "too fast"): a pause, in seconds, after the
// word written exactly as here. The voice files stay as generated — the line is played in pieces,
// cut in the silence between two words (every cut point has ≥ 0.14 s of silence).
export const PAUSES: Record<string, [word: string, seconds: number][]> = {
  v05: [["storm.", 1.0], ["first,", 0.6]],
  v06: [["street.", 0.8], ["point.", 1.2], ["floods,", 0.6], ["water.", 1.0]],
  v07: [["people.", 1.0], ["zone.", 1.2], ["way.", 0.6], ["safe.", 0.8]],
  v08: [["mode.", 0.6], ["83.", 1.0], ["57,", 0.6]],
};
// Extra hold after the last word, so the footage can finish (s): the Plan replay.
const HOLD_END: Record<string, number> = { v08: 2.0 };

export type Piece = { from: number; to: number; at: number }; // play audio [from, to) at line time `at` (s)
export type Timed = { words: Word[]; pieces: Piece[]; duration: number };

const cache: Record<string, Timed> = {};

// A voice line with its pauses applied: shifted word times, the audio pieces, the new length.
export function timed(id: string): Timed {
  if (cache[id]) return cache[id];
  const line = VOICE[id];
  const after = new Map<number, number>();
  for (const [word, seconds] of PAUSES[id] ?? []) {
    const i = line.words.findIndex((w) => w.word === word);
    if (i < 0 || i === line.words.length - 1) throw new Error(`pause: "${word}" not inside ${id}`);
    after.set(i, seconds);
  }
  const words: Word[] = [];
  const pieces: Piece[] = [];
  let shift = 0;
  let from = 0;
  line.words.forEach((w, i) => {
    words.push({ ...w, start: w.start + shift, end: w.end + shift });
    const pause = after.get(i);
    if (pause === undefined) return;
    const cut = (w.end + line.words[i + 1].start) / 2;
    pieces.push({ from, to: cut, at: from + shift });
    shift += pause;
    from = cut;
  });
  pieces.push({ from, to: line.duration + 0.4, at: from + shift });
  return (cache[id] = { words, pieces, duration: line.duration + shift + (HOLD_END[id] ?? 0) });
}
