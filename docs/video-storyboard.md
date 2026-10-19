# Pitch video — storyboard

**Owner:** Azim · **Length:** 3:48 as built (limit 5:00) · 1920×1080, 30 fps · **Sound:** captions + music (no voice-over for now; music not added yet)
**Built with:** Remotion in `video/` (motion graphics) + scripted screen recordings of the real app (`video/scripts/record/`). Rough cut **Wed 21 Oct**.

MG = motion graphics · REC = screen recording of HydroTwin (production build, scripted with Playwright). Captions are the narration — each line below appears on screen.

| # | Time | On screen | Caption |
|---|---|---|---|
| 1 | 0:00–0:15 | MG — rain on a dark screen, the Bukit Raja street map draws in, the camera pushes into Phase 1, water rises, Jalan Makyong turns red | Over two hours of rain flooded Phase 1 of Bandar Bukit Raja. Jalan Makyong was among the worst hit. |
| 2 | 0:15–0:30 | MG — RM6.1 billion as the one hero number; the water below splits, Selangor's half brighter | Floods cost Malaysia RM6.1 billion in 2021. About half of it was in Selangor. |
| 3 | 0:30–0:55 | MG — three pins on the real map: a resident (Jalan Makyong 6), the guard post (Jalan Gamelan 1D), a planner on empty land | In a flash flood, minutes matter. · Which street floods next? Do we leave now? · Who needs help first? · Will a new phase make it worse? · Today, each of them is guessing. |
| 4 | 0:55–1:10 | MG — water covers the screen, drains away, the film turns light: wordmark, tagline, map tilts to 3D with the 10 drain sensors | Warn residents today. Plan a township that floods less tomorrow. · A digital twin of Bandar Bukit Raja's streets and drains. One map, three modes: Live, Safe Routes, Plan |
| 5 | 1:10–1:35 | MG — drain sensors → risk engine (the engine's own rules) → street status (the engine's real output at minute 100 of the demo storm) → alerts | From a drain sensor to a resident's phone, one street at a time. |
| 6 | 1:35–2:01 | REC laptop — the demo storm at the app's 4×, quiet part sped up 1.6× more (labelled); D08 red first, then the spread (106 flooded streets at 1:49) | A 126 mm/h storm hits the township. · Drain zone 8 turns red first. · Then the water spreads, street by street. |
| 7 | 2:01–2:33 | REC 2 phones — Tan Wei Ming (fictional) asks for help → Guard Rahim gets the SOS + route (156 m dry + 197 m through water) → on my way → resolved | Tan Wei Ming's street floods. · One tap asks for help. · Guard Rahim gets it instantly. · With a route around the deepest water. · The resident sees who's coming. · Resolved, on both phones. |
| 8 | 2:33–2:46 | REC — Safe Routes from minute 84: route to the Gamelan assembly point (305 m); D08 floods, it switches to Sumazau (321 m) | Residents who can leave get a walking route to the nearest safe point. · A road floods, and the route changes by itself. |
| 9 | 2:46–3:10 | REC — Plan: ponds at D08 + D07, bigger drains at D05 + D06; zoom on the app's Before vs After (142 → 57 flooded streets, 52.7 → 12.8 cm, first flood 90 → 107 min); replay sped up (labelled) | Plan mode is for tomorrow. · Add a retention pond or a bigger drain… · …and see it at once: 142 flooded streets become 57. · Then replay the same storm, before you build. |
| 10 | 3:10–3:32 | MG — what a township already has (guards, drains, phones) + the way in: pilot Phase 1 → real sensors → every SDP township | Built on what a township already has. |
| 11 | 3:32–3:48 | MG — wordmark, tagline, team, repo, honesty line, AI-use note, sources | Warn residents today. Plan a township that floods less tomorrow. |

**Decisions (19 Oct):** ~4 min · captions + music first · Plan scene = pond / drain upgrades (Danish's new-housing screening added if merged in time) · end card shows the 5 team names.

**Re-recording** (after app changes): `npm run build && npm run start -- -p 3001` in the repo root, then in `video/`: `node scripts/record/s06-storm.mjs` (and `s07-help`, `s08-routes`, `s09-plan`). Each writes `public/rec/<scene>.mp4` + a `.json` of timing marks; if the marks move, update the constants at the top of the matching scene file.

## Facts on screen
| Claim | Source | Status |
|---|---|---|
| 4 June 2023: rain "for over two hours"; Phase 1, "especially the Jalan Makyong area, was badly hit" | [The Star, 5 Jun 2023](https://thestar.com.my/news/nation/2023/06/05/dramatic-day-in-klang-due-to-floods) | checked |
| RM6.1 billion losses from the 2021 floods | DOSM, *Special Report on the Impact of Floods in Malaysia 2021* — reported by [The Vibes](https://www.thevibes.com/articles/news/78370/floods-caused-rm6.1-bil-overall-losses-in-2021-dosm), [Malaysiakini](https://m8.malaysiakini.com/en/news/608782) | checked |
| About half of it in Selangor | [The Star, 14 Nov 2022](https://thestar.com.my/news/nation/2022/11/14/flood-management-a-long-term-project) | one source — evidence owner to confirm |
| 78 people relocated, 20 families, high tide, ponds overflowing (June 2023) | seen in search results, original not opened | **not used** until confirmed |

No number goes on screen without a source. Sensor costs come from the evidence work or stay out.
