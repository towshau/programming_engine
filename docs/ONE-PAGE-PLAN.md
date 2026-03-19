# Programming engine -- one-page plan and context

**Repo:** programming_engine. **Purpose:** (1) Sync exercise_library to Google Sheet (existing Node app). (2) AI programming engine: ingest past programs + apply rules + generate per-member programs -> write to Supabase.

---

## Data and integrations

- **Supabase (source):** member_tbresults, member_tbhealthmax, exercise_library (trigger-built), member table with current_status = 'active' for cohort.
- **Supabase (engine config):** All tables use `programming_` prefix; gym column uses enum `gym` (BLIGH, BRIDGE, COLLIN) where applicable.
- **Retool:** Admin form for deleted-exercise reports. View programs (staging + generated) with readable layout. Feedback form for coaches. Flagged-programs counter. PDF export on demand.
- **Program Editor (Vercel):** LR Program Editor at `programming-engine.vercel.app` (source: `teambuildr-replacement/`). Coaches search members, view generated programs, edit exercises inline, Save and Finalize. Admin marks as uploaded. Replaces Retool for program viewing/editing.
- **Output:** Normalised past programs -> programming_normalized_programs. Generated programs -> programming_generated. Coach edits saved back to programming_generated.payload. Single source of truth; view/edit in Program Editor; optional PDF to Supabase Storage or shared drive.

---

## Tables (9 total, all created and applied)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| programming_progression_schemes | Rep-range progression by scheme (GPP / Hypertrophy / Strength) | gym, name, goal, scheme_type, from/to_rep_range, exercise_behavior, order, active. |
| programming_exercise_exclusions | Per-member exercise exclusions | member_id, exercise_id, reason, active. |
| programming_removal_requests | Queue for "deleted exercise" reports; senior coach review | exercise_id, reason, submitted_by, status, reviewed_by. |
| programming_rules | General engine rules (gym-scoped) | gym, category, rule_key, rule_value (jsonb), priority, active. **15 rules seeded.** |
| programming_normalized_programs | Normalised past program per member per run | run_id, member_id, assigned_to, payload (jsonb). |
| programming_generated | Generated program per member per run | run_id, member_id, assigned_to, sessions_per_week, duration_weeks, phase_number, scheme_name, rep_range, changes_summary, rules_applied (jsonb), payload (jsonb), **coach_edited**, **coach_approved**, **uploaded_to_teambuildr**, **next_due_date**. |
| programming_feedback | Coach feedback on generated programs | run_id, member_id, coach_id, feedback_type, details, exercise_id, resolved. |
| programming_coach_edits | Individual coach edits to generated programs (differential learning) | program_id, member_id, coach_id, session_day, series_label, exercise_id, edit_type, old_value (jsonb), new_value (jsonb). |
| programming_regeneration_requests | Queue for program regeneration when coaches change scheme/rep-range/sessions | member_id, program_id, requested_by, scheme_name, rep_range, sessions_per_week, status (pending/processing/completed/failed). |

---

## Progression schemes (seeded)

- **GPP (default):** 10-12 -> 8-10 -> 6-8 -> 4-6 -> cycle. exercise_behavior = same_exercises.
- **Hypertrophy:** Cycle in 6-12 range.
- **Strength:** 8-10 -> 6-8 -> 4-6 -> 3-5 -> cycle.
- **Engine logic:** Member has selected scheme. Load rows by name, order by order. Current rep range -> matching row -> next phase = to_rep_range. Last step cycles.

---

## Pipeline

1. **Ingest:** Prefer latest `programming_generated` payload (coach-edited source) for the member; fall back to member_tbresults + exercise_library -> normalised past program (-> programming_normalized_programs) for first-time members with no generated record.
2. **Cohort:** Member table current_status = 'active' -> member IDs.
3. **Config:** Load programming_rules, programming_progression_schemes (by scheme name), programming_exercise_exclusions (by member). Never invent exercises.
4. **Generate:** Past program (from step 1) + rules + progression + exclusions -> canonical program JSON per member (deterministic). Phase detection always uses member_tbresults (actual logged reps), not the generated program.
5. **Write:** Persist to programming_generated (with duration_weeks, phase_number, scheme_name, rep_range, changes_summary, rules_applied).
6. **Coach review (Program Editor):** Coach views generated program, edits exercises/reps/sets, clicks Save (coach_edited=true) then Finalize (coach_approved=true, next_due_date calculated from member_programs.due_date + duration_weeks, snapped to Monday). Admin marks uploaded_to_teambuildr=true and member_programs.due_date is updated.

