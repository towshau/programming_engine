# Profile menu — one-pager (agent handoff)

**Branch:** `feature/profile-menu-experiment`  
**App:** Coach OS frontend (`frontend/`), Vite + React Router.  
**Canonical GitHub repo:** [Lockeroom-Gym/coachOS](https://github.com/Lockeroom-Gym/coachOS) — keep docs and behaviour aligned when merging to `main`.

---

## What we built (high level)

1. **Top-right “LR” avatar** in the global header — circular gold button with initials-style branding (Locker Room). Click toggles a small dropdown menu (not auth yet; placeholder for future account/settings).
2. **Menu items → routes** (stub pages unless noted):
   | Label           | Path              | Page component              | Status        |
   |-----------------|-------------------|-----------------------------|---------------|
   | Forms           | `/forms`          | `FormsPage`                 | **Implemented** (Retool + Jotform links) |
   | Onboarding      | `/onboarding`      | `OnboardingPage`            | Stub          |
   | Client Journey  | `/client-journey` | `ClientJourneyPage`         | **Implemented** (Supabase-backed pipeline & changelog) |
   | 360             | `/360`            | `ThreeSixtyPage`            | Stub          |
   | Churn Risk      | `/churn-risk`     | `ChurnRiskPage`             | Stub          |
3. **Dropdown behaviour:** toggle on click; close on outside click, `Escape`, route change, or after choosing an item.
4. **Design system:** Existing Coach OS patterns — CSS variables (`--bg`, `--border`, `--color-gold`, etc.), Tailwind utility classes. No new primitive library; follow [`.cursor/rules/ui-component-library.mdc`](../.cursor/rules/ui-component-library.mdc) for future UI work (Untitled UI in `frontend/src/components/ui/`).

---

## Key files (where to edit)

| Area | File |
|------|------|
| Header + LR menu + menu config | [`frontend/src/components/layout/AppShell.tsx`](../frontend/src/components/layout/AppShell.tsx) — `PROFILE_MENU_ITEMS` |
| Routes | [`frontend/src/App.tsx`](../frontend/src/App.tsx) |
| Forms (external links, new tab) | [`frontend/src/pages/FormsPage.tsx`](../frontend/src/pages/FormsPage.tsx) |
| Other stub pages | `frontend/src/pages/OnboardingPage.tsx`, `ClientJourneyPage.tsx`, `ThreeSixtyPage.tsx`, `ChurnRiskPage.tsx` |

---

## Forms page — linked URLs (open in new tab)

All use `<a target="_blank" rel="noopener noreferrer">`.

| Title | URL |
|-------|-----|
| Your Personal Coaching Style | `https://lockeroomgym.retool.com/embedded/public/4b3c989a-c19c-4cbb-aaa8-53e664474652` |
| Perfect Session Feedback Form | `https://lockeroomgym.retool.com/embedded/public/e648bfb5-1a82-4e53-b361-80a31b633aec/page1` |
| RM Intensive Form | `https://lockeroomgym.retool.com/embedded/public/24ed10d2-390d-4f28-b667-cf335858ac93/page1` |
| Personal Vision Form | `https://lockeroomgym.retool.com/embedded/public/a737c2cb-0f54-4af0-85ca-112f26a1606a` |
| 6 Month Review Form | `https://form.jotform.com/242898166432062` |

---

## How to run locally

```bash
cd frontend
npm install   # if needed
npm run dev
```

Default: **http://localhost:5173/** — use header **LR** → **Forms** (or navigate to `/forms`).

---

## Repo context (what else exists in this workspace)

- **Engine / pipeline:** See [ONE-PAGE-PLAN.md](./ONE-PAGE-PLAN.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) (and root [ARCHITECTURE.md](../ARCHITECTURE.md)).
- **Lockeroom Supabase (membership, coaches, churn rules):** Full mirror [lockeroom-architecture.md](./lockeroom-architecture.md); summary rule [`.cursor/rules/lockeroom-schema.mdc`](../.cursor/rules/lockeroom-schema.mdc). **Use when work touches member/membership SQL, analytics, or Supabase semantics** — not required for every UI-only change on the profile menu.

---

## Client Journey — Overview

The Client Journey page (`/client-journey`) provides a visual pipeline of the steps a client takes (e.g., Sydney New Member, Melbourne Renewal). It was migrated from an Excalidraw diagram into a robust, data-driven feature.

**Key Features:**
- **Continuous Timeline:** A top section displaying steps horizontally across a scrollable timeline per location, combining New Member and Renewal journeys. It features:
  - Dual anchors: Steps position themselves either relative to the Start Date or Expiry Date.
  - Hybrid Spacing Algorithm: Keeps nodes proportionally spaced according to their day values but enforces a minimum pixel gap to prevent overlap.
  - Membership Length Toggle (3mo/6mo/12mo) which dynamically adjusts the view and filters out conditional steps (e.g., 9-month check-in requiring 12mo+).
  - Scroll-aware tooltips with global page dimming when clicking on nodes.
- **Filtering:** Filter by Location (Sydney, Melbourne) right next to the timeline title, and Journey Type (New Member, Renewal) from the top header bar.
- **Pipeline View:** Visual cards (`JourneyStepCard`) connected by arrows, displaying step title, assigned role, task actions, and external form/resource links.
- **Admin Edit Mode:** Allows editing of step details (Title, Assigned Role, Actions, Links).
- **Changelog (`JourneyChangelog`):** A sidebar that automatically records and displays historical changes to journey steps, grouped by day and step, showing the before/after values and the author.

**Data Model (Supabase):**
- `client_journey_templates`: The overarching journeys (e.g., "Sydney New Member Journey").
- `client_journey_steps`: Individual steps within a journey (JSONB for actions and links). Includes `days_from_start`, `days_from_expiry`, and `min_membership_months` for timeline positioning.
- `client_journey_changelog`: Audit log of all edits.

**Cursor Skill:**
- The `.cursor/skills/update-client-journey/SKILL.md` skill updates client journey data via Cursor. It reads instructions, formats the `assigned_role` explicitly, updates `client_journey_steps` via SQL, and maintains the `client_journey_changelog`.

---

## Suggested next steps (for a follow-on agent)

- Flesh out **Onboarding**, **360**, **Churn Risk** (content, data, or embedded tools as product decides).
- When auth exists: replace stub with real user menu (settings, profile, logout) and keep LR as brand or merge with user avatar.
- Before merge to `main`: reconcile with [coachOS](https://github.com/Lockeroom-Gym/coachOS) and run `npm run build` / lint in `frontend/`.

---

## For new agents — minimal read order

1. [ONE-PAGE-PLAN.md](./ONE-PAGE-PLAN.md) — what the programming engine repo is for.  
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — system layout and data flow.  
3. **This file** — profile menu + routes + forms URLs.  
4. **Only if the task touches Lockeroom DB / SQL / cohort logic:** [lockeroom-architecture.md](./lockeroom-architecture.md) (or pull latest from [lockeroom_schema](https://github.com/Lockeroom-Gym/lockeroom_schema) `architecture.md` and refresh the mirror if rules changed).

That keeps context tight: schema depth only when the task needs it.
