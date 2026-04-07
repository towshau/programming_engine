# Programming Engine Architecture

This document serves as the single source of truth for the Locker Room Programming Engine architecture. Any AI model or developer should read this first to understand how the system is built, how data flows, and where the boundaries of each component lie.

---

## 1. System Overview & Goals

The **Programming Engine** is an automated system for Lockeroom Gym that handles member training programs. Its primary goal is to ingest training history, calculate the correct progression phase, generate a mathematically and logically sound training program based on coaching rules, and present it to coaches for review and editing.

### Core Philosophy
1. **Deterministic Generation:** Given the same past program, rules, exclusions, and phase, the engine must produce the exact same next program.
2. **Differential Editing:** Coaches edit programs in the UI, but we **never** mutate the original generated payload. Edits are saved as "diffs" (`programming_coach_edits`), allowing us to analyze *what* coaches change to improve the engine over time.
3. **Database as the Source of Truth:** `programming_generated` is the baseline for the *next* generation cycle. (We previously used a Playwright scraper to pull data from TeamBuildr, but this proved unreliable and was removed).

---

## 2. Core Components

The system is broken down into four distinct technical components:

| Component | Tech Stack | Location | Purpose |
|-----------|------------|----------|---------|
| **Pipeline** | Python | `tools/` | Core logic. Normalizes data, detects phase, loads config/rules, and generates the canonical JSON program. |
| **API** | FastAPI (Python) | `api/` | Deployed on Railway. Wraps the Python pipeline as a web service so the frontend can trigger regenerations on demand. |
| **Frontend** | React, Vite, Zustand, Tailwind | `frontend/` | "Program Editor" for coaches. Reads from Supabase, applies coach edits locally, and saves them back. |
| **Database** | Supabase (PostgreSQL 15) | Cloud | Stores raw history, rules, generated programs, and coach edits. |

*(Note: There is also an `exercise-library-sheet-sync/` Node.js app that simply syncs the exercise library to a Google Sheet).*

---

## 3. The Data Model

All engine-specific tables are prefixed with `programming_`. 

### The Core Loop Tables
1. **`member_tbresults`**: Raw exercise logging data originally from TeamBuildr. This is the ultimate ground truth of what the member *actually lifted*.
2. **`programming_normalized_programs`**: An enriched baseline of past programs (adds series labels A1/A2, pairings, etc.).
3. **`programming_generated`**: The engine's output. Contains the prescribed program (`payload` JSONB).
4. **`programming_coach_edits`**: Individual edits (reps, sets, swaps, deletes) made by coaches via the frontend. These edits are merged with `programming_generated.payload` at runtime in the UI.

### Configuration Tables
- **`member_programs`**: Defines which member gets what program, their coach, scheme, and due date.
- **`programming_rules`**: 16+ JSONB rules (e.g., superset press/pull, max exercises per series).
- **`programming_progression_schemes`**: The rep-range ladders (e.g., GPP: 10-12 → 8-10 → 6-8 → 4-6).
- **`programming_exercise_exclusions`**: Per-member blocked exercises (e.g., due to injury or feedback).
- **`exercise_library`**: Canonical catalog of exercises with tags (`Horizontal Press`, `Lower Body Pull`) and series bounds (can it be an A-series lift?).

---

## 4. Step-by-Step Flow

### A. Weekly Batch Generation (The "Run")
Triggered by GitHub Actions (`tools/run_weekly_batch.py`) every Monday evening.
1. **Cohort Selection:** Finds active members in `member_programs` whose `due_date` is within 8 days.
2. **Ingest:** Reads the *most recent* `programming_generated` row to establish the baseline. If it's a brand new member, it falls back to parsing raw `member_tbresults`.
3. **Phase Detection:** Looks at the previous program's prescribed `rep_range` and calculates the next logical step in the progression scheme deterministically. (Falls back to fuzzy median math on `member_tbresults` only if there is no previous generated program).
4. **Config Load:** Fetches rules, exclusions, and the exercise library.
5. **Generate:** The generator (`tools/generate_program.py`) carries forward exercises, updates rep ranges (A/B compounds get the scheme range, C/D accessories get +2 reps), enforces rules, and applies pairings.
6. **Write:** Saves the JSON payload to `programming_generated`.

### B. Coach Review & Editing (Frontend)
1. **View:** Coach opens the React app, selects a member.
2. **Render:** App loads `programming_generated` and all `programming_coach_edits`, merging them in real-time (`applyEdits` function) to show the final program.
3. **Modify:** Coach tweaks reps, swaps exercises, or adds/deletes. State is held in Zustand (`pendingEdits`).
4. **Regenerate:** If the coach changes the high-level config (e.g., changes 3 days/week to 4 days/week), the frontend calls the FastAPI (`POST /regenerate`), which re-runs the Python pipeline and overwrites the generated row.
5. **Save & Finalize:** Coach hits "Save" (writes `pendingEdits` to Supabase, updates `duration_weeks` metadata) and "Finalize" (calculates the next due date and marks it approved).

