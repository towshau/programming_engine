# TeamBuilder → Supabase Exercise Sync

Syncs exercise programs from TeamBuilder into the `programming_normalized_programs` table in Supabase. Compares exercise lists, flags differences, and auto-updates Supabase to match TeamBuilder's order and exercise selection.

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
| `sync-exercises.ts` | Main sync script |
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

## Planned: Supabase → TeamBuildr upload (not implemented)

A future Playwright script will push finalized programs from `programming_generated` into TeamBuildr (after coach **Finalize** / admin approval flow). **Upload-only rule:** only create or overwrite workouts on calendar dates **≥ today** (gym timezone); never change past days in TeamBuildr. The existing **pull** sync in this folder does **not** use that rule. Details: `docs/admin-upload-instructions-for-ai.md` §6.1.
