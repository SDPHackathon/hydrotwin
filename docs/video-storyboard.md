# Pitch video — storyboard (v3)

**Owner:** Azim · **Length:** 2:38 as built, draft 1, 23 Oct (limit 5:00) · 1920×1080, 30 fps
**Sound:** AI voice-over (ElevenLabs, premade voice "George", `eleven_multilingual_v2`) + subtitles timed to its words; rain under the opening; music ducked under the voice.
**Look:** the team deck's treatment (`HydroTwin_Pitch.pptx`) — a softly blurred photo under a forest veil, Georgia headings, forest / cream / gold — over a township under storm clouds (AI-generated, see `third-party.md`). Bukit Raja's streets drawn in gold are the recurring device; the real app appears in browser and phone frames.
**Built with:** Remotion in `video/` (composition `HydroTwinV3`, code in `video/src/v3/`) + scripted screen recordings of the production build (`video/scripts/record/r-*.mjs`). v2 (captions only, 3:48) stays renderable as composition `HydroTwin`.

MG = motion graphics · REC = screen recording of HydroTwin. The voice line of each scene is in `video/scripts/voice/lines.json`; scenes are cut to it.

| # | Time | On screen | Voice-over | Deck |
|---|---|---|---|---|
| 1 | 0:00 | MG — rain over the landscape; the town draws itself in gold; Jalan Makyong turns red on its name; "Across Malaysia, 2021" → RM6.1 billion | "On the fourth of June, 2023, two hours of rain flooded Phase 1 of Bandar Bukit Raja. Jalan Makyong was among the worst hit. Across Malaysia, the 2021 floods cost six point one billion ringgit." | — |
| 2 | 0:15 | MG — "A map alone can't tell anyone what to do next." Three moments: planners / residents / guards | "But a map alone can't tell anyone what to do next. Planners need to know … And guards need to know who needs help, and where." | 2 |
| 3 | 0:29 | MG — flood wipe → HydroTwin, "Township flood simulation and coordinated response"; dashboard, phones and guard desk join one town | "HydroTwin gives all three the same live picture …" | 1, 3 |
| 4 | 0:39 | MG — real context (township data) → simulated behaviour (storm + risk engine rules) → a status per street (the engine's output at minute 100) | "It's built on real map data: 199 streets … green, amber or red." | 4, 5 |
| 5 | 0:56 | REC dashboard at 4×, sped up further (labelled): D08 floods first, the spread, the live counts | "Here is the live dashboard during a simulated 126-millimetre-an-hour storm …" | 5 |
| 6 | 1:09 | REC resident phone: Jalan Gamelan 1F confirmed → green → route to a demo dry point → D08 overflows → "Street flooded", route withdrawn → BM | "On her phone, a resident on Jalan Gamelan 1F confirms her street …" | 7, 9 |
| 7 | 1:30 | REC resident + guard phones (same take): help request (Aina, fictional) → SOS beside the auto-flagged vulnerable residents → route around deep water → on my way → cancel shown → resolved, outcome "Evacuated" | "So she asks for help … When it's done, the guard records the outcome." | 8, 9 |
| 8 | 1:54 | REC Plan mode: bigger drains D05 + D06 → 142 to 83 flooded streets; ponds D08 + D07 → 57; replay | "Before the next storm, planners use Plan mode …" | 6 |
| 9 | 2:12 | MG — 112 automated tests; next: verify shelters and walking access, real drain sensors, pilot in one phase, every SDP township | "HydroTwin is a working prototype, backed by 112 automated tests …" | 10 |
| 10 | 2:29 | MG end card — tagline, team, repo, honesty line, AI + sources | "HydroTwin. Warn residents today. Plan a township that floods less tomorrow." | 10 |

## Rebuilding
1. **App:** `npm run build && npm run start -- -p 3002` in the repo root (a fresh server: help requests live in its memory).
2. **Recordings** (in `video/`): `APP_URL=http://localhost:3002 node scripts/record/r-phones.mjs` (and `r-dashboard`, `r-plan`). Each writes `public/rec/<name>.mp4` + a `.json` of time marks; the scenes read the JSON, so new takes line up by themselves.
3. **Voice:** edit `scripts/voice/lines.json`, then `node scripts/voice/tts.mjs all <voiceId> [v03 …]` (key from `~/.config/elevenlabs/api-key`, never in the repo). It regenerates `src/v3/voice.ts`; scene lengths and cues follow.
4. **Render:** `npx remotion render HydroTwinV3 out/hydrotwin-v3.mp4`. Single frames: `node scripts/stills.mjs <dir> V05-Dashboard:9s …`.

## Facts on screen
| Claim | Source | Status |
|---|---|---|
| 4 June 2023: rain "for over two hours"; Phase 1, "especially the Jalan Makyong area, was badly hit" | [The Star, 5 Jun 2023](https://thestar.com.my/news/nation/2023/06/05/dramatic-day-in-klang-due-to-floods) | checked |
| RM6.1 billion losses from the 2021 floods | DOSM, *Special Report on the Impact of Floods in Malaysia 2021* — reported by [The Vibes](https://www.thevibes.com/articles/news/78370/floods-caused-rm6.1-bil-overall-losses-in-2021-dosm), [Malaysiakini](https://m8.malaysiakini.com/en/news/608782) | checked |
| 199 streets, 10 drain zones, 126 mm/h demo storm | `public/data/bukit-raja/` and `lib/engine/storm.ts` | from the code |
| D08 floods first (minute 90), then D07 (91) | the engine: `node video/scripts/demo-status.ts` (re-run 23 Oct, unchanged) | from the code |
| 142 → 83 flooded streets (bigger drains D05 + D06); 57 with ponds D08 + D07; deepest water 52.7 → 12.8 cm | the app's Before vs After panel, recorded 23 Oct (`video/public/rec/r-plan.json`) | from the app; matches deck slide 6 |
| Guard route 156 m dry + 157 m through water | the guard page in the recording | from the app |
| 112 automated tests | `npm test` on main `e832c03`, 23 Oct | checked |

No number goes on screen without a source. The simplifications are said on screen: "Simulated storm, sped up" over the recordings and the deck's honesty line on the end card.
