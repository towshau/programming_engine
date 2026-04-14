# Shared: Zustand State Stores

## Purpose

- Quick reference for where state and side effects live.
- Prevents route components from re-implementing data orchestration.

## `useEditorStore` (`frontend/src/stores/editorStore.ts`)

### Owns

- Coach/member selection and filtering (`coaches`, `members`, `intakeMembers`, `selectedCoach`, `selectedMember`).
- Program lifecycle state:
  - `program`, `previousProgram`, `subsequentPrograms`
  - `savedEdits`, `pendingEdits`
  - config draft, regeneration, validation errors
- Holiday context:
  - `memberHolds`
  - `holidayPrograms`

### Key Side-Effect Actions

- `fetchCoaches`, `fetchMembers`
- `fetchProgram`, `fetchEdits`, `fetchPreviousEdits`
- `saveProgram`, `finalizeProgram`, `markUploaded`
- `requestRegeneration`, `generateFirstProgram`
- `fetchHolidayPrograms`, `generateHolidayProgram`, `loadProgramById`

## `useJourneyStore` (`frontend/src/stores/journeyStore.ts`)

### Owns

- Journey tables and filters:
  - `templates`, `steps`, `changelog`
  - `selectedLocation`, `selectedType`
  - membership-length and timeline toggles

### Key Side-Effect Actions

- `fetchJourneys`
- `updateStepField`

## Store Boundaries

- UI components should call store actions, not direct Supabase queries (except intentionally isolated pages/tools).
- Keep business-rule derivations in stores when shared by multiple views.
- Keep lightweight presentational transforms in components.

## If AI Is Editing State

- Add new cross-page data fields to store state first, then consume in components.
- Keep async actions idempotent and null-safe.
- Preserve localStorage contract for selected coach key (`lr-selected-coach-id`).
- Avoid breaking existing edit chain/cancellation logic in `pendingEdits`.

## Referenced By Page Docs

- [`../client-queue.md`](../client-queue.md)
- [`../intake-assessment.md`](../intake-assessment.md)
- [`../programming-engine.md`](../programming-engine.md)
- [`../holiday-programs.md`](../holiday-programs.md)
- [`../client-journey.md`](../client-journey.md)
