# Intake & Assessment (`/intake`, `/intake/:memberId`)

## Purpose And User Outcomes

- Single member intake workspace for profile, movement/benchmark assessment, and progress trends.
- Lets coaches move from intake review directly into program editing.

## Route And Entry Points

- Routes: `/intake`, `/intake/:memberId`
- Page: `frontend/src/pages/Intake.tsx`
- Uses `MemberSidebar` in `source="intake"` mode.

## Data Sources

- `member_database` for profile fields.
- `member_memberships` plus related metadata for membership context.
- `member_physicals_raw` latest + history for movement and benchmark data.
- `member_health_metrics` latest + history for body composition and trend charts.

## Components And Store Hooks

- Store: `useEditorStore` for selected member and intake member list.
- Tabs:
  - Client Profile
  - Movement & Benchmarks
  - Progress (`ProgressTab`)
- Progress charting stack: `frontend/src/features/progress/*`.

## Business Rules And Edge Cases

- URL param controls selected member; page syncs route <-> store.
- Fetches latest rows for summary, full history arrays for trends.
- Handles stale async fetches via local request guard (`loadingForRef` pattern).
- Missing data renders placeholder states, not errors.

## If AI Is Editing This Page

- Preserve route/member sync behavior (`/intake/:memberId`).
- Keep profile and progress data fetches separate (latest vs historical).
- Avoid moving scoring rules into UI; keep using `frontend/src/lib/scoring.ts`.
- Ensure "Open Programming Engine" continues to route to `/program/:memberId`.
- Re-check null-safe rendering for missing physicals/health rows.

## Related Docs And Nearby Files

- Shared stores: [`shared/state-stores.md`](./shared/state-stores.md)
- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/Intake.tsx`
- `frontend/src/features/progress/ProgressTab.tsx`
- `frontend/src/lib/scoring.ts`
