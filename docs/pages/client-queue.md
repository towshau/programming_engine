# Client Queue (`/`)

## Purpose And User Outcomes

- Coach landing page to triage members into actionable queues.
- Prioritizes first-program work, upcoming phase changes, active approved programs, and holiday/hold logistics.
- Quick navigation into program editing and holiday program workflows.

## Route And Entry Points

- Route: `/`
- Main component: `frontend/src/pages/ClientQueue.tsx`
- Wrapped by authenticated shell: `ProtectedRoute` -> `AppShell`

## Data Sources

- Driven from `useEditorStore().members` (`frontend/src/stores/editorStore.ts`).
- Underlying queries include:
  - `member_database`
  - `member_memberships`
  - `member_programs`
  - `programming_generated` (regular and holiday)
  - `member_holds`

## Components And Store Hooks

- `ClientQueue` computes tab slices from `members`.
- `selectMember` in store sets selected member context.
- Navigation behavior:
  - Program tabs -> `/program/:memberId`
  - Holiday/Holds tab -> `/holiday`

## Business Rules And Edge Cases

- "Awaiting First Program" uses `is_new` logic from store (newsale + recent start).
- "New Training Phase Due" includes active members with no program or expiring soon.
- Holiday tab is populated by either future holds or holiday programs.
- `draft_status` badge logic comes from store-derived workflow state.

## If AI Is Editing This Page

- Preserve tab definitions and counts (`awaiting`, `phasedue`, `active`, `holiday`).
- Do not re-implement data fetching here; keep queue logic store-driven.
- Keep holiday row click behavior opening `/holiday` and setting member context.
- Maintain badge semantics (`awaiting_draft`, `draft_ready`, `approved`, `uploaded`).
- Verify empty states still render per tab.

## Related Docs And Nearby Files

- Shared shell/nav: [`shared/app-shell-navigation.md`](./shared/app-shell-navigation.md)
- Shared stores: [`shared/state-stores.md`](./shared/state-stores.md)
- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/ClientQueue.tsx`
- `frontend/src/stores/editorStore.ts`
