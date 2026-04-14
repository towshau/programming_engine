# Workbook (`/workbook`)

## Purpose And User Outcomes

- Coach workbook view for operational check-ins, membership context, and notes workflows.
- Filters members by selected coach and optional gym/status filters.

## Route And Entry Points

- Route: `/workbook`
- Page: `frontend/src/pages/Workbook.tsx`

## Data Sources

- Hook: `useWorkbookMembers` (`frontend/src/features/workbook/hooks/useWorkbookMembers.ts`).
- Pulls from:
  - `member_memberships` (primary and secondary)
  - related `membership_types`
  - `member_database` (member naming)

## Components And Store Hooks

- Uses top-bar selected coach from `useEditorStore`.
- Primary components:
  - `GymFilter`
  - `MemberTable`
- Local UI state controls section collapse and note expansion.

## Business Rules And Edge Cases

- No coach selected -> empty member set by design.
- Effective coach matching prefers `handoff_coach_id` over `coach_id`.
- Primary membership drives expiry and status display.
- Supports "active only" filtering in-page.

## If AI Is Editing This Page

- Keep workbook data in hook (`useWorkbookMembers`), not page component.
- Preserve coach-first gating (empty when no selected coach).
- Do not break first-name sort key behavior used for stable ordering.
- Keep `activeOnly` and gym filters independent and composable.
- Verify collapsed sections persist expected UX.

## Related Docs And Nearby Files

- Shared shell/nav: [`shared/app-shell-navigation.md`](./shared/app-shell-navigation.md)
- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/Workbook.tsx`
- `frontend/src/features/workbook/hooks/useWorkbookMembers.ts`
