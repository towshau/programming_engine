# Client Journey (`/client-journey`)

## Purpose And User Outcomes

- Visual and operational control surface for templated client journey pipelines.
- Combines location/type filtering, timeline positioning, step cards, and changelog visibility.

## Route And Entry Points

- Route: `/client-journey`
- Page: `frontend/src/pages/ClientJourneyPage.tsx`

## Data Sources

- `client_journey_templates`
- `client_journey_steps`
- `client_journey_changelog`
- Data lifecycle managed through `useJourneyStore`.

## Components And Store Hooks

- Store: `frontend/src/stores/journeyStore.ts`
- Main feature components:
  - `JourneyFilters`
  - `JourneyTimeline`
  - `JourneyPipeline`
  - `JourneyChangelog`

## Business Rules And Edge Cases

- Timeline supports dual anchors (`days_from_start`, `days_from_expiry`) and membership-length gating.
- Steps can be hidden conditionally when `min_membership_months` exceeds selected length.
- Timeline node click opens detailed tooltip with actions/forms metadata.
- Filtering (`location`, `journey_type`) applies to both timeline and pipeline render.

## If AI Is Editing This Page

- Keep data fetching centralized in `journeyStore.fetchJourneys`.
- Preserve timeline anchor semantics and membership-length behavior.
- Avoid duplicating step mutation logic in components; use store mutation APIs.
- Keep changelog sidebar independent from timeline rendering lifecycle.
- Re-check performance if adding heavy UI operations to timeline nodes.

## Related Docs And Nearby Files

- Shared stores: [`shared/state-stores.md`](./shared/state-stores.md)
- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/ClientJourneyPage.tsx`
- `frontend/src/features/journey/JourneyTimeline.tsx`
- `frontend/src/stores/journeyStore.ts`
