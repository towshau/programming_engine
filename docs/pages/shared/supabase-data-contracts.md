# Shared: Supabase Data Contracts

## Purpose

- Canonical quick-reference for frontend Supabase usage patterns and table ownership.
- Helps AI edits stay aligned with existing query semantics and auth behavior.

## Core Client/Auth Files

- Supabase client: `frontend/src/lib/supabase.ts`
  - Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Auth provider: `frontend/src/lib/auth.tsx`
  - Session management
  - Google/email login
  - `staff_database` sync on auth events

## Route-Critical Tables

- Queue + member context:
  - `member_database`
  - `member_memberships`
  - `member_programs`
  - `member_holds`
  - `programming_generated`
- Programming editor:
  - `programming_generated`
  - `programming_coach_edits`
  - `programming_progression_schemes`
  - `programming_regeneration_requests`
  - `exercise_library`
  - `member_tbresults`
- Intake/progress:
  - `member_physicals_raw`
  - `member_health_metrics`
- Journey:
  - `client_journey_templates`
  - `client_journey_steps`
  - `client_journey_changelog`
- Churn risk:
  - `member_churn_risk`
  - `member_churn_risk_history`
  - `member_batch_attendance`
  - `staff_database`
- Workbook:
  - `member_memberships`
  - `membership_types`
  - `member_database`

## Contract Notes

- `programming_generated` differentiates regular vs holiday via `program_type`.
- Program payload editing is persisted by writing modified `payload` plus lifecycle flags.
- Coach selection logic uses effective assignment precedence in multiple places.
- Churn views map staff IDs to names through `staff_database`.

## If AI Is Editing Queries

- Keep query responsibility in stores/hooks where it currently lives.
- Preserve filter fields used by operational logic (status, stage, date windows).
- Treat nullable date fields defensively in UI.
- Do not commit real credentials; reference `.env.example` variables only.

## Referenced By Page Docs

- [`../client-queue.md`](../client-queue.md)
- [`../intake-assessment.md`](../intake-assessment.md)
- [`../programming-engine.md`](../programming-engine.md)
- [`../holiday-programs.md`](../holiday-programs.md)
- [`../churn-risk.md`](../churn-risk.md)
- [`../login-auth-gate.md`](../login-auth-gate.md)
