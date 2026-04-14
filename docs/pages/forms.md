# Forms (`/forms`)

## Purpose And User Outcomes

- Central launcher for operational forms grouped by functional domain.
- Provides clear grouping for Human Resources, Coach Development, and Client Journey forms.

## Route And Entry Points

- Route: `/forms`
- Page: `frontend/src/pages/FormsPage.tsx`

## Data Sources

- Static in-file config (`FORM_GROUPS`) currently defines all links and hierarchy.
- No remote fetch yet from client journey config tables.

## Components And Store Hooks

- Pure page-level rendering using typed config:
  - `FormGroup`
  - `FormSubgroup`
  - `FormLink`
- External links open in new tab with `noopener noreferrer`.

## Business Rules And Edge Cases

- Client Journey group intentionally appears first.
- Nested subgroup rendering is required for role-based journey sections.
- Some links target app routes (e.g. `/client-journey`) and others external tools.

## If AI Is Editing This Page

- Keep `FORM_GROUPS` strongly typed and route-order stable.
- Preserve subgroup indentation and readability (no hidden accordion behavior unless requested).
- Keep external link security attrs on all external anchors.
- If moving toward Supabase-driven forms, isolate transformation logic from render layer.
- Re-check link titles carefully; non-technical users depend on wording.

## Related Docs And Nearby Files

- Shared shell/nav: [`shared/app-shell-navigation.md`](./shared/app-shell-navigation.md)
- Future nearby integration: [`client-journey.md`](./client-journey.md)
- `frontend/src/pages/FormsPage.tsx`
