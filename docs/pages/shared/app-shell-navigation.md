# Shared: App Shell And Navigation

## Purpose

- Defines global authenticated layout and route navigation behavior.
- Centralizes top nav, coach selector, profile menu, and page outlet rendering.

## Core Files

- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/ProtectedRoute.tsx`

## Navigation Structure

- Primary top-nav pages:
  - Client Queue
  - Intake & Assessment
  - Programming Engine
  - Holiday Programs
  - Workbook
- Profile menu pages:
  - Forms
  - Onboarding
  - Client Journey
  - 360
  - RPI

## Shared Behaviors

- App shell calls `fetchCoaches()` and `fetchMembers()` on mount.
- Coach selector updates global member filtering via `selectCoach`.
- Profile avatar initials derive from authenticated user metadata (`full_name`) with `LR` fallback.
- `Sign Out` lives inside profile menu.

## Auth Gate Integration

- Public route: `/login`
- All app routes are nested under `ProtectedRoute` and `AppShell`.
- `ProtectedRoute` respects `bypassAuth` for local dev flows.

## If AI Is Editing Shell/Nav

- Keep route map in `App.tsx` aligned with visible menu links.
- Do not duplicate coach/member fetch logic across pages.
- Preserve menu close-on-route-change behavior in `AppShell`.
- Keep profile menu actions keyboard/escape/outside-click safe.

## Referenced By Page Docs

- [`../client-queue.md`](../client-queue.md)
- [`../programming-engine.md`](../programming-engine.md)
- [`../forms.md`](../forms.md)
- [`../onboarding.md`](../onboarding.md)
- [`../360.md`](../360.md)
