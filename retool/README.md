# Retool resources

**Current plan:** build a single **admin check-in / upload queue** in Retool — surface programs ready for TeamBuildr after coaches finalize in the Program Editor; support manual upload workflow; mark `uploaded_to_teambuildr` (same intent as `teambuilder-sync/upload-programs.ts` plan mode + `npm run upload:done`). Use **docs/admin-upload-instructions-for-ai.md** for field semantics.

**Supabase connection:** Retool uses the same Supabase project as the engine.

## Legacy specs (not building)

The `01`–`05` markdown files are **retained as reference prompts only**. We canceled Retool scope for program viewer, coach feedback, flagged counter, exercise-removal form, and PDF export (coaches use the Program Editor).

| File | Original idea | Status |
|------|----------------|--------|
| `01-view-programs.md` | Program Viewer | Canceled — use Program Editor |
| `02-feedback-form.md` | Coach Feedback | Canceled |
| `03-flagged-counter.md` | Flagged Programs | Canceled |
| `04-deleted-exercise-form.md` | Exercise Removal Request | Canceled |
| `05-pdf-export.md` | PDF Export | Canceled |

When the admin check-in app is specced, add a new file (e.g. `06-admin-upload-queue.md`) and link it here.
