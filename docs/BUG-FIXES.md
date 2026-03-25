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

## 2026-03-25 — Retool and payload corruption (context)

**Note:** Retool queries shared for “Program Upload Admin” only update `uploaded_to_teambuildr` and `updated_at` on `programming_generated`; they do not write `payload`. Duplicate rows inside `payload` were addressed in the app (see above) and, where needed, by cleaning bad data in the database separately.
