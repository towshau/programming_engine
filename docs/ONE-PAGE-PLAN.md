# Programming engine -- one-page plan and context

**Repo:** programming_engine. **Purpose:** (1) Sync exercise_library to Google Sheet (existing Node app). (2) AI programming engine: ingest past programs + apply rules + generate per-member programs -> write to Supabase.

---

## Data and integrations

- **Supabase (source):** member_tbresults, member_tbhealthmax, exercise_library (trigger-built), member table with current_status = 'active' for cohort.
- **Supabase (engine config):** All tables use `programming_` prefix; gym column uses enum `gym` (BLIGH, BRIDGE, COLLIN) where applicable.
- **Retool:** **Planned:** one **admin check-in / upload queue** — pending programs after coach finalization, support manual TeamBuildr load, mark `uploaded_to_teambuildr`. **Not planned:** separate Retool program viewer, coach feedback form, flagged counter, PDF export, or deleted-exercise form (coaches stay in Program Editor).
- **Program Editor (Vercel):** LR Program Editor at `programming-engine.vercel.app` (source: `teambuildr-replacement/`). Coaches search members, view generated programs, edit exercises inline, Save and Finalize. Admin marks as uploaded (or uses Retool check-in when built). Primary surface for coach view/edit. Notable editor bugs and fixes: [BUG-FIXES.md](./BUG-FIXES.md).
- **Output:** Normalised past programs -> programming_normalized_programs. Generated programs -> programming_generated. Coach edits saved back to programming_generated.payload. Single source of truth; view/edit in Program Editor.

---

## Tables (10 total, all created and applied)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| programming_progression_schemes | Rep-range progression by scheme (GPP / Hypertrophy / Strength) | gym, name, goal, scheme_type, from/to_rep_range, exercise_behavior, order, active. |
| programming_exercise_exclusions | Per-member exercise exclusions | member_id, exercise_id, reason, active. |
| programming_removal_requests | Queue for "deleted exercise" reports; senior coach review | exercise_id, reason, submitted_by, status, reviewed_by. |
| programming_rules | General engine rules (gym-scoped) | gym, category, rule_key, rule_value (jsonb), priority, active. **15 rules seeded.** |
| programming_normalized_programs | Normalised past program per member per run | run_id, member_id, assigned_to, payload (jsonb). |
| programming_generated | Generated program per member per run | run_id, member_id, assigned_to, sessions_per_week, duration_weeks, phase_number, scheme_name, rep_range, changes_summary, rules_applied (jsonb), payload (jsonb — each exercise carries persistent `row_id` UUID), **coach_edited**, **coach_approved**, **uploaded_to_teambuildr**, **next_due_date**, **start_date**, **end_date** (source of truth for expires), **program_type** (`'regular'`\|`'holiday'`, DEFAULT `'regular'`), **holiday_start_date**, **holiday_end_date**. Migration: `supabase/migrations/20260408130000_add_holiday_program_columns.sql`, `20260409000000_add_start_end_date_to_generated.sql`. |
| programming_feedback | Coach feedback on generated programs | run_id, member_id, coach_id, feedback_type, details, exercise_id, resolved. |
| programming_coach_edits | Individual coach edits to generated programs (differential learning) | program_id, member_id, coach_id, session_day, series_label, exercise_id, edit_type, old_value (jsonb), new_value (jsonb), **row_id** (text, targets specific exercise slot). |
| programming_regeneration_requests | Queue for program regeneration when coaches change scheme/rep-range/sessions | member_id, program_id, requested_by, scheme_name, rep_range, sessions_per_week, status (pending/processing/completed/failed). |
| programming_sync_log | Audit trail for TeamBuilder → Supabase batch sync runs | run_id, member_id, member_name, status (success/failed/skipped), days_synced, exercises_synced, error, synced_at. |

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

- **Coach feedback:** `programming_feedback` table exists; `apply_auto_exclusions.py` can consume rows if feedback is recorded elsewhere. No Retool coach feedback UI planned.
- **Coach edits (differential):** programming_coach_edits table + Program Editor. Each edit (exercise swap, series change, sets/reps/notes) stored with old_value/new_value jsonb. Original generated program is never mutated. Enables: "which exercises get swapped most?", "do edits decrease over time?", "which coaches make the most changes?".
- **Auto-exclusion:** If exercise gets 3+ negative feedbacks for a member, auto-create row in programming_exercise_exclusions. Future: extend to also read coach_edits (3+ swaps = auto-exclude).
- **Rule hit tracking:** rules_applied jsonb on programming_generated; track which rules fire; optional correlation if feedback exists.
- **Changes summary:** Human-readable "what changed from last phase" on every generated program.

