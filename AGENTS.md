# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This repo has one implemented component: `exercise-library-sheet-sync/` — a Node.js (ES Modules) script that syncs the `exercise_library` table from Supabase to a Google Sheet. A future Python-based programming engine is planned but not yet implemented.

### Running the sync script

```bash
cd exercise-library-sheet-sync
npm install
npm run sync-exercise-library
```

Requires three environment variables (see `exercise-library-sheet-sync/.env.example`):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `GOOGLE_SERVICE_ACCOUNT_JSON` — Google Cloud service account credentials JSON

Optional: `GOOGLE_SHEET_ID` (defaults to the hardcoded sheet ID in the script).

**Gotcha:** `GOOGLE_SERVICE_ACCOUNT_JSON` must be the full JSON object string (starts with `{`, ~2300 chars). If the secret is stored as a hash/reference rather than the raw JSON, the script will fail with "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON". The Supabase fetch will still succeed independently.

### Development notes

- Node.js 20+ required (CI uses Node 20; v22 works fine).
- No lock file is committed; `npm install` generates one locally.
- No test framework, linter, or build step is configured — the project runs raw `.mjs` files via `node`.
- The script exits with code 1 and a clear error message when required env vars are missing.
- GitHub Actions workflow (`.github/workflows/sync-exercise-library-to-sheet.yml`) runs the sync on a weekly cron or manual dispatch.
