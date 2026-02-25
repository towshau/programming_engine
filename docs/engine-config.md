# Engine config and rules separation

This doc describes the separation between staff-facing rules and engine-facing config, and the two dedicated config tables for progression and member exclusions. See also [programming-engine-plan.md](programming-engine-plan.md) and [programming-rules-source.md](programming-rules-source.md).

---

## 1. Staff rules vs engine rules

**Staff rules (coaches / operations)**

- **Where:** [programming-rules-source.md](programming-rules-source.md) — canonical narrative (how to build programs, pairings, C-series, timing, approvals).
- **Purpose:** Human process and standards. Some items (e.g. “no new exercises without approval”) apply to everyone and also constrain the engine: **never invent exercises; only use the exercise library.**

**Engine rules and config (machine-readable)**

- **Where:** Supabase tables the engine reads at runtime.
- **Existing/planned:** `programming_rules` (gym-scoped, category, rule_key, rule_value jsonb, priority, active) for general rules.
- **Dedicated config:** Two concepts below — progression schemes (how to move rep ranges) and member-level exercise exclusions. These are config, not narrative; they can be modified after the fact.

Summary: narrative doc = staff; Supabase = engine (plus shared rules like “only exercise_library” encoded in engine behaviour and optionally as a row in `programming_rules`).

---

## 2. Progression schemes (`programming_progression_schemes`)

**Goal:** Define standard rep-range progression (e.g. 10–12 → 8–10 → 6–8 → 4–6) and, per transition, whether to keep the same exercises or allow exercise changes. Configurable and editable later.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `gym` | gym (enum, nullable) | Uses Supabase enum `gym`; NULL = all gyms |
| `name` | text | e.g. "Default Locker Room" |
| `goal` | text (nullable) | e.g. default, strength, hypertrophy for branching |
| `scheme_type` | text (nullable) | Optional scheme branch identifier |
| `from_rep_range` | text | e.g. "10-12", "8-10" |
| `to_rep_range` | text | e.g. "8-10", "6-8" |
| `exercise_behavior` | text or jsonb | e.g. "same_exercises" \| "allow_exercise_changes"; or JSON for future options |
| `order` | int | Order of steps if multiple schemes apply |
| `active` | boolean | Include in engine |
| `created_at`, `updated_at` | timestamptz | Audit |

**Example rows:** (Default Locker Room, 10-12 → 8-10, same_exercises); (Default Locker Room, 8-10 → 6-8, same_exercises); (Default Locker Room, 6-8 → 4-6, allow_exercise_changes).

**Engine use:** When generating the next program, determine “from” rep range (e.g. from last program), look up `to_rep_range` and `exercise_behavior` from this table, and apply (same exercises vs allow changes). Each scheme is a **name** (GPP, Hypertrophy, Strength) with rows ordered 1–4; member has a selected scheme (default GPP). Engine loads rows for that name by order; current rep range picks the row (from_rep_range = current); next phase = that row's to_rep_range. Last step cycles (e.g. GPP 4-6 to 10-12). Seeded: GPP, Hypertrophy, Strength (migration 20250225100007). Schemes editable in table without code changes.

---

## 3. Member-level exercise exclusions (`programming_exercise_exclusions`)

**Goal:** “Do not include these exercises for these members” — select members and select exercises to exclude (injury, preference, equipment, etc.).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `member_id` | uuid (FK) | Member |
| `exercise_id` | uuid (FK to exercise_library or source table) | Exercise to exclude for this member |
| `reason` | text (nullable) | Optional: "injury", "preference", etc. |
| `active` | boolean | If false, exclusion ignored |
| `created_at`, `updated_at` | timestamptz | Audit |

One row per (member, exercise). Engine: before generating a program for a member, load all active exclusions for that member and never assign those exercises.

**Optional later:** Rule-based exclusions (e.g. “no walking lunges for these members”) via something like `member_exclusion_rules` (member_id + rule_key) that the engine resolves to exercise IDs. Start with `programming_exercise_exclusions` only.

---

## 4. How this fits the engine

- **Exercise library only:** Engine never invents exercises (staff rule → only use `exercise_library`). Enforce in code; optional row in `programming_rules`.
- **Progression:** Ingest last program → current rep range → lookup `programming_progression_schemes` → next rep range + `exercise_behavior` → pass to generator (same exercises vs allow changes).
- **Exclusions:** Before generate, load `programming_exercise_exclusions` for member → pass excluded exercise IDs to generator (or filter in a tool) so they are never selected.
