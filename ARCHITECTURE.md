# Programming Engine Architecture

This document provides a high-level overview of the `programming_engine` repository's layout, systems, and historical context (especially past bug fixes) to speed up research and onboarding.

## 1. Overview
The programming engine is responsible for syncing gym data, applying coaching rules, generating per-member workout programs, and providing a frontend for coaches to review, edit, and finalize those programs.

## 2. System Components

The repository is divided into several loosely coupled applications:

### A. Core Engine Pipeline (`tools/` & `workflows/`)
- **Stack:** Python.
- **Purpose:** A deterministic rules engine that generates per-member workout programs. It does not "hallucinate" workouts from scratch; instead, it progresses existing ones according to strict logic.
- **Data Ingestion Split:**
  - **Program Structure (Template):** Preferentially fetches from `programming_generated` so that prior coach edits (e.g., exercise swaps) carry forward. Only falls back to raw TeamBuildr exports for brand-new members.
  - **Performance Data (Phase Detection):** Fetches actual logged reps strictly from `member_tbresults` to decide how to adjust rep ranges, because the generated payload only knows what was *prescribed*, not what the member *actually lifted*.
- **Rules & Sorting Engine:**
  - **Phase Detection:** Isolates A-series compounds, calculates median reps, and decides the direction of travel (e.g., drop from 8-10 reps down to 6-8 reps) based on the progression scheme.
  - **Exclusions & Priority:** Strips out banned/injured exercises, and prioritizes heavy compounds into the `A` and `B` series.
  - **Dynamic Pairing:** Enforces "Press/Pull Pairing" on Upper Body days and proper Push/Pull distributions on Lower Body days.
  - **Series Bounds & Demotions:** Ensures isolation or machine exercises accidentally placed in primary slots are bumped down to `B` or `C` series.
  - **Sets & Reps:** Applies the calculated phase rep ranges to main lifts and dynamically assigns higher rep ranges (+2) and specific set counts to accessories.
- **Key Scripts:**
  - `generate_program.py`: The deterministic generator and rules engine.
  - `run_pipeline.py`: End-to-end runner (Ingest → Phase detect → Config → Generate → Write).
  - `run_weekly_batch.py`: Automates weekly batch runs for the cohort via GitHub Actions.
  - `apply_auto_exclusions.py`: Processes feedback to auto-exclude exercises.

### B. Program Editor Frontend (`frontend/`)
- **Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Supabase JS.
- **Purpose:** The primary UI for coaches to review and edit generated programs before they go out.
- **Features:** 
  - Allows inline editing (swap exercises, edit sets/reps, change labels).
  - Persists edits using local-first state (`Zustand` `pendingEdits`) which are batch-saved.
  - Displays training compliance heatmaps and allows coaches to trigger program regeneration.

### C. Regeneration API (`api/`)
- **Stack:** FastAPI (Python), deployed on Railway.
- **Purpose:** Exposes the Python engine pipeline as an HTTP endpoint (`POST /regenerate`).
- **Usage:** Triggered by the Frontend when a coach updates fundamental program configs (e.g., sessions per week, rep range) and needs an immediately updated program without waiting for a batch run.

### D. Integrations / Sync Tools
- **`exercise-library-sheet-sync/`**: Node app syncing the Supabase `exercise_library` to a Google Sheet.
- **`teambuilder-sync/`**: Node + Playwright scraper. Pulls exercises from TeamBuildr into `programming_generated`.

## 3. Data Model (Supabase)

All engine-specific tables use the `programming_` prefix. See `docs/data-model.md` for full details.
- **Inputs:** `member_tbresults`, `exercise_library`, `member`.
- **Config:** `programming_rules`, `programming_progression_schemes`, `programming_exercise_exclusions`.
- **Outputs/State:** 
  - `programming_generated`: The finalized output and source of truth for a program.
  - `programming_normalized_programs`: Staging for normalized past programs.
  - `programming_coach_edits`: Stores individual differential edits made by coaches in the frontend.

## 4. Known Gotchas & Historical Bug Fixes

Understanding these previous bugs is critical as they highlight some of the complex state management challenges between the generated payload and coach edits.

### A. Save Mismatch / Randomized Result After Save
- **Symptom:** The saved program would occasionally differ from the visible editor state (UI state and persisted state diverged).
- **Root Cause:** Coach edits (`programming_coach_edits`) were not properly coalescing with the generated payload.
- **Fix (March 24, 2026):** The "Save Program" action was updated to **bake** the computed edited sessions directly into `programming_generated.payload`. The associated rows in `programming_coach_edits` are cleared after a successful payload bake to prevent double-applying. 

### B. Wrong Exercise Edited When Labels Are Blank (Additional Section)
- **Symptom:** Edits in the "Additional" section of the frontend reverted, changed the wrong row, or only the top row behaved correctly.
- **Root Cause:** Multiple rows lacked distinct identifiers (both `exercise_id: null` and `series_label: ""`). The matching/cancellation logic fell back to updating the first matching row it found.
- **Fix (March 24, 2026):** Introduced `exercise_index` as a deterministic fallback matcher through edit creation, application, and cancellation chain logic. Disambiguation now strictly uses: `exercise_id` → `exercise_index` → `series_label`.

### C. Date Correctness & Heatmap Rendering
- **Symptom:** Misaligned days in the compliance heatmap.
- **Context:** Grid cell dates in the frontend must use local calendar `YYYY-MM-DD` mapping, rather than `Date.toISOString()` UTC, so that weekday columns accurately match the coach's local timezone.

## 5. Navigation Guide for Context Research

If you are looking for...
- **The big picture map:** Read `docs/ONE-PAGE-PLAN.md`
- **Database Schema:** Read `docs/data-model.md` and `docs/engine-config.md`
- **Coaching Rules & Logic:** Read `docs/programming-rules-source.md`
- **Recent Technical Debt & Scalability:** Read `docs/TECHNICAL-REVIEW.md`
- **Recent Dev/Improvements context:** Read `docs/2026-03-24-handoff.md` and `docs/IMPROVEMENTS.md`
