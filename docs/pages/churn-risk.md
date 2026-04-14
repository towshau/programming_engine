# Renewal Probability Index (RPI) (`/rpi`)

## Purpose And User Outcomes

- Operational renewal dashboard to estimate likely renewals and prioritize retention work.
- Combines summary tiers, stakeholder views, sortable table, per-member detail expansion, and a top-line renewal probability metric.

## Route And Entry Points

- Route: `/rpi`
- Legacy redirect: `/churn-risk` -> `/rpi`
- Page: `frontend/src/pages/ChurnRiskPage.tsx`

## Data Sources

- `member_churn_risk` for primary scored rows.
- `member_churn_risk_history` for trend line points.
- `member_batch_attendance` for expanded detail attendance snapshots.
- `staff_database` for coach/renewal lead name mapping.

## Components And Store Hooks

- Hooks:
  - `useChurnRisk`
  - `useChurnDetail`
- Components:
  - `ChurnSummaryStrip`
  - `StakeholderBreakdown`
  - `ChurnTable`
  - row expansion via `ChurnRow`

## Business Rules And Edge Cases

- Tier filtering is multi-select and impacts summary/table simultaneously.
- Display tiers are normalized to three buckets:
  - `high` = raw `high` + raw `critical` (merged)
  - `medium` = raw `medium`
  - `low` = raw `low`
- Tier colors are red/yellow/green (high/medium/low).
- Expansion fetch is lazy and cached by member ID.
- `days_to_renewal` uses calendar-day calculation against membership end date.
- Pipeline flags (`bad_churn`, `good_churn`) segment table sections.
- Renewal probability formula in summary strip (weights are churn probability per tier):
  - High = 90% churn, Medium = 50% churn, Low = 10% churn
  - Expected renewals = `high * 0.10 + medium * 0.50 + low * 0.90`
  - Renewal probability % = `(expected renewals / total members) * 100`

## If AI Is Editing This Page

- Keep fetch/mapping in hooks, not in rendering components.
- Preserve lazy detail loading to avoid expensive initial queries.
- Maintain explicit sort semantics for nullable `days_to_renewal`.
- Keep tier labels/colors + critical->high normalization aligned with `tierUtils`.
- Re-test tier filter + search + load more interactions together.

## Related Docs And Nearby Files

- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/ChurnRiskPage.tsx`
- `frontend/src/features/churn/useChurnRisk.ts`
- `frontend/src/features/churn/useChurnDetail.ts`
- `frontend/src/features/churn/ChurnTable.tsx`
