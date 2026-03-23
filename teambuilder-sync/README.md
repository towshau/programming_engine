# TeamBuilder Sync

Two-way sync between TeamBuildr and Supabase using Playwright browser automation.

- **Pull** (`sync-exercises.ts`, `batch-sync.ts`): scrape workouts from TeamBuildr into Supabase.
- **Push** (`upload-programs.ts`): plan pending uploads and print exercises/reps for admin manual entry into TeamBuildr. Flags programs as uploaded after entry.

## Setup

```bash
cd teambuilder-sync
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env with your actual credentials
```

## Workflow

### Step 1: Inspect TeamBuilder DOM (do this first)

The sync script has placeholder CSS selectors that need to be replaced with real ones from TeamBuilder. Run the inspector to find them:

```bash
npm run inspect
```

This opens a browser, lets you log in and navigate to a member's program, then dumps the page structure. Use the output to update the `TODO` sections in `sync-exercises.ts`.

If the terminal cannot receive Enter (e.g. some IDE runners), use a timed wait instead: `npm run inspect:auto` (waits 90s before dumping, then 15s before closing; override with `TEAMBUILDER_INSPECT_AUTO_SECONDS` / `TEAMBUILDER_INSPECT_CLOSE_SECONDS`).

### Step 2: Dry run

```bash
npx ts-node sync-exercises.ts --member="John Smith" --dry-run
```

This scrapes TeamBuilder, queries Supabase, prints the diff, but makes no changes.

### Step 3: Live sync

```bash
npx ts-node sync-exercises.ts --member="John Smith" --session-date="2025-04-28"
```

This will update Supabase to match TeamBuilder.

## What it does

1. **Logs into TeamBuilder** via Playwright (headless browser)
2. **Navigates to the member's program** page
3. **Scrapes the exercise list** (names and order)
4. **Queries Supabase** `programming_normalized_programs` for the same member
5. **Compares**: finds missing exercises, order mismatches
6. **Updates Supabase**: reorders exercises to match TeamBuilder, adds any missing ones

## Key files

| File | Purpose |
|------|---------|
| `sync-exercises.ts` | Main pull sync script |
| `batch-sync.ts` | Batch pull for many members |
| `upload-programs.ts` | Push planner: show pending programs with exercises/reps; mark uploaded after manual entry |
| `inspect-teambuilder.ts` | Helper to find DOM selectors |
| `.env` | Credentials (not committed) |

## Selectors to update

Search for `TODO: UPDATE THESE SELECTORS` in `sync-exercises.ts`. You need to update:

1. **Login form** — email input, password input, submit button
2. **Member search** — how to find and click on a member
3. **Program navigation** — how to get to the exercise list
4. **Exercise list** — the container and individual exercise elements

## Data structure

Supabase `programming_normalized_programs.payload` structure:

```json
{
  "sessions": [
    {
      "assigned_date": "2025-04-28",
      "completed_date": "2025-04-29",
      "workout_id": "1014693245",
      "exercises": [
        {
          "exercise_name": "Squat - Back - Barbell - High Bar",
          "exercise_id": "1212964109",
          "tags": "Lower Body Push",
          "sets": [
            { "reps": 5, "result": "180", "set_number": 1 }
          ]
        }
      ]
    }
  ]
}
```

The sync reorders the `exercises` array within a session to match TeamBuilder's order.

## Supabase → TeamBuildr upload (push)

`upload-programs.ts` targets rows in `programming_generated` where `coach_approved = true` and `uploaded_to_teambuildr = false`.

**Workflow: admin uploads exercises manually in TeamBuildr, then marks done.**

1. `npm run upload` — prints every pending program with dates, exercises, sets and reps.
2. Admin opens TeamBuildr, enters exercises per day.
3. `npm run upload:done` (or `-- --program-id <uuid> --mark-uploaded`) — sets `uploaded_to_teambuildr = true`.

```bash
# Plan: show what needs uploading (exercises, sets, reps per date)
npm run upload
npm run upload -- --program-id <uuid>

# After manual entry: mark program(s) as uploaded
npm run upload:done
npm run upload:done -- --program-id <uuid>

# (Experimental) Playwright automation — fragile, not recommended
npm run upload:live -- --program-id <uuid>
```

**Date mapping:** sessions map to weekday dates from the Monday of the current week (or `next_due_date` if future, or `--week-start`). Past dates are skipped.