---

## Tools and workflows (WAT)

- **Layout:** workflows/, tools/, requirements.txt at repo root.
- **Tools:** fetch, normalize, load_rules, generate (LLM), write. Utility: add_technical_debt.py.
- **Engine scripts (tools/):**
  - **normalize_one_member.py** — Ingest: member_tbresults + exercise_library → normalised sessions (by assigned_date), series labels (A1, A2, B1, …), write to programming_normalized_programs. Optional **phase detection**: pass `--scheme GPP|Strength|Hypertrophy` to detect current rep-range phase and next phase from A-series median reps; result in payload.phase_detection. See docs/data-model.md § Phase detection.
  - **detect_phase.py** — Standalone phase detection: given member_id and scheme name, normalises and returns current_rep_range, next_rep_range, confidence, direction. Used by normalize when --scheme is set; can be run alone: `python tools/detect_phase.py <member_id> Strength`.
  - **load_rules.py** — Load engine config: `programming_rules` (15 rules), `programming_progression_schemes` (by scheme name), `programming_exercise_exclusions` (by member). Returns rules dict + scheme steps + exclusion list. Standalone: `python tools/load_rules.py --member-id <uuid> --scheme Strength`.
  - **generate_program.py** — Deterministic generator: past program + rules + phase detection + library → canonical program JSON. **Source priority:** reads latest `programming_generated` payload first (coach-edited); falls back to member_tbresults for first-time members. **Sessions/week:** `resolve_sessions_per_week()` — CLI override if any, else `sessions_per_week` from latest `programming_generated` row (or `payload.metadata`), else `detect_sessions_per_week()` on ingest sessions (long tb history can over-count; stored row preserves batch-sync/coach truth). Phase detection always uses member_tbresults. Carries forward exercises with updated rep ranges (A/B compounds at scheme range, C/D accessories at +2). Applies exclusions, avoids banned exercises, enforces C-series self-sufficiency. Standalone: `python tools/generate_program.py <member_id> --scheme Strength`.
  - **write_programs.py** — Persist generated program JSON to `programming_generated`. Input: payload from file or stdin; required: --run-id, --member-id, --sessions-per-week; optional: phase_number, scheme_name, rep_range, changes_summary, rules_applied. See docs/data-model.md (canonical payload shape).
  - **run_pipeline.py** — End-to-end pipeline runner: Ingest → Phase detect → Load config → Generate → Write. Single command for one member: `python tools/run_pipeline.py <member_id> --scheme Strength --sessions-per-week 3`. Options: `--dry-run`, `--skip-staging`, `--output FILE`.
  - **backfill_program_dates.py** — Backfill `start_date` and `end_date` onto existing rows in `programming_generated`. Supports a continuous timeline. Idempotent. `python tools/backfill_program_dates.py [--dry-run]`.
  - **backfill_row_ids.py** — One-time migration: stamps UUID `row_id` on every exercise inside every `programming_generated` payload that doesn't already have one. Idempotent; safe to re-run. `python tools/backfill_row_ids.py [--dry-run]`.
  - **apply_auto_exclusions.py** — Feedback → programming_exercise_exclusions (e.g. 3+ negative feedbacks → exclude exercise for member).
  - **run_weekly_batch.py** — Weekly batch generator: queries `member_programs` for members due within 8 days (`update_stage`/`complete`) or `awaiting_program`; skips members with a `programming_generated` row from the last 7 days; runs normalize → phase detect → generate for each; writes to `programming_generated` only (stage/due_date updates are manual). Options: `--dry-run`, `--limit N`, `--member-id <uuid>`, `--duration-weeks N`. Uses `scheme_name` from `member_programs` per member.
- **Workflows:** Chronological order: Ingest → Load config → Generate → Write. See **workflows/README.md**. Batch generation runs weekly via GitHub Actions (**Monday 7:00pm AEST**; cron `09:00 UTC` Monday) or on demand via `workflow_dispatch`.

### Standalone apps

