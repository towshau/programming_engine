# Build plan – additional items

This doc holds extra build-plan subsections that complement the main plan (see [programming-engine-plan.md](programming-engine-plan.md) when present) and [engine-config.md](engine-config.md).

---

## Build order (simple)

**Step 1: Tables first**  
Create the new Supabase tables the engine and admin flow need. Order:

1. **programming_progression_schemes** — rep-range progression config (from/to, exercise_behavior, etc.).
2. **programming_exercise_exclusions** — which exercises to exclude per member.
3. **programming_removal_requests** — queue for “deleted exercise” reports; admin form (Retool) writes here; senior coach reviews.
4. **programming_rules** — general rules (gym, category, rule_key, rule_value); create if it doesn’t already exist.

Migrations live in `supabase/migrations/`. Apply with Supabase CLI or the Supabase dashboard.

**Step 2: Normalization**  
Build the ingest/normalization piece: read **member_tbresults** + **exercise_library** and produce a **normalized “past program” per member** (e.g. one structure per member with sessions, exercises, rep ranges). This lets you validate that the raw data is being interpreted correctly before wiring in rules and LLM. Deliverable: a script or tool (e.g. in `tools/`) that writes to a staging table (see below) so programs are viewable and auditable.

---

## Viewing and auditing programs (normalised past + generated)

**Where they live:** Supabase. Normalised past programs → staging table (e.g. `programming_past_programs_staging`). Generated programs → program output table (e.g. `programming_generated`). Single source of truth; no duplicate storage.

**How you view them:** Retool (or similar) connected to Supabase. Build a view/list that queries these tables — filter by member, date range, and (when you have it) **coach**. Easy to read in the browser; always current.

**Auditable / shareable:** Generate **PDFs on demand** instead of storing thousands of static PDFs. For example:
- “Export this run to PDF” — one PDF per normalization/generation run (or per member in that run) for audit or records.
- “Export programs for Coach X to PDF” — filter by coach (once coach is on the program or member), then run PDF export for that subset. Lets you split and hand off by coach in the future without changing where data lives.

Implementation: a small export step (script or Retool button) that reads from the same Supabase tables, renders a readable layout (member name, sessions, exercises, rep ranges, dates), and outputs PDF. Optional: store generated PDFs in Supabase Storage or a shared drive by run ID or coach for archive.

---

## Deleted exercises – admin flow (Retool)

**Goal:** Give admin a way to log exercises that no longer exist (e.g. removed from the source system or reported by users) without directly deleting rows in Supabase.

**Approach:**

- **Form:** Admin uses a Retool app that connects to Supabase. The form captures “this exercise should be treated as deleted” (e.g. exercise identifier, reason, who reported).
- **On submit:** Do **not** run a delete query on the exercise library (too risky). Instead, create a **review record** (e.g. in a table like `programming_removal_requests` or `deleted_exercise_reports`) and send the request to the **head coach or a senior coach** for review.
- **After review:** A separate, controlled process (manual or approved action in Retool) handles actual removal/deactivation once the senior coach approves. That keeps a clear audit trail and avoids accidental deletes.

**Implementation notes:** Add a Supabase table for the review queue (e.g. `programming_removal_requests`: id, exercise_id or external_ref, reason, submitted_by, status [pending / approved / rejected], reviewed_by, reviewed_at, created_at). Retool form inserts into this table; Retool (or another view) shows a queue for the head/senior coach to approve or reject. Actual delete/soft-delete of the exercise is a separate, gated step after approval.

---

## Progression model – branching by goal

**Goal:** Support different progression paths for different member goals (e.g. strength-focused vs hypertrophy vs other) instead of a single one-size-fits-all scheme.

**Ways to branch:**

1. **Scheme name / type on `programming_progression_schemes`**  
   Keep one table; add an optional column such as `goal` or `scheme_type` (e.g. `"default"`, `"strength"`, `"hypertrophy"`). Create separate rows for each goal: e.g. (Default Locker Room, default, 10–12 → 8–10, same_exercises) vs (Strength focus, strength, 10–12 → 6–8, allow_exercise_changes). The engine chooses which rows to use based on the member’s goal.

2. **Member-level goal or scheme preference**  
   Store the member’s goal (or chosen scheme name) somewhere the engine can read: e.g. a `member` or `member_config` field like `primary_goal` or `progression_scheme_name`. When generating a program, the engine filters `programming_progression_schemes` by that goal/scheme (and gym) so strength members get strength rows, hypertrophy get hypertrophy rows, etc.

3. **Multiple named schemes, same table**  
   You already have `name` on `programming_progression_schemes` (e.g. "Default Locker Room"). Add more names: "Default Locker Room", "Strength focus", "Hypertrophy focus". Each name has its own set of from/to/behavior rows. Member config or program metadata stores which scheme name applies; engine looks up by `name` (and gym). No schema change beyond using `name` as the branch key.

4. **Separate tables per goal**  
   Possible but usually unnecessary: e.g. `progression_schemes_strength`, `progression_schemes_hypertrophy`. Harder to maintain and to add new goals; only consider if you need completely different columns per goal.

**Recommendation:** Use (1) + (2): add an optional `goal` or `scheme_type` (or reuse `name` as the scheme identifier) on `programming_progression_schemes`, and an optional member-level field for goal or preferred scheme. Engine: for each member, read their goal/scheme → filter `programming_progression_schemes` by that and gym → apply the matching transitions. Same table, minimal schema change, easy to add or change goals later.

**Open:** Where does “member goal” live today (if at all)? If it doesn’t exist yet, add it to “questions to answer later” or to the member/schema section in [data-model.md](data-model.md).