### C. Admin & Sync
Because the automated TeamBuildr scraper was removed, an Admin must manually push the finalized program to TeamBuildr and click "Mark Uploaded" in the UI (which updates the `uploaded_to_teambuildr` flag).

---

## 5. Key Architectural Decisions

1. **Deterministic Phase Detection vs Fuzzy Logic:** 
   We explicitly shifted from fuzzy logic (guessing the phase based on what the member *actually* lifted) to deterministic logic (advancing the phase based on what they were *prescribed* last time). Fuzzy logic is only retained as a fallback for brand new members.
   
2. **Why not mutate `programming_generated` directly from the frontend?**
   If we let the UI mutate the JSON payload, we lose the exact record of what the AI produced versus what the human changed. By using `programming_coach_edits` (an event-sourcing pattern), we can write scripts to say: *"Coaches swapped the AI's choice of 'Walking Lunges' 85% of the time this month. We should write a rule to avoid Walking Lunges."*

3. **Removal of the Scraper:**
   A Playwright scraper was built to push/pull from TeamBuildr. It broke constantly due to UI changes. We removed it entirely. `programming_generated` is our uncompromised source of truth.

4. **Series Labels and Grouping:**
   Exercises are structured around `series_label`s (A1, A2, B1, C1). 
   - A: Primary compound lifts.
   - B: Secondary compounds / heavy accessories.
   - C/D: Isolation / light accessories.
   The UI groups exercises by the letter (e.g., grouping A1 and A2 into an "A" block) and sorts them alphanumerically.

---

## 6. Frontend Architecture (Program Editor)

The frontend is a React 19 app built with Vite, TypeScript, and Tailwind CSS v4, deployed to Vercel. It acts as the primary interface for coaches to review and edit AI-generated programs.

### Tech Stack & Libraries
- **Framework:** React 19 + TypeScript + Vite.
- **Styling:** Tailwind CSS 4.
- **State Management:** Zustand (`frontend/src/stores/editorStore.ts`).
- **Database Connection:** Supabase JS client (`frontend/src/lib/supabase.ts`).

### Folder Structure
- **`src/components/layout/`**: Major structural blocks. `ProgramViewer.tsx` is the primary view for rendering the current member's program, day picker, and action buttons. `Sidebar.tsx` handles coach selection and the member list queue.
- **`src/components/ui/`**: Reusable low-level UI components (e.g., `DayPicker.tsx`, `Modal.tsx`).
- **`src/features/program/`**: Domain-specific components for the editor. 
  - `ExerciseRow.tsx` / `SetsRepsEditor.tsx` / `SeriesLabelDropdown.tsx`: Handling specific exercise properties.
  - `ProgramConfigEditor.tsx`: Allows changing the scheme, duration, and frequency.
  - `ComplianceHeatmap.tsx`: A calendar visualization showing which days a member historically trained.
- **`src/lib/`**: Core business logic that executes in the browser.
  - `applyEdits.ts`: The crucial diffing engine. Merges `programming_generated` (base payload) with `programming_coach_edits` (differential edits) to produce the final state rendered in the UI.
  - `templateBuilder.ts`: Logic to cold-start a "first program" template for brand new members before passing it to the AI.
  - `reps.ts`: Validation logic for set/rep string formatting.
- **`src/stores/`**: `editorStore.ts` holds all global state via Zustand.

### State & The "Diff" Pattern
Instead of mutating the base program payload directly when a coach makes a change, the frontend uses an event-sourcing pattern.
1. When a coach makes an edit (e.g., swapping an exercise or changing reps), an edit object is added to the `pendingEdits` array in Zustand.
2. The UI is immediately re-rendered by running the base `programming_generated` payload through `applyEdits.ts` along with any saved `programming_coach_edits` from the DB and the local `pendingEdits`.
3. When the coach clicks "Save", the `pendingEdits` are flushed to the `programming_coach_edits` table in Supabase. The `programming_generated` payload itself remains mathematically pure to what the AI generated, preserving analytical integrity.

### Data Flow
- The frontend connects directly to Supabase via RLS policies to read members, programs, libraries, and write coach edits.
- It does **not** generate programs directly. If a coach changes core variables (like days per week or rep range), the frontend calls the FastAPI endpoint (`POST /regenerate` on Railway) to invoke the Python pipeline, waiting for the new program to be written to Supabase before fetching it back.

---

## 7. How to Run & Develop

### Python Pipeline (Local Dev)
Requires `.env` at the repo root with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
```bash
# Run the pipeline for one member (prints to console by default)
python tools/run_pipeline.py <member_id> --scheme GPP --sessions-per-week 3

# Test the deterministic generator directly
python tools/generate_program.py <member_id> --scheme Strength
```

### React Frontend (Local Dev)
```bash
cd frontend
npm install
npm run dev
```

### FastAPI Regeneration Service (Local Dev)
```bash
python -m uvicorn api.main:app --port 8001
```

## Related Reading
- `docs/ONE-PAGE-PLAN.md` - Operational checklists and broader context.
- `docs/data-model.md` - Deep dive into table schemas and JSON payload structures.
- `docs/programming-engine-plan.md` - Original design doc containing the 16 base coaching rules.