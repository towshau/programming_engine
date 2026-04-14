# AI Page Context Pack

Purpose: compact, route-aligned context for AI-assisted edits in `frontend/` with minimal token overhead.

## How To Use

- Start with the relevant page doc for route-level behavior.
- Open shared docs for cross-cutting logic (shell, stores, contracts).
- Follow each page's "If AI is editing this page" checklist before finalizing.
- Prefer links to source files over copying large code blocks into docs.

## Route Map

- `/` -> [`client-queue.md`](./client-queue.md)
- `/intake` and `/intake/:memberId` -> [`intake-assessment.md`](./intake-assessment.md)
- `/program` and `/program/:memberId` -> [`programming-engine.md`](./programming-engine.md)
- `/holiday` -> [`holiday-programs.md`](./holiday-programs.md)
- `/workbook` -> [`workbook.md`](./workbook.md)
- `/forms` -> [`forms.md`](./forms.md)
- `/onboarding` -> [`onboarding.md`](./onboarding.md)
- `/client-journey` -> [`client-journey.md`](./client-journey.md)
- `/360` -> [`360.md`](./360.md)
- `/rpi` -> [`churn-risk.md`](./churn-risk.md) (`/churn-risk` redirects)
- `/login` -> [`login-auth-gate.md`](./login-auth-gate.md)

## Shared Context

- Navigation shell and top-level route behavior -> [`shared/app-shell-navigation.md`](./shared/app-shell-navigation.md)
- Zustand state ownership and actions -> [`shared/state-stores.md`](./shared/state-stores.md)
- Supabase client, auth, and table-level contracts -> [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)

## Source Of Truth

- Route definitions: `frontend/src/App.tsx`
- Layout shell: `frontend/src/components/layout/AppShell.tsx`
- Editor state: `frontend/src/stores/editorStore.ts`
- Journey state: `frontend/src/stores/journeyStore.ts`
- Supabase client: `frontend/src/lib/supabase.ts`
