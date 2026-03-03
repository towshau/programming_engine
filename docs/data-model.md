# Data model and schema

This doc describes the data the programming engine depends on: existing Supabase tables, member/cohort source, program output, and the engine config tables. Migrations for new tables live in **`supabase/migrations/`** and can be applied with the Supabase CLI or dashboard. Build order: see [build-plan.md](build-plan.md) (Build order).

---

## Existing tables (Supabase)

- **member_tbhealthmax** — (document columns, grain, and how “past programs” are identified; full schema lives in Supabase.)
- **member_tbresults** — Row-based exercise data for all gym members; used as “past programs” for ingest.
- **exercise_library** — Built by trigger from source data: exercise_id, exercise_name, tags. Engine and sync app use this; no invented exercises.
- **Member table (with current_status)** — Source for cohort: filter `current_status = 'active'` to get member IDs for program generation. Confirm table name, “active” value, and join path in your Supabase schema.

---

## Program output and viewing

### programming_past_programs_staging

**Where normalized workouts go:** The normalization tool (`tools/normalize_one_member.py`) writes one row per member per run here. `payload` is jsonb: `sessions` (each with `workout_id`, `assigned_date`, `completed_date`, `exercises`; each exercise has `exercise_name`, `exercise_id`, `sets`).

Normalised past program per member per run (output of normalization tool). Upsert by `(run_id, member_id)` so each run overwrites that run’s data.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `run_id` | uuid | Groups all members in this normalization run |
| `member_id` | uuid | Member |
| `assigned_to` | uuid (nullable) | Optional coach for filter / export by coach |
| `payload` | jsonb | Normalised structure: sessions, exercises, rep ranges |
| `created_at`, `updated_at` | timestamptz | Audit |

Unique `(run_id, member_id)`. Indexes: `run_id`, `member_id`, `assigned_to` (partial). Migration: `20250225100004_create_programming_past_programs_staging.sql`.

### programming_generated

Generated program per member per run (output of engine). Writer in `tools/write_programs.py`. View in Retool; PDF export on demand (see [build-plan.md](build-plan.md) – Viewing and auditing programs).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `run_id` | uuid | Groups all members in this generation run |
| `member_id` | uuid | Member |
| `assigned_to` | uuid (nullable) | Optional coach for filter / export for Coach X |
| `sessions_per_week` | int | 2, 3, or 4 (program days) |
| `duration_weeks` | int (default 6) | Program duration: first = 4 weeks, standard = 6 |
| `phase_number` | int (nullable) | Phase within scheme cycle (e.g. 1–4 for GPP) |
| `scheme_name` | text (nullable) | Denormalised: GPP, Hypertrophy, Strength |
| `rep_range` | text (nullable) | Rep range this program uses (e.g. 10-12) |
| `changes_summary` | text (nullable) | What changed from last phase (human-readable) |
| `rules_applied` | jsonb (nullable) | Array of rule_keys applied during generation |
| `payload` | jsonb | Canonical program JSON (shape TBD in Phase 2) |
| `created_at`, `updated_at` | timestamptz | Audit |

Unique `(run_id, member_id)`. Indexes: `run_id`, `member_id`, `assigned_to` (partial), `created_at`. Migrations: `20250225100005` (create), `20250225100009` (add coach/self-improving columns).

### programming_feedback

Coach feedback on generated programs. Retool form inserts here; feeds into exclusions and rule tuning. See [IMPROVEMENTS.md](IMPROVEMENTS.md).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `run_id` | uuid (nullable) | Which generation run |
| `member_id` | uuid | Which member's program |
| `coach_id` | uuid (nullable) | Who gave feedback |
| `feedback_type` | text | exercise_swap, pairing_issue, too_hard, too_easy, positive, other |
| `details` | text (nullable) | Free text from coach |
| `exercise_id` | uuid (nullable) | If about a specific exercise |
| `resolved` | boolean (default false) | Has it been acted on |
| `created_at`, `updated_at` | timestamptz | Audit |

Indexes: `member_id`, `run_id` (partial), `resolved` (partial, unresolved), `exercise_id` (partial). Migration: `20250225100008`.

---

## Engine config tables (schema to add)

These tables are specified in [engine-config.md](engine-config.md). Add them to the schema section below when implementing; create migrations when adding the tools that read them.

### programming_progression_schemes

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `gym` | gym (enum, nullable) | Uses existing Supabase enum `gym`; NULL = all gyms |
| `name` | text | e.g. "Default Locker Room" |
| `goal` | text (nullable) | e.g. default, strength, hypertrophy for branching |
| `scheme_type` | text (nullable) | Optional alternate identifier for scheme branch |
| `from_rep_range` | text | e.g. "10-12", "8-10" |
| `to_rep_range` | text | e.g. "8-10", "6-8" |
| `exercise_behavior` | text or jsonb | e.g. "same_exercises" \| "allow_exercise_changes" |
| `order` | int | Order when multiple schemes apply |
| `active` | boolean | Include in engine |
| `created_at`, `updated_at` | timestamptz | Audit |

Indexes: `(gym, active)`, `(name, active)`, `(goal, active)` where goal is not null. **Seeded:** GPP (order 1–4, 10-12→8-10→6-8→4-6→10-12), Hypertrophy, Strength. Engine selects by scheme **name** (member’s chosen scheme); cycles through rows in **order**. See [engine-config.md](engine-config.md).

### programming_exercise_exclusions

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `member_id` | uuid (FK) | Member |
| `exercise_id` | uuid (FK) | Exercise to exclude for this member |
| `reason` | text (nullable) | Optional |
| `active` | boolean | If false, exclusion ignored |
| `created_at`, `updated_at` | timestamptz | Audit |

---

## Rules table (existing plan)

- **programming_rules** — Columns: id, gym (enum `gym`, nullable), name, category, rule_key, rule_value (jsonb), priority, active, created_at, updated_at. Engine loads rows where `gym = :gym OR gym IS NULL` and `active = true`; higher priority overrides. Indexes: `(gym, active)`, `(category)`. Narrative source: [programming-rules-source.md](programming-rules-source.md).
