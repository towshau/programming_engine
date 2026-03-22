# programming_engine

Repo for gym programming tooling: (1) syncing the exercise library to a Google Sheet, and (2) an AI-powered programming engine that generates per-member programs from past programs and rules.

---

## What’s in this repo

| Part | Location | Description |
|------|----------|--------------|
| **Exercise library → Sheet sync** | `exercise-library-sheet-sync/` | Node app. Syncs Supabase `exercise_library` to a Google Sheet. Run: `cd exercise-library-sheet-sync && npm install && npm run sync-exercise-library`. CI: `.github/workflows/sync-exercise-library-to-sheet.yml`. |
| **Programming engine (in progress)** | `docs/`, `tools/` | Pipeline: normalize past programs → staging, phase detection (optional), apply auto-exclusions from feedback. **Scripts:** `python tools/normalize_one_member.py [member_id] [--scheme GPP|Strength|Hypertrophy]`, `python tools/detect_phase.py <member_id> <scheme>`, `python tools/apply_auto_exclusions.py`. Phase detection: A-series median reps → current/next rep range and confidence (see docs/data-model.md). **Weekly CI:** `.github/workflows/programming-engine-weekly.yml` (Monday 7:00pm AEST / `09:00 UTC`; needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in repo secrets). |

---

## Picking up in a new Cursor project

To continue work on this repo in a new Cursor project:

1. **Read the plan**  
   [docs/programming-engine-plan.md](docs/programming-engine-plan.md) — architecture, WAT (Workflows, Agents, Tools), data/schema, rules (Supabase `programming_rules`), output (Supabase), sessions-per-week (“same as last time”), cohort (active members only), and phased implementation.

2. **Rules source**  
   [docs/programming-rules-source.md](docs/programming-rules-source.md) — canonical narrative rules for coaches and program design; engine and `programming_rules` should align with this.

3. **Sync app**  
   Lives in `exercise-library-sheet-sync/` (own `package.json`, `scripts/`, `.env.example`). GitHub Action runs from repo root with `working-directory: exercise-library-sheet-sync`.

4. **Next steps (from the plan)**  
   Phase 1: document schema in `docs/data-model.md` (member_tbresults, member table with `current_status`, program tables). Phase 2: canonical program JSON shape. Then add `workflows/`, `tools/`, and Python tools.

5. **Env**  
   For sync: copy `exercise-library-sheet-sync/.env.example` to `.env` and set Supabase and Google credentials. For the engine: `.env` at repo root with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. For the **weekly GitHub Action**, add the same as repo secrets: Settings → Secrets and variables → Actions → `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Links

- **GitHub:** [github.com/towshau/programming_engine](https://github.com/towshau/programming_engine)
- **Plan:** [docs/programming-engine-plan.md](docs/programming-engine-plan.md)
- **Rules source:** [docs/programming-rules-source.md](docs/programming-rules-source.md)
