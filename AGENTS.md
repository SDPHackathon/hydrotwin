<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HydroTwin — rules for every coding agent (Claude Code, Codex, Copilot, Gemini/Antigravity, Cursor)

Read **`docs/spec.md`** (what we build, in what order) and **`docs/data-contracts.md`** (names, rules) before writing code. `docs/progress.md` says what is done and what is next — update it when you finish a step.

## Stack (fixed — don't swap without the team agreeing)
- Next.js 16 App Router + TypeScript + Tailwind CSS 4 · npm
- Map: **MapLibre GL JS + OpenFreeMap** base map (free, no key). No Google Maps tiles, no Cesium.
- Backend: **Supabase** — Postgres, Realtime, Auth, Edge Functions (Deno)
- Tests: `node --test` (Node ≥ 22.18), no test framework

## Folder map
| Path | What |
|---|---|
| `app/` | routes — `/` dashboard (laptop); `/control`, `/resident`, `/guard`, `/plan` come next |
| `components/` | React components (`TownshipMap.tsx` = the 3D map) |
| `lib/engine/` | **the engine — pure TypeScript**: storm, drain simulator, risk rules |
| `lib/` | app helpers (`area.ts` loads township data, `useLocalStorm.ts` local storm) |
| `public/data/<area>/` | township data: streets, buildings, drains (built by `npm run data`) |
| `supabase/migrations/` | database schema · `supabase/seed.sql` (built by `npm run seed`) |
| `supabase/functions/` | Edge Functions (Deno) — excluded from the Next.js type-check |
| `scripts/` | data + build helpers · `tests/` engine tests · `docs/` spec, contracts, logs |

## Rules
1. **No keys or secrets in code — not even as a fallback.** Names go in `.env.example`, values in `.env.local` (gitignored). `NEXT_PUBLIC_*` values ship to the browser, so only public keys there. Server secrets → `supabase secrets set`.
2. **`lib/engine/` stays pure**: no React, Next or Supabase imports; relative imports end in `.ts` (Deno and `node --test` run these files directly). It is the only place status rules live — the apps never decide a status themselves.
3. **Names follow `docs/data-contracts.md`.** Change a table, column or rule → update the contract, the migration and the tests in the same commit.
4. **Only the risk engine writes `drain_status`.** Apps read and listen (Realtime).
5. **Every new library, dataset, API or asset → a row in `docs/third-party.md`** with its licence. No scraping, no unofficial endpoints (e.g. `mt1.google.com` tiles). SDP can ask for every licence (T&C cl. 14).
6. **Fresh code only.** Don't paste code from other projects, coursework or client work — everything here becomes SDP's IP (T&C cl. 11–12). Code from Danish's HydroTwin prototype (made for this hackathon) is fine.
7. **Log material AI use** in `docs/ai-use-log.md` (T&C cl. 13) — one line per session: tool, what for, which part.
8. **Residents are fictional.** Never put real names, phone numbers or addresses in the data.
9. **Before saying "done"**: `npm run lint`, `npm test` and `npm run build` pass, and you looked at it in the browser. Small commits; `main` always runs.
10. **State simplifications honestly** (drains are simulated zones, water is per-street depth, not hydraulics) — in the UI footer, README and pitch.

## Skills
Vetted agent skills live in `.claude/skills/` (added in Step B). If your tool doesn't load them automatically, read the matching `SKILL.md` before working on that area (Supabase, MapLibre, React performance).