---

## Self-improving features

- **Coach feedback:** programming_feedback table + Retool form. Coaches flag exercise_swap, pairing_issue, too_hard, too_easy, positive, other.
- **Coach edits (differential):** programming_coach_edits table + frontend editor. Each edit (exercise swap, series change, sets/reps/notes) stored with old_value/new_value jsonb. Original generated program is never mutated. Enables: "which exercises get swapped most?", "do edits decrease over time?", "which coaches make the most changes?".
- **Auto-exclusion:** If exercise gets 3+ negative feedbacks for a member, auto-create row in programming_exercise_exclusions. Future: extend to also read coach_edits (3+ swaps = auto-exclude).
- **Rule hit tracking:** rules_applied jsonb on programming_generated; track which rules fire, correlate with feedback.
- **Changes summary:** Human-readable "what changed from last phase" on every generated program.
- **Flagged programs counter:** Retool badge/count of unresolved feedback per member or run.

---

## Tools and workflows (WAT)

- **Layout:** workflows/, tools/, requirements.txt at repo root.
- **Tools:** fetch, normalize, load_rules, generate (LLM), write. Utility: add_technical_debt.py.
- **Engine scripts (tools/):**
  - **normalize_one_member.py** — Ingest: member_tbresults + exercise_library → normalised sessions (by assigned_date), series labels (A1, A2, B1, …), write to programming_normalized_programs. Optional **phase detection**: pass `--scheme GPP|Strength|Hypertrophy` to detect current rep-range phase and next phase from A-series median reps; result in payload.phase_detection. See docs/data-model.md § Phase detection.
  - **detect_phase.py** — Standalone phase detection: given member_id and scheme name, normalises and returns current_rep_range, next_rep_range, confidence, direction. Used by normalize when --scheme is set; can be run alone: `python tools/detect_phase.py <member_id> Strength`.
  - **load_rules.py** — Load engine config: `programming_rules` (15 rules), `programming_progression_schemes` (by scheme name), `programming_exercise_exclusions` (by member). Returns rules dict + scheme steps + exclusion list. Standalone: `python tools/load_rules.py --member-id <uuid> --scheme Strength`.
  - **generate_program.py** — Deterministic generator: past program + rules + phase detection + library → canonical program JSON. **Source priority:** reads latest `programming_generated` payload first (coach-edited); falls back to member_tbresults for first-time members. Phase detection always uses member_tbresults. Carries forward exercises with updated rep ranges (A/B compounds at scheme range, C/D accessories at +2). Applies exclusions, avoids banned exercises, enforces C-series self-sufficiency. Standalone: `python tools/generate_program.py <member_id> --scheme Strength`.
  - **write_programs.py** — Persist generated program JSON to `programming_generated`. Input: payload from file or stdin; required: --run-id, --member-id, --sessions-per-week; optional: phase_number, scheme_name, rep_range, changes_summary, rules_applied. See docs/data-model.md (canonical payload shape).
  - **run_pipeline.py** — End-to-end pipeline runner: Ingest → Phase detect → Load config → Generate → Write. Single command for one member: `python tools/run_pipeline.py <member_id> --scheme Strength --sessions-per-week 3`. Options: `--dry-run`, `--skip-staging`, `--output FILE`.
  - **apply_auto_exclusions.py** — Feedback → programming_exercise_exclusions (e.g. 3+ negative feedbacks → exclude exercise for member).
  - **run_weekly_batch.py** — Weekly batch generator: queries `member_programs` for members due within 8 days (`update_stage`/`complete`) or `awaiting_program`; skips members with a `programming_generated` row from the last 7 days; runs normalize → phase detect → generate for each; writes to `programming_generated` only (stage/due_date updates are manual). Options: `--dry-run`, `--limit N`, `--member-id <uuid>`, `--duration-weeks N`. Uses `scheme_name` from `member_programs` per member.
- **Workflows:** Chronological order: Ingest → Load config → Generate → Write. See **workflows/README.md**. Batch generation runs weekly via GitHub Actions (Monday 09:00 UTC) or on demand via `workflow_dispatch`.

---

## Program Editor frontend (`frontend/`)

React app for coaches to review and edit generated programs. Stack: React 19 + TypeScript + Vite + Tailwind CSS 4 + Zustand + Supabase JS. Run: `cd frontend && npm run dev`.

