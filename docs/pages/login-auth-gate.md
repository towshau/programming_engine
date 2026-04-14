# Login Auth Gate (`/login`)

## Purpose And User Outcomes

- Secure gate for authenticated access to all core app routes.
- Supports Google OAuth and email/password sign-in, with a dev-only bypass mode.

## Route And Entry Points

- Public route: `/login` (`frontend/src/pages/LoginPage.tsx`)
- Protected wrapper: `frontend/src/components/layout/ProtectedRoute.tsx`
- Auth context/provider: `frontend/src/lib/auth.tsx`

## Data Sources

- Supabase Auth session (`supabase.auth.getSession`, auth state listener).
- `staff_database` sync on successful auth (maps/creates auth-linked staff row).

## Components And Store Hooks

- `AuthProvider` wraps app root in `frontend/src/main.tsx`.
- `useAuth` exposes:
  - `session`
  - `user`
  - `loading`
  - `bypassAuth`
  - auth actions (`signIn`, `signInWithGoogle`, `signOut`)

## Business Rules And Edge Cases

- Dev bypass is enabled only when:
  - `import.meta.env.DEV`
  - `VITE_BYPASS_AUTH === 'true'`
- `ProtectedRoute` allows direct access when bypass is true.
- Login page auto-redirects to `/` when session exists or bypass enabled.
- User sync logic should not overwrite mismatched `auth_id` ownership.

## If AI Is Editing This Page

- Keep bypass strictly dev-only and env-flag guarded.
- Avoid introducing auth redirects that conflict with `ProtectedRoute`.
- Preserve `staff_database` sync safety checks (auth_id/email matching).
- Keep login UX independent from app shell styling and navigation.
- Re-test both modes: real auth and bypass auth.

## Related Docs And Nearby Files

- Shared contracts: [`shared/supabase-data-contracts.md`](./shared/supabase-data-contracts.md)
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/lib/auth.tsx`
- `frontend/src/components/layout/ProtectedRoute.tsx`
