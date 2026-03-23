# Admin Upload Instructions (for AI)

This document describes the tasks currently assigned to **admin** for the programming engine, written as instructions for an AI agent. After human testing, this workflow is intended to be automated (e.g. via Manus) using a browser automation tool such as **Playwright** to control TeamBuildr and perform the upload steps.

---

## 1. Scope of admin tasks

Admin is responsible for:

1. **Uploading programs to TeamBuildr** — Taking programs that coaches have finalized in the LR Program Editor and loading them into TeamBuildr so members can see and log their workouts.
2. **Marking programs as uploaded** — After a successful upload, recording that fact in our system so the workflow state is accurate and we don’t re-upload the same program.

Re-uploads are required when a coach edits a program that was already uploaded (e.g. mid-cycle exercise swap). In that case the same program again needs to be loaded into TeamBuildr and then marked uploaded once done.

---

## 2. How to find programs that need uploading

**Source of truth:** Supabase table `programming_generated`.

**Query for “needs upload”:**

- `coach_approved = true` — Coach has finalized the program.
- `uploaded_to_teambuildr = false` — Not yet uploaded (or was edited after upload and needs re-upload).

**Suggested query (SQL):**

```sql
SELECT
  pg.id,
  pg.member_id,
  pg.payload,
  pg.sessions_per_week,
  pg.duration_weeks,
  pg.next_due_date,
  pg.created_at,
  md.first_name,
  md.last_name,
  md.email
FROM programming_generated pg
JOIN member_database md ON md.id = pg.member_id
WHERE pg.coach_approved = true
  AND pg.uploaded_to_teambuildr = false
ORDER BY pg.next_due_date ASC NULLS LAST, pg.created_at ASC;
```

**Optional filter:** Restrict to programs whose `next_due_date` is within the next 7 days (or another window) so the AI only uploads programs that are about to start.

**Payload shape:** `payload` is JSONB. It contains:

- `payload.sessions` — Array of `{ day: number, exercises: [...] }`.
- Each exercise has: `exercise_name`, `exercise_id`, `series_label`, `sets` (array of `{ set_number, reps }`), optional `notes`, `tags`.

Use this payload to know exactly which sessions, exercises, sets, and reps to create or update in TeamBuildr.

---

## 3. Current human process (to replicate in automation)

Today an admin:

1. Opens the **LR Program Editor** (e.g. `https://programming-engine.vercel.app`).
2. Selects a coach, then finds the member whose program shows **Finalized** but not **Uploaded** (or shows “Re-upload required”).
3. Logs into **TeamBuildr** in another tab/browser.
4. Finds the same member in TeamBuildr (by name or email).
5. Creates or updates the member’s program in TeamBuildr to match the Program Editor:
   - Correct number of days per week (`sessions_per_week`).
   - For each day, the exercises and their sets/reps as in `payload.sessions`.
   - Exercise names/IDs should align with TeamBuildr’s exercise catalog where possible (we use `exercise_id` from our `exercise_library`, which may map to TeamBuildr IDs).
6. Returns to the Program Editor and clicks **Mark Uploaded** for that member’s program (or uses a future API that sets `uploaded_to_teambuildr = true`).

**Success criterion:** The member can see the correct program in TeamBuildr with the right sessions, exercises, sets, and reps. Only then should the program be marked as uploaded.

---

## 4. What the AI must do after a successful upload

Once the program has been successfully loaded into TeamBuildr for that member:

1. **Update Supabase**  
   Set `uploaded_to_teambuildr = true` for the corresponding row in `programming_generated`:

   ```sql
   UPDATE programming_generated
   SET uploaded_to_teambuildr = true, updated_at = now()
   WHERE id = :program_id;
   ```

   (Or via Supabase client: update the row by `id` with `uploaded_to_teambuildr: true`.)

2. **Optional: update member’s due date**  
   If your system keeps `member_programs.due_date` in sync with when the program starts, update it to `programming_generated.next_due_date` for that member when you first upload (or when you upload a new cycle). Logic depends on your `member_programs` schema and business rules.

---

## 5. Failure and retries

- If the AI cannot find the member in TeamBuildr, or cannot create the program (e.g. permissions, UI change, network error), it should **not** set `uploaded_to_teambuildr = true`.
- Log the failure (member_id, program_id, error reason) for human review.
- Retry policy (e.g. retry once after a short delay, then flag for human) can be defined later; the important part is to only set `uploaded_to_teambuildr = true` after a verified successful upload in TeamBuildr.

---

## 6. Future automation: Playwright (or similar)

The above steps are intended to be automated by an AI agent (e.g. Manus) using browser automation.

**Recommended tool:** **Playwright** (or Puppeteer). Use a single browser context; log into TeamBuildr once per run (or reuse a session if secure and compliant with your policies).

### 6.1 Upload-only date rule (Supabase → TeamBuildr)

**Scope:** This rule applies **only** to **pushing** `programming_generated` into TeamBuildr (Playwright upload or manual admin process if you adopt the same rule). It does **not** apply to the **TeamBuildr → Supabase** pull sync (`teambuilder-sync/sync-exercises.ts`, `batch-sync.ts`), which may scrape the full Mon–Fri window for alignment.

**Rule:** Do **not** create, overwrite, or delete workouts on calendar dates **before “today”** in the gym’s timezone. Only touch dates **≥ today**. Default timezone for the upload script is `Australia/Sydney` (override with `GYM_TIMEZONE` in `teambuilder-sync/.env`).

- For each program session, map `day` (1…N in the payload) to a **concrete calendar date** using the same anchor the product uses (e.g. Monday of the current week, or `next_due_date` when future — see `upload-programs.ts`).
- If that calendar date is **strictly before** today → **skip** TeamBuildr edits for that day.
- If the date is **today or in the future** → create/update the workout from the payload.

**Why:** Past days may already be logged; overwriting them risks confusion or wiping history.

### 6.2 High-level flow for the AI

1. **Query** Supabase for programs with `coach_approved = true` and `uploaded_to_teambuildr = false` (see §2).
2. For each program:
   - **Navigate** to TeamBuildr (e.g. login page), log in with credentials provided via environment or secrets.
   - **Resolve member:** Search or navigate to the member (by name/email from `member_database` or the query result).
   - **Create/update program:** For each day in `payload.sessions`, create or update the workout with the exercises and set/rep prescriptions — **subject to §6.1** (skip calendar dates before today). Map our `exercise_id` / `exercise_name` to TeamBuildr’s exercise picker or IDs as needed.
   - **Verify:** Confirm the program is visible and matches the payload (e.g. same number of days, same exercises per day). If verification fails, do not mark as uploaded.
   - **Record success:** Call Supabase to set `uploaded_to_teambuildr = true` for this `programming_generated.id` (and optionally update `member_programs.due_date` as in §4).
3. If any step fails, log and optionally retry; if still failing, leave `uploaded_to_teambuildr = false` and report for human admin.

**Repo implementation:** `teambuilder-sync/upload-programs.ts` queries pending rows, maps session days to weekday dates, and applies §6.1. **Primary mode:** dry run / plan — prints exercises, sets, and reps per date for **manual** TeamBuildr entry; `--mark-uploaded` (or `npm run upload:done`) flags the row after admin confirms. **`--live`** Playwright automation exists but is **experimental** (fragile against TeamBuildr UI). GitHub Actions workflow `.github/workflows/upload-to-teambuildr.yml` is **disabled** by default. See `teambuilder-sync/README.md`.

**Security:**

- Do not hardcode TeamBuildr credentials. Use environment variables or a secrets manager.
- Prefer a dedicated “upload bot” account in TeamBuildr with minimal required permissions.
- Supabase access should use a key with permission only to update `programming_generated` (and optionally `member_programs`), not full DB access.

---

## 7. Summary checklist for the AI

- [ ] Query `programming_generated` for rows with `coach_approved = true` and `uploaded_to_teambuildr = false`.
- [ ] For each row, get `payload`, `member_id`, and member identity (name, email) from `member_database`.
- [ ] In TeamBuildr, find the member and create/update their program to match `payload.sessions` (**§6.1:** only calendar days ≥ today for the **upload** automation; not required for manual admin process unless you adopt the same rule).
- [ ] Verify the program in TeamBuildr matches the payload.
- [ ] Update `programming_generated` set `uploaded_to_teambuildr = true` (and `updated_at`) for that program’s `id`.
- [ ] Optionally update `member_programs.due_date` from `programming_generated.next_due_date`.
- [ ] On failure: do not set `uploaded_to_teambuildr`; log and optionally flag for human admin.
