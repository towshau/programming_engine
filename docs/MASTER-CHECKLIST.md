# Master checklist – programming engine

Single checklist of tables, deliverables, and build items we've discussed. Cross off as done (change `[ ]` to `[x]` and add date or link).

---

## 1. Table creation (Supabase)

Apply migrations in `supabase/migrations/` in order. All programming-engine tables use the `programming_` prefix.

- [x] **programming_progression_schemes** — Rep-range progression config (from/to, exercise_behavior, goal, scheme_type, order, active). Migration: `20250225100000`. Seeded GPP/Hypertrophy/Strength: `20250225100007`.
- [x] **programming_exercise_exclusions** — Per-member exercise exclusions (member_id, exercise_id, reason, active). Migration: `20250225100001`.
- [x] **programming_removal_requests** — Queue for "deleted exercise" reports; senior coach reviews. Migration: `20250225100002`. (Dedicated Retool submit form **not** planned; table remains if we wire another intake later.)
- [x] **programming_rules** — General rules (gym, category, rule_key, rule_value jsonb, priority, active). Migration: `20250225100003`. Seeded 16 rules: `20250225100006`, `20250225100010`; +2 rules: `20250312000001` (exercise_priority, superset_lower_body_pairing). 18 active.
- [x] **programming_generated** — run_id, member_id, assigned_to, sessions_per_week, payload, duration_weeks, phase_number, scheme_name, rep_range, changes_summary, rules_applied. Migrations: `20250225100005`, `20250225100009`.
- [x] **programming_normalized_programs** — run_id, member_id, assigned_to, payload jsonb. Migration: `20250225100004`.
- [x] **programming_feedback** — Coach feedback on programs (run_id, member_id, coach_id, feedback_type, details, exercise_id, resolved). Migration: `20250225100008`. (Table exists for optional future use / `apply_auto_exclusions`; no Retool coach feedback UI planned.)

---

## 2. Ingest and normalization

- [x] **Normalized past program** — Tool/script that reads `member_tbresults` + `exercise_library` and writes normalized "past program" per member to `programming_normalized_programs` (and/or JSON). Validate accuracy before wiring rules/LLM. **Done:** `tools/normalize_one_member.py` (sessions by assigned_date, series labels A1/B1/C1…, optional phase detection via `--scheme`). `tools/detect_phase.py` for standalone phase detection.

---

## 3. Engine config and tools (WAT)

- [x] **WAT layout** — `workflows/`, `tools/`, `requirements.txt` at repo root. **Done:** `tools/` and `requirements.txt` exist; `workflows/` folder not yet created (Markdown SOPs).
- [x] **Tool: fetch** — Fetch from Supabase (members, member_tbresults, exercise_library). **Done:** inside `normalize_one_member.py` and `detect_phase.py` (fetch_results_for_member, fetch_exercise_library); schemes via detect_phase.fetch_schemes.
- [x] **Tool: normalize** — Normalize raw data to past-program-per-member (see above). **Done:** `tools/normalize_one_member.py`; series assignment + optional phase detection.
- [x] **Tool: load_rules** — Load from `programming_rules` (and optionally progression/exclusions). **Done:** `tools/load_rules.py`; loads 18 rules, scheme steps, member exclusions. Standalone or imported.
- [x] **Tool: generate** — Deterministic generator: past program + rules + phase detection + library → canonical JSON. **Done:** `tools/generate_program.py`; carries forward exercises with updated rep ranges; applies exclusions, C-series rules, avoid list; **exercise_priority** (compounds in A/B first), **superset_press_pull_pairing** and **superset_lower_body_pairing**, **series_assignment** enforcement. Standalone: `python tools/generate_program.py <member_id> --scheme Strength`.
- [x] **Tool: write** — Persist generated programs to Supabase. **Done:** `tools/write_programs.py`; payload from file or stdin → `programming_generated`. Canonical payload shape in data-model.md.
- [x] **Pipeline runner** — End-to-end: Ingest → Phase detect → Load config → Generate → Write. **Done:** `tools/run_pipeline.py <member_id> --scheme Strength --sessions-per-week 3`. Options: --dry-run, --skip-staging, --output.
- [x] **Batch generator** — Weekly batch: query `member_programs` for due/awaiting members, run pipeline for each, write to `programming_generated`. Skip recently generated. **Done:** `tools/run_weekly_batch.py`. Options: --dry-run, --limit, --member-id. GitHub Actions runs **Monday 7:00pm AEST** (`09:00 UTC` Monday). `member_programs.scheme_name` (default GPP) drives per-member scheme.
- [x] **Workflows** — Markdown SOPs in `workflows/` (ingest → load → generate → write). **Done:** `workflows/README.md` with all tools, options, and summary table. Scheduled via GitHub Actions (`.github/workflows/programming-engine-weekly.yml`).

