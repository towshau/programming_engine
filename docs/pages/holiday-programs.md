# Holiday Programs (`/holiday`)

## Purpose And User Outcomes

- Dedicated page for off-timeline holiday/travel programming.
- Enables creating, editing, approving, and deleting holiday-specific program blocks.

## Route And Entry Points

- Route: `/holiday`
- Page: `frontend/src/pages/HolidayPrograms.tsx`
- Uses `MemberSidebar` and shared program editing primitives.

## Data Sources

- `programming_generated` with `program_type = 'holiday'`.
- `programming_progression_schemes` and `exercise_library` for template generation.
- Uses same edit persistence path as regular programs via `programming_coach_edits`.

## Components And Store Hooks

- Store actions:
  - `fetchHolidayPrograms`
  - `generateHolidayProgram`
  - `loadProgramById`
  - `saveProgram` / `finalizeProgram`
- Uses `ExerciseCategoryGroup`, `DayPicker`, and `AddExerciseButton`.

## Business Rules And Edge Cases

- Holiday cards show date range, scheme, rep range, and approval status.
- New holiday program generation seeds from template builder and inserts into `programming_generated`.
- Edit mode reuses same session editor patterns as main programming page.
- Deletion is allowed and should refresh list + clear selected program when needed.

## If AI Is Editing This Page

- Keep `program_type='holiday'` filtering explicit.
- Preserve "select member -> fetch list -> select program" flow.
- Do not remove approval step parity with regular programs.
- Ensure create form still validates scheme/rep-range/session inputs.
- Keep fallback errors surfaced through `regenError`/`createError`.

## Related Docs And Nearby Files

- Shared stores: [`shared/state-stores.md`](./shared/state-stores.md)
- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/HolidayPrograms.tsx`
- `frontend/src/stores/editorStore.ts`
