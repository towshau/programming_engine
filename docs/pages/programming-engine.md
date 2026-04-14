# Programming Engine (`/program`, `/program/:memberId`)

## Purpose And User Outcomes

- Primary coach workspace for editing generated programs and managing lifecycle actions.
- Supports day/weekly/timeline views, future program planning, and approval/upload workflow.

## Route And Entry Points

- Routes: `/program`, `/program/:memberId`
- Wrapper page: `frontend/src/pages/ProgrammingEngine.tsx`
- Core UI: `frontend/src/components/layout/ProgramViewer.tsx`

## Data Sources

- `programming_generated` (current/previous/future programs, holiday excluded in this view).
- `programming_coach_edits` (saved edits), plus local pending edits.
- `programming_progression_schemes`, `exercise_library`, `member_tbresults`, `member_holds`, `member_programs`.
- Optional regeneration API via `VITE_REGEN_API_URL` / `VITE_REGEN_API_SECRET`.

## Components And Store Hooks

- Store backbone: `useEditorStore` (member selection, fetchProgram, edit actions, save/finalize/upload).
- Key components:
  - `ProgramHeader`
  - `ProgramConfigEditor`
  - `ExerciseCategoryGroup`
  - `WeeklyView`
  - `TimelineView`
  - `ComplianceHeatmap`

## Business Rules And Edge Cases

- Program selection resolves current/previous/subsequent blocks using `start_date`/`end_date`.
- Save workflow bakes edits into payload and clears persisted row-level edit history.
- Finalize sets `coach_approved` and computes `next_due_date`; upload marks `uploaded_to_teambuildr`.
- Duration changes can cascade future block dates.
- Handles first-program bootstrap and regeneration fallback (request table) if API unavailable.

## If AI Is Editing This Page

- Keep source-of-truth editing in `editorStore`, not duplicated in component local state.
- Preserve lifecycle buttons and guard conditions (pending edits vs finalize/upload).
- Do not break future program editing flow (`editingFutureProgram`, `stashedCurrentProgram`).
- Keep timeline/weekly/day view toggles behaviorally equivalent.
- Re-verify holds/holiday banner and navigation to `/holiday`.

## Related Docs And Nearby Files

- Shared stores: [`shared/state-stores.md`](./shared/state-stores.md)
- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/ProgrammingEngine.tsx`
- `frontend/src/components/layout/ProgramViewer.tsx`
- `frontend/src/features/program/ProgramConfigEditor.tsx`
