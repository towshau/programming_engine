# Bug fixes log (programming engine)

Chronological record of notable bugs and how they were fixed. For process and pipeline maps, see [ONE-PAGE-PLAN.md](./ONE-PAGE-PLAN.md).

---

## 2026-03-25 — Program editor: duplicate exercises and wrong-row edits

**Symptoms**

- Exercises sometimes appeared multiple times in the UI after editing/saving (corrupted or replayed payload rows).
- When two rows shared the same movement (same `exercise_id`) or the same `series_label`, editing one row could change the wrong exercise, clear sets/reps, or fail to apply.

**Cause**

- Coach edits and `applyEdits` targeted exercises by `series_label` only (and earlier, a dedupe step removed “duplicate” rows by label + id), which is ambiguous when labels or exercises legitimately repeat.

**Fix**

- **Stable exercise identity:** runtime `_idx` on each exercise (position in the base session array), optional `exercise_idx` on pending/saved edit types; `applyEdits` resolves targets by `exercise_idx` when present, else legacy `series_label` fallback.
- Removed blanket session deduplication and the `exercise_add` “already exists” skip so intentional duplicates are allowed.
- React keys and smart cancellation in the editor store use `exercise_idx` when available so edits do not cross rows.

**Code:** `frontend/src/lib/applyEdits.ts`, `frontend/src/types/program.ts`, `frontend/src/types/edits.ts`, `frontend/src/features/program/ExerciseRow.tsx`, `ExerciseCategoryGroup.tsx`, `frontend/src/stores/editorStore.ts`.

---

## 2026-03-25 — Persistent exercise identity (`row_id`)

**Symptoms**

- After the `_idx` fix (above), editing duplicate exercises still targeted the wrong row. Deleting certain rows failed. Changing a series label or swapping an exercise on one row modified a different row. Root cause: `_idx` was runtime-only (positional), so it shifted when exercises were added/deleted/saved, losing identity across saves and reloads.

**Fix — Option A: Persistent UUID per exercise row**

- Every exercise in `programming_generated.payload` now carries a `row_id` (UUID v4), stamped at generation time and preserved across all operations.
- All edit operations (`PendingEdit`, `CoachEdit`) now carry `row_id` to target the correct row. `applyEdits` resolves exercises by `row_id` first (falling back to `series_label` for legacy data). React keys use `row_id`.
- Removed `_idx`, `exercise_idx`, and `exercise_index` from types and all logic.
- `programming_coach_edits` table now has a `row_id` column.
- All code paths that construct exercises stamp `row_id`: `generate_program.py`, `backfill_current_programs.py`, `templateBuilder.ts`, `AddExerciseButton.tsx`, `sync-exercises.ts`, `batch-sync.ts`.
- One-time migration `tools/backfill_row_ids.py` stamped `row_id` on all 579 existing program rows.

**Code:** `frontend/src/types/program.ts`, `edits.ts`, `frontend/src/lib/applyEdits.ts`, `frontend/src/features/program/ExerciseRow.tsx`, `ExerciseCategoryGroup.tsx`, `AddExerciseButton.tsx`, `frontend/src/stores/editorStore.ts`, `frontend/src/lib/templateBuilder.ts`, `tools/generate_program.py`, `tools/backfill_current_programs.py`, `tools/backfill_row_ids.py`, `teambuilder-sync/sync-exercises.ts`, `teambuilder-sync/batch-sync.ts`.

---

## 2026-03-25 — Retool and payload corruption (context)

**Note:** Retool queries shared for “Program Upload Admin” only update `uploaded_to_teambuildr` and `updated_at` on `programming_generated`; they do not write `payload`. Duplicate rows inside `payload` were addressed in the app (see above) and, where needed, by cleaning bad data in the database separately.
