# Onboarding (`/onboarding`)

## Purpose And User Outcomes

- Placeholder page reserved for onboarding workflows in the profile menu area.
- Current value is scaffold visibility and navigation completeness.

## Route And Entry Points

- Route: `/onboarding`
- Page: `frontend/src/pages/OnboardingPage.tsx`

## Data Sources

- None currently.

## Components And Store Hooks

- Static scaffold card only.
- No store hooks or API calls.

## Business Rules And Edge Cases

- Must remain accessible from profile menu in `AppShell`.
- Should follow shared light-theme card style tokens.

## If AI Is Editing This Page

- Keep implementation intentionally simple unless feature requirements are provided.
- Preserve route and shell integration.
- If adding data, document table contracts in shared docs.
- Keep naming/heading consistent with sidebar and profile menu labels.

## Related Docs And Nearby Files

- Shared shell/nav: [`shared/app-shell-navigation.md`](./shared/app-shell-navigation.md)
- Shared contracts (for future integration): [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/OnboardingPage.tsx`
