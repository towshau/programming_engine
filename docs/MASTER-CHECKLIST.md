# Master checklist – programming engine

Single checklist of tables, deliverables, and build items we've discussed. Cross off as done (change `[ ]` to `[x]` and add date or link).

---

## 1. Table creation (Supabase)

Apply migrations in `supabase/migrations/` in order. All programming-engine tables use the `programming_` prefix.

- [ ] **programming_progression_schemes** — Rep-range progression config (from/to, exercise_behavior, order, active). Migration: `20250225100000_create_progression_schemes.sql`
- [ ] **programming_exercise_exclusions** — Per-member exercise exclusions (member_id, exercise_id, reason, active). Migration: `20250225100001_create_member_exercise_exclusions.sql`
- [ ] **programming_removal_requests** — Queue for "deleted exercise" reports; admin/Retool submits here; senior coach reviews. Migration: `20250225100002_create_exercise_removal_requests.sql`
- [ ] **programming_rules** — General rules (gym, category, rule_key, rule_value jsonb, priority, active). Migration: `20250225100003_create_programming_rules.sql`
- [x] **Program output table** — `programming_generated`; run_id, member_id, assigned_to, sessions_per_week, payload jsonb. Migration: `20250225100005_create_programming_generated.sql`.
- [x] **Staging table for normalised past programs** — `programming_past_programs_staging`; run_id, member_id, assigned_to, payload jsonb. Migration: `20250225100004_create_programming_past_programs_staging.sql`.

---

## 2. Ingest and normalization

- [ ] **Normalized past program** — Tool/script that reads `member_tbresults` + `exercise_library` and writes normalized "past program" per member to `programming_past_programs_staging` (and/or JSON). Validate accuracy before wiring rules/LLM.

---

## 3. Engine config and tools (WAT)

- [ ] **WAT layout** — `workflows/`, `tools/`, `requirements.txt` at repo root.
- [ ] **Tool: fetch** — Fetch from Supabase (members, member_tbresults, exercise_library).
- [ ] **Tool: normalize** — Normalize raw data to past-program-per-member (see above).
- [ ] **Tool: load_rules** — Load from `programming_rules` (and optionally progression/exclusions).
- [ ] **Tool: write** — Persist generated programs to Supabase (after canonical JSON and output table exist).
- [ ] **Tool: generate (LLM)** — e.g. `generate_program_llm.py`; input past program + rules + exercise_library → canonical program JSON per member.
- [ ] **Workflows** — Markdown SOPs in `workflows/` (ingest → apply rules → generate → write); edge cases and tool order.

---

## 4. Admin and operations

- [ ] **Retool: Deleted-exercise form** — Form connects to Supabase; on submit, insert into `programming_removal_requests` (no direct delete). Senior coach / head coach reviews in queue; actual delete/deactivate is separate gated step after approval.
- [ ] **Retool: View programs** — View/list on `programming_past_programs_staging` and `programming_generated`; filter by member, date, and (when available) coach.
- [ ] **PDF export on demand** — Export run or per-coach subset to PDF for audit/share; script or Retool button; optional store in Supabase Storage or shared drive.

---

## 5. Documentation and decisions

- [ ] **docs/data-model.md** — Schema for all programming_ tables; existing tables (member_tbresults, exercise_library, member with current_status) documented.
- [ ] **docs/engine-config.md** — Rules separation, progression_schemes, exercise_exclusions (done).
- [ ] **docs/build-plan.md** — Build order, deleted-exercises flow, progression branching (done).
- [ ] **Canonical program JSON shape** — Defined and documented (Phase 2).
- [ ] **Cursor rule / skill** — Programming engine purpose, rules location, canonical shape, output (Supabase); optional skill for running/extending engine.
- [x] **Tool: add_technical_debt.py** — Script to append new technical-debt items to [TECHNICAL-REVIEW.md](TECHNICAL-REVIEW.md). Run from repo root: `python tools/add_technical_debt.py "Title" "Debt." "Solution."` or without args for prompts.

---

## 6. Open questions (see questions-to-answer-later.md)

- [ ] Sessions per week formula — Optionality for member-level unified config?
- [ ] Deleted exercises — How recognised (feedback vs system)? Flow documented in build-plan.
- [ ] Exact exercise_behavior values and semantics — same_exercises vs allow_exercise_changes.
- [ ] Where does member goal live? — For progression branching (strength / hypertrophy etc.).

---

## Reference

- **Build order:** [build-plan.md](build-plan.md) (tables first, then normalization).
- **Data model:** [data-model.md](data-model.md).
- **Engine config:** [engine-config.md](engine-config.md).
- **Questions:** [questions-to-answer-later.md](questions-to-answer-later.md).