- **Coach selector** — top bar dropdown; filters member list by `programming_coach_id` on `member_memberships`.
- **Member sidebar** — debounced search, shows member name + gym badge; click to load program.
- **Program viewer** — reads latest `programming_generated` for member; day picker, exercises grouped by series with color-coded labels. Series order: WU (Warm Up, purple) → A (Primary, blue) → B (Accessory, teal) → C/D (Additional, amber/zinc) → CD (Cool Down, rose).
- **Inline editing** — click series label to change (dropdown WU1–CD4, grouped by series), click exercise name to swap (searches `exercise_library`), click sets/reps to edit, add notes. Each edit writes to `programming_coach_edits` with old/new values for differential learning.
- **Delete exercise** — trash icon appears on hover for each exercise row; creates an `exercise_delete` edit that removes the exercise from the displayed program.
- **Edit overlay** — `applyEdits()` layers coach edits on top of generated payload; emerald ring + pencil icon on saved/modified exercises. Amber banner for unsaved pending edits.
- **Local-first editing** — edits accumulate in `pendingEdits` (Zustand state) across all days; switching days doesn't lose changes. "Save Program" button (pinned right of day picker) batch-inserts all pending edits to `programming_coach_edits` in one call.
- **Program config editing** — dual-row header: "Last Program" (read-only badges, greyed) above "Next/Current Program" (editable). Last Program falls back to `programming_normalized_programs` (historical TeamBuildr data) when no previous generated program exists. Editable fields: scheme (GPP/Hypertrophy/Strength dropdown), rep range (filtered by selected scheme from `programming_progression_schemes`), sessions/week (2–6), duration (4–8 weeks, metadata-only UPDATE). Phase auto-derived from scheme + rep range. Confidence read-only.
- **Regenerate Workout** — when scheme, rep range, or sessions/week differ from saved values, a "Regenerate Workout" button appears. Clicking calls the **Regeneration API** on Railway (`POST /regenerate`), which runs the full pipeline and writes a new program to `programming_generated`. Frontend re-fetches the program on success so the new program appears immediately. Falls back to inserting a row into `programming_regeneration_requests` if the API is not configured. **Regeneration rules:** (1) Coach's explicit rep-range selection overrides auto-detected phase. (2) Scheme changes keep exercises the same, only rep ranges/sets update. (3) Sessions-per-week changes regenerate exercises (different split required).
- **Add Exercise** — dashed "+ Add Exercise" button below each day's exercises. Opens the exercise picker modal; selected exercise is added with a default series label (next available in sequence) and 3x8-10 prescription. Stored as `exercise_add` edit type in `programming_coach_edits`.
- **Workflow columns (programming_generated):** Save sets `coach_edited = true`; Finalize sets `coach_approved = true` and `next_due_date` (from member_programs.due_date + duration_weeks, Monday); Mark Uploaded sets `uploaded_to_teambuildr = true` and syncs member_programs. Alternative UI: Vercel app at `programming-engine.vercel.app` (source: `teambuildr-replacement/`) with Save / Finalize / Mark Uploaded.

## Regeneration API (`api/`)

FastAPI app deployed on Railway. Wraps the existing Python pipeline (`tools/`) as an HTTP endpoint.

