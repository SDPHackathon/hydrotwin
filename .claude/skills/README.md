# Vetted agent skills

Copied verbatim from the vendors' official repos on 2026-10-16 and pinned to a commit — no installer CLI, no `npx`. Any agent that doesn't auto-load `.claude/skills/` should read the matching `SKILL.md` before working on that area (AGENTS.md › Skills). Each folder carries its licence file. Listed in `docs/third-party.md` (T&C cl. 14) and in `docs/ai-use-log.md` (cl. 13).

| Skill | Source | Commit | Licence | Modified? |
|---|---|---|---|---|
| `supabase` | supabase/agent-skills › `skills/supabase` | `c9be0e9` | MIT | yes — Skill Feedback reference + assets removed (see footer note in SKILL.md) |
| `supabase-postgres-best-practices` | supabase/agent-skills › `skills/supabase-postgres-best-practices` | `c9be0e9` | MIT | no |
| `vercel-react-best-practices` | vercel-labs/agent-skills › `skills/react-best-practices` | `063bee9` | MIT (frontmatter; repo has no LICENSE file → `LICENSE-NOTE.md`) | no |
| `maplibre-tile-sources` | maplibre/maplibre-agent-skills › `skills/maplibre-tile-sources` | `76a1942` | MIT (+ NOTICE: parts adapted from mapbox-agent-skills, MIT) | no |
| `maplibre-source-wiring` | maplibre/maplibre-agent-skills › `skills/maplibre-source-wiring` | `76a1942` | MIT (+ NOTICE) | no |

To update a skill: re-download the folder at a newer commit, replace it whole, update the commit here and in `docs/third-party.md`.