---

## 4. Admin and operations

- [ ] **Retool: Admin check-in / upload queue** — Single admin table in Retool: programs that have passed coach edits (e.g. `coach_approved`, not yet `uploaded_to_teambuildr`), fields to drive manual TeamBuildr entry, and an action to mark uploaded (same outcome as `teambuilder-sync` `npm run upload:done` / `--mark-uploaded`). See `docs/admin-upload-instructions-for-ai.md` and `teambuilder-sync/upload-programs.ts` (plan mode).

**Canceled / superseded (not building):** Retool program viewer, coach feedback form, flagged-programs counter, on-demand PDF export, deleted-exercise submission form — coaches use the **Program Editor**; admins use manual TB load + mark-uploaded until the check-in app ships.

---

## 5. Documentation and decisions

- [x] **docs/data-model.md** — Schema for all programming_ tables; existing tables (member_tbresults, exercise_library, member with current_status) documented. Phase detection § added.
- [x] **docs/engine-config.md** — Rules separation, progression_schemes, exercise_exclusions (done).
- [x] **docs/build-plan.md** — Build order, deleted-exercises flow, progression branching (done).
- [x] **Canonical program JSON shape** — Same as staging; documented in data-model.md § programming_generated (Canonical payload shape). Generator and writer both produce/consume `{ "sessions": [ { "day", "exercises": [ { "exercise_name", "series_label", "sets" } ] } ] }`.
- [x] **Cursor rule / skill** — Programming engine purpose, rules location, canonical shape, output (Supabase); optional skill for running/extending engine. **Done:** `.cursor/rules/integrations-env.mdc`, `.cursor/rules/one-page-plan-sync.mdc`; ONE-PAGE-PLAN lists tools and phase detection.
- [x] **Tool: add_technical_debt.py** — Script to append new technical-debt items to [TECHNICAL-REVIEW.md](TECHNICAL-REVIEW.md). Run from repo root: `python tools/add_technical_debt.py "Title" "Debt." "Solution."` or without args for prompts.

---

## 6. Open questions (see questions-to-answer-later.md)

- [x] Sessions per week formula — **Done:** Auto-detected from member's recent training history (distinct day signatures in last ~4 weeks). Manual override via `--sessions-per-week`. See `generate_program.py` `detect_sessions_per_week()`.
- [ ] Deleted exercises — How recognised (feedback vs system)? Flow documented in build-plan.
- [ ] Exact exercise_behavior values and semantics — same_exercises vs allow_exercise_changes.
- [x] Where does member goal live? — **Done:** `member_programs.scheme_name` (default GPP). Migration: `20250311000001`. Coaches update via Program Editor (or Supabase).

---

## Reference

- **Build order:** [build-plan.md](build-plan.md) (tables first, then normalization).
- **Data model:** [data-model.md](data-model.md).
- **Engine config:** [engine-config.md](engine-config.md).
- **Questions:** [questions-to-answer-later.md](questions-to-answer-later.md).
- **Improvements:** [IMPROVEMENTS.md](IMPROVEMENTS.md).