- **`POST /regenerate`** — accepts `{ member_id, scheme_name, rep_range, sessions_per_week, duration_weeks, requested_by, program_id }`. Runs: ingest → phase detect → load config → generate → write to `programming_generated`. Also writes/updates `programming_regeneration_requests` for audit. Returns the new program ID. When `rep_range` is provided, it overrides the auto-detected phase so the generated program uses the coach's selection. `changes_summary` records whether the rep range was overridden or auto-detected, and whether sessions/week changed from the detected value.
- **`GET /health`** — liveness check.
- **Auth** — Bearer token via `API_SECRET` env var. CORS locked to allowed origins.
- **Deploy** — `Dockerfile` at repo root; Railway connects to the same GitHub repo. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_SECRET`, `CORS_ORIGINS`.
- **Run locally** — `python -m uvicorn api.main:app --port 8001` (needs `.env` at repo root with Supabase creds).

## Admin and operations (Retool)

Retool page prompts and specs live in **retool/** (see `retool/README.md` for build order).

- **Program Viewer** (`retool/01-view-programs.md`) — Card-based view of generated + staging programs; filter by member, scheme, date. Unpacks payload into readable day/exercise/set cards.
- **Coach Feedback** (`retool/02-feedback-form.md`) — Slide-out form on the program viewer; flags exercise_swap, pairing_issue, too_hard, too_easy, positive, other in 30 seconds.
- **Flagged Counter** (`retool/03-flagged-counter.md`) — Badge + breakdown of unresolved feedback by member; mark resolved; bulk resolve.
- **Exercise Removal Requests** (`retool/04-deleted-exercise-form.md`) — Submit form + senior coach review queue; approve/reject (no direct delete).
- **PDF Export** (`retool/05-pdf-export.md`) — Export selected program to PDF via Retool's built-in PDF or Edge Function.

---

## Rules (19 active)

sources (only_exercise_library); composition (max_exercises_per_series, series_composition, avoid_exercises_when_possible, **exercise_priority**, **prefer_b_series_and_beyond** — named exercises e.g. Press - Cable - Mid Pulley, Reverse Fly go in B or later, never A); equipment (pairings_both_gyms, c_series_self_sufficient); exercise_pairing (**superset_press_pull_pairing**, **superset_lower_body_pairing**); session (home_workouts_weekends, set_structures, daily_programming_sets, warm_up_sets, additional_work_on_own); timing (session_timing, rest_times); volume (rehab_integration); progression (default_rep_progression). Generator enforces **series_assignment** (only ["A","B"] in A slot; ["B","C"] in B/C; ["C","D"] in C/D+).

---

## How to make it self-improving (practical path)

Two separate layers:

| Layer | What it is | How it helps |
|-------|------------|--------------|
| **Cursor (skills + subagents)** | You + AI in Cursor get better at *working on* the engine | Skills = when to trigger, schema, pipeline, rules. Subagents = run evals, analyze feedback, explore code. The engine doesn’t run inside Cursor. |
| **Engine’s own learning** | Code that runs without you (cron, Edge Function, or pipeline step) | Feedback → auto-exclusion; rule-hit × feedback → suggest rule changes; versioned prompts. The engine gets better from data. |

**Order that works:**

1. **Implement the feedback loop in code first**  
   - Job: read `programming_feedback`, count negative feedback per `(member_id, exercise_id)` (e.g. `feedback_type` in `exercise_swap`, `pairing_issue`, `too_hard`, `too_easy`, `other`). If count ≥ 3 and no active row in `programming_exercise_exclusions`, insert one (reason e.g. `auto_exclusion_from_feedback`). Run this after each run or on a schedule.  
   - Optional: aggregate `rules_applied` × feedback (e.g. “rule X often present when too_hard”) → report or table for human review.  

2. **Add a Cursor skill for this repo**  
   - Skill describes: when to use it (programming engine, rules, schema, pipeline, feedback), where tables and docs live, how generation + exclusions + rules work. Then when you say “add a rule” or “wire auto-exclusion,” the AI follows the schema and patterns.  

3. **Use subagents for one-off improvement work**  
   - Examples: “Run these members through the generator and compare to last run”; “Analyze `programming_feedback` and list top exercise_id by negative count”; “Find all places that read `programming_rules`.”  

4. **Turn it into a “growing” engine**  
   - Feedback → exclusions and (optionally) rule–feedback reports are the core. “Growing” = (a) you add rules over time (governed by the skill + docs), (b) auto-exclusion and reports run automatically (cron or post-run step), (c) later: versioned prompts in `workflows/` or `programming_rules`, and/or a small “rule analyst” that suggests rule edits from correlations. You do **not** need the engine to run inside Cursor for it to be self-improving; you need automation that consumes feedback and updates config (exclusions, and optionally rule suggestions).  

**Summary:** Skills + subagents make *you* (and Cursor) better at improving the engine. The engine becomes self-learning when **scheduled or pipeline-triggered code** reads feedback and updates exclusions (and optionally rule suggestions). Start with (1), then (2) and (3); (4) is the same loop running without you in the middle.

---

## Open questions

- Sessions per week: member-level config?
- Deleted exercises: user feedback vs system?
- exercise_behavior values and semantics — `allow_exercise_changes` not yet implemented; future "Generate New" button.
- ~~Where does member goal / selected scheme live?~~ → `member_programs.scheme_name` (default GPP). Coaches update via Program Editor (future) or Supabase.

---

## Docs

build-plan.md, data-model.md, engine-config.md, MASTER-CHECKLIST.md, TECHNICAL-REVIEW.md, questions-to-answer-later.md, IMPROVEMENTS.md, ONE-PAGE-PLAN.md.