- **exercise-library-sheet-sync/** — Node app that syncs `exercise_library` to Google Sheet. See `exercise-library-sheet-sync/.env.example`.

---

## Program Editor frontend (`frontend/`)

> **Branch note:** A major UI overhaul is in progress on `feature/ui-overhaul` (pushed to GitHub, not yet merged to `main`). All description below reflects the `feature/ui-overhaul` state. The old dark-theme single-page layout exists only in `main` git history.

React multi-page app for coaches. Stack: React 19 + TypeScript + Vite + Tailwind CSS 4 + Zustand + Supabase JS + react-router-dom. Run: `cd frontend && npm run dev` (requires `frontend/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — copy values from root `.env`).

**Architecture (feature/ui-overhaul):**
- Light theme throughout (CSS variables in `index.css`; `--bg`, `--text`, `--color-gold`, `--border`, status colors `--red/--green/--blue`)
- `AppShell` — horizontal top nav bar (LR logo, nav links, coach selector, date, "Andrew Ponce" page-owner credit); wraps all pages via react-router `<Outlet>`
- Routes: `/` → ClientQueue, `/intake[/:memberId]` → Intake, `/program[/:memberId]` → ProgrammingEngine, `/holiday` → HolidayPrograms
- `MemberSidebar` — collapsible (chevron toggle; collapsed = 40px icon rail, expanded = 288px). Used on Intake and ProgrammingEngine pages. Not used on ClientQueue (has its own inline list)

**Pages:**
- **ClientQueue** (`/`) — landing page. 4 full-width tabs: Awaiting First Program (red), New Training Phase Due (gold), Active Programs (green), Holiday Programs & Holds (blue). Each tab queries Supabase live. Active Programs uses a two-step query (no FK from `programming_generated` → `member_database` yet; FK migration file exists at `supabase/migrations/20260408000001_fk_programming_generated_member.sql` — apply when Supabase CLI is linked). **Holiday Programs & Holds** tab: shows all members who have upcoming holds (`member_holds.hold_end >= today`) or upcoming holiday programs (`programming_generated.program_type = 'holiday'`, `holiday_end_date >= today`). Rendered as a dual-column card per member — left column lists each hold (dates + travel notes + hold notes), right column lists each holiday program (dates + scheme + sessions/week + approval status). Clicking a member navigates to `/holiday` with that member pre-selected.
- **Intake & Assessment** (`/intake`) — three-tab page. Left panel = collapsible MemberSidebar.
  - **Client Profile tab** — Membership & Logistics (primary/secondary from `member_memberships` + financial metadata), Health Screening (injuries/goals from `member_database`, focus/avoid from `member_physicals_raw`), Body Composition (`member_health_metrics`), Assessment Date.
  - **Movement & Benchmarks tab** — combined: movement screen (squat, hinge, shoulder flexion, toe touch) RAG badges + 6 benchmark cards (grip/chin/jump/RSI/VO2/push-ups) with RAG badges. Data: latest `member_physicals_raw` row.
  - **Progress tab** (`features/progress/`) — Physical Capacity Radar (5-axis circular Recharts RadarChart: Strength/Agility/Cardio/Mobility/Bloods on 0-100% granular scale, missing data = 0, includes sub-metric breakdowns with raw values and RAG dots); Master Benchmark Trend Chart (all 6 benchmark metrics overlaid, raw values, tight dynamic Y-axis auto-padding, toggleable lines); Individual Benchmark Breakdown (small multiples, collapsible, raw values with tight dynamic Y-axis padding: relative ±10%); Body Composition small multiples (weight relative ±10%, bf absolute ±5%, smm absolute ±2%, inbody absolute ±10%). **Time filter:** 3m / 6m (default) / All Time. **Download Report** button exports WYSIWYG PDF via `html2canvas` + `jsPDF` (filename: `<MemberName>-Progress-Report-<date>.pdf`). Data: all `member_physicals_raw` + all `member_health_metrics` rows fetched on load. Shared scoring logic in `frontend/src/lib/scoring.ts` (RAG functions, 0-100 normalisation, radar computation).
- **ProgrammingEngine** (`/program`) — wraps existing `ProgramViewer`; URL-synced member selection. All coach workflow buttons (Save Program, Finalize, Mark Uploaded) intact and functional
- **HolidayPrograms** (`/holiday`) — full page for off-timeline holiday programs. Member sidebar + card list of holiday programs per member. **Create**: date range (start/end) + sessions/week + scheme/rep-range/duration → seeds a template from `exercise_library` and inserts into `programming_generated` with `program_type = 'holiday'`. **Edit**: selects the program row into the Zustand store via `loadProgramById`, enabling the same inline exercise editor (ExerciseCategoryGroup, addPendingEdit, Save Program) used in the main program viewer. **Approve** + **Delete** buttons. ClientQueue "Holiday Programs" tab shows member rows for all holiday programs (navigates back to /holiday).

- **Coach selector** — top bar dropdown (`All Coaches` = no filter). Options: active `staff_database` rows whose `role` is one of Coach, Advanced Coach, Gym Manager, Senior Coach, Casual Coach, Head of Exercise. Selected coach ID persisted in `localStorage` (`lr-selected-coach-id`) across refresh. Filters member list by **`member_memberships.handoff_coach_id ?? coach_id`** (aligns with Intake logic and Retool). Gym / membership stage come from active `member_memberships` rows.
- **Member sidebar** — debounced search, shows member name + gym badge; click to load program.
- **Program viewer** — reads latest `programming_generated` for member (regular programs only; holiday rows excluded from this view); day picker, exercises grouped by series with color-coded labels. Series order: WU (Warm Up, purple) → A (Primary, blue) → B (Accessory, teal) → C/D (Additional, amber/zinc) → E/F (Extra, slate/indigo) → CD (Cool Down, rose). Each group supports up to 5 slots (e.g. A1–A5).
- **Program Timeline & Future Programs** — the editor supports chained future blocks. `start_date` and `end_date` on `programming_generated` form a continuous timeline (each program's `start_date` equals its predecessor's `end_date`). If a program's duration is shortened/lengthened, all subsequent programs have their start/end dates cascaded automatically. Future programs can be built via three modes: "Generate Next Phase" (advances progression), "Clone Exact", or "Randomise New Workout" (calls AI pipeline for fresh start). Footer always visible: when future programs exist, shows count + next start date + Show/Hide toggle; when none exist, shows the three add buttons. Future programs can be **edited** (swaps into main editor with a gold "Editing Future Program" banner and "Back to Current" button) and **deleted** (confirmation prompt, removes from Supabase).
- **Day View / Weekly View toggle** — segmented control in `ProgramHeader` next to member name (gold-accent active state). Day View shows day picker + exercises for one day. Weekly View shows all days side-by-side as scrollable columns.
- **Weekly View** — `features/program/WeeklyView.tsx`. Next Program columns are editable (inline exercise editing, Add Exercise, drag-to-reorder exercises). Last Program columns are read-only. Both use compact layout (exercise name stacked above sets×reps, tags hidden). Day columns support **day-level drag-and-drop** (6-dot grip handle on column header, horizontal `DndContext`/`SortableContext`): dragging a day column calls `swapDays(dayA, dayB)` which writes directly to Supabase and re-fetches. Save/Finalize workflow buttons visible in both views.
- **Within-group exercise drag-and-drop** — in `features/program/ExerciseCategoryGroup.tsx`. Grip handle appears on hover per exercise row. Dragging an exercise within a group swaps `series_label` values between source and destination via two `series_change` edits queued as `pendingEdits`. Works in Day View and Weekly View.
- **Holds & Holiday banner** — when a member has future holds logged in `member_holds` (fetched on member select) or any holiday programs, a blue information banner appears below the program header. Shows hold dates + `travel_programming_notes` per hold, and a link to `/holiday` for holiday programs.
- **Inline editing** — click series label to change (dropdown WU1–CD5, grouped by series, now includes E and F groups), click exercise name to swap (searches `exercise_library`), click sets/reps to edit, add notes. Each edit writes to `programming_coach_edits` with old/new values for differential learning.
- **Delete exercise** — trash icon appears on hover for each exercise row; creates an `exercise_delete` edit that removes the exercise from the displayed program.
- **Edit overlay** — `applyEdits()` layers coach edits on top of generated payload; emerald ring + pencil icon on saved/modified exercises. Amber banner for unsaved pending edits.
- **Local-first editing** — edits accumulate in `pendingEdits` (Zustand state) across all days; switching days doesn't lose changes. "Save Program" button (pinned right of day picker) batch-inserts all pending edits to `programming_coach_edits` in one call.
- **Program config editing** — dual-row header: "Last Program" (collapsible, badges, compliance heatmap) above "Next/Current Program" (always visible, editable). Last Program falls back to `programming_normalized_programs` (historical TeamBuildr data) when no previous generated program exists. Editable fields: scheme (GPP/Hypertrophy/Strength dropdown), rep range (filtered by selected scheme from `programming_progression_schemes`), sessions/week (1–6), duration (1–8 weeks, metadata-only UPDATE). Phase auto-derived from scheme + rep range. Confidence read-only.
- **Last Program accordion** — clicking the Last Program card expands it inline above the Next Program section (accordion pattern, not tab-switch). Shows: compliance heatmap, day picker, and exercises (read-only). Clicking again collapses it. Next Program content is always visible below.
- **Training compliance heatmap** — `ComplianceHeatmap` component in `features/program/ComplianceHeatmap.tsx`. Shows a weekly calendar grid (Mon–Sun columns) covering the last program's active period (`previousProgram.created_at` to `program.created_at`). Green cells = distinct `completed_date` calendar days in `member_tbresults` for that member in range; grey = no log. Grid cell dates use **local** calendar YYYY-MM-DD (not `Date.toISOString()` UTC), so weekday columns match the coach's timezone. Summary: "X sessions logged of Y expected (Z%)". Data via `fetchComplianceDates()` (distinct `completed_date`, normalized to `YYYY-MM-DD`). Only shown for `source: 'generated'` programs.
- **Regenerate Workout** — when scheme, rep range, or sessions/week differ from saved values, a "Regenerate Workout" button appears. Clicking calls the **Regeneration API** on Railway (`POST /regenerate`), which runs the full pipeline and writes a new program to `programming_generated`. Frontend re-fetches the program on success so the new program appears immediately. Falls back to inserting a row into `programming_regeneration_requests` if the API is not configured. **Regeneration rules:** (1) Coach's explicit rep-range selection overrides auto-detected phase. (2) Scheme changes keep exercises the same, only rep ranges/sets update. (3) Sessions-per-week changes regenerate exercises (different split required).
- **First-program bootstrap** — if a member has no generated program yet, the Program Viewer shows an inline "Generate First Program" card (sessions/week 1–6, scheme, rep range, duration). It seeds a starter template from `exercise_library` into `programming_generated`, then calls `POST /regenerate` so the full pipeline can produce a proper first block.
- **Add Exercise** — dashed "+ Add Exercise" button below each day's exercises. Opens the exercise picker modal; selected exercise is added with a default series label (next available in sequence) and 3x8-10 prescription. Stored as `exercise_add` edit type in `programming_coach_edits`.
- **Workflow columns (programming_generated):** Save sets `coach_edited = true`; Finalize sets `coach_approved = true` and `next_due_date` (from member_programs.due_date + duration_weeks, Monday); Mark Uploaded sets `uploaded_to_teambuildr = true` and syncs member_programs. Alternative UI: Vercel app at `programming-engine.vercel.app` (source: `teambuildr-replacement/`) with Save / Finalize / Mark Uploaded.

## Regeneration API (`api/`)

FastAPI app deployed on Railway. Wraps the existing Python pipeline (`tools/`) as an HTTP endpoint.

- **`POST /regenerate`** — accepts `{ member_id, scheme_name, rep_range, sessions_per_week, duration_weeks, requested_by, program_id }`. Runs: ingest → phase detect → load config → generate → write to `programming_generated`. Also writes/updates `programming_regeneration_requests` for audit. Returns the new program ID. When `rep_range` is provided, it overrides the auto-detected phase so the generated program uses the coach's selection. `changes_summary` records whether the rep range was overridden or auto-detected, and whether sessions/week changed from the detected value.
- **`GET /health`** — liveness check.
- **Auth** — Bearer token via `API_SECRET` env var. CORS locked to allowed origins.
- **Deploy** — `Dockerfile` at repo root; Railway connects to the same GitHub repo. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_SECRET`, `CORS_ORIGINS`.
- **Run locally** — `python -m uvicorn api.main:app --port 8001` (needs `.env` at repo root with Supabase creds).

## Admin and operations (Retool + upload)

- **Admin upload (for AI):** Instructions for the admin task of uploading finalized programs to TeamBuildr and marking them uploaded. See **docs/admin-upload-instructions-for-ai.md** (human or agent-assisted; browser automation for **push** is de-scoped).

**Retool — build:** **Admin check-in / upload queue** (queue + mark-uploaded workflow; align queries with manual sync process). Specs under **retool/**: `01`–`05` are **legacy prompts** for canceled pages (viewer, feedback, counter, removal form, PDF); see `retool/README.md`.

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
