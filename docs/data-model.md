# Data Model — Programming Engine

## Overview

The engine reads from Supabase tables and writes to `programming_generated`. `member_database` defines the cohort. `member_tbresults` provides raw exercise data from TeamBuildr. `programming_normalized_programs` is our enriched layer that adds series labels, exercise order, and pairings (missing from TB exports). `programming_rules` and `programming_exercise_exclusions` control generation logic. Migrations live in `supabase/migrations/`.

---

## Tables

### member_database

**Purpose:** Master member table. Defines who gets a program.

**Cohort query:**
```sql
SELECT id, member_name, coach_id, gym_string, injuries, goals, contraindications
FROM member_database
WHERE current_status = 'active' AND test_account = false;
```

**Key columns for the engine:**

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK; join key to all member_* tables |
| current_status | membership_status enum | Filter: `'active'` only |
| test_account | boolean | Filter: `false` only |
| coach_id | uuid | FK to staff_database; programming coach |
| gym_string | text | Gym location; used to load gym-specific rules |
| injuries | text | Free-text; feeds exclusion logic |
| goals | text | Free-text; informs progression choice |
| contraindications | text | Free-text; feeds exclusion logic |

**current_status enum values:** active, on_hold, trial, online_coaching, boxing_pack, expired, no_sale, F&F, inactive.

---

### member_tbresults

**Purpose:** Raw exercise data from TeamBuildr export. One row = one set of one exercise.

| Column | Type | Use |
|--------|------|-----|
| id | bigint | PK (auto-increment) |
| member_id | uuid | FK to member_database.id |
| member_name | text | Denormalized |
| exercise_name | text | Full exercise name |
| assigned_date | date | Date workout was assigned; identifies the training day |
| completed_date | date | Date member actually completed it |
| set_number | numeric | Which set (1, 2, 3…) |
| result | text | Weight/value achieved |
| reps | numeric | Reps performed |
| workout_id | numeric | TeamBuildr workout ID; one per exercise per day |
| tags | text | Exercise tag (e.g. "Vertical Press", "Horizontal Pull") |

**Grain:** One row per set per exercise per day per member. A 3-set exercise = 3 rows. Unilateral exercises may double (left + right).

**What it does NOT contain:** Exercise order, series assignment (A/B/C), or pairing information. These are UI-only in TeamBuildr and not included in exports.

**Program detection logic:**
- No phase or program_id column. Programs are detected by comparing exercises week over week.
- A program stays the same for 4–6 weeks (same exercises, same structure).
- If the full week's exercises change, that signals a new program.
- Minor mid-week adjustments (1–2 exercise swaps) are adjustments, not a new program.
- Use the most recent N weeks (6–8) of data to identify the current program rather than just the latest assigned_date.

**Identifying one training day:** Group by `member_id` + `assigned_date`. A 3D member has 3 distinct `assigned_date` values per week, each with a different set of exercises.

---

### programming_normalized_programs

**Purpose:** Enriched layer on top of member_tbresults. Adds series labels, exercise order, and pairings missing from TB exports. Engine's baseline for generating the next program. (Renamed from `programming_past_programs_staging`.)

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK |
| run_id | uuid | Groups all members in one normalization run |
| member_id | uuid | FK to member_database.id |
| assigned_to | uuid (nullable) | Optional coach filter |
| payload | jsonb | Normalized program structure (see below) |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update (sync or coach feedback) |

Unique `(run_id, member_id)`. Migration: `20250225100004`.

**Payload structure:**
```json
{
  "sessions": [
    {
      "day": "2025-01-14",
      "assigned_date": "2025-01-14",
      "completed_date": "2025-01-16",
      "exercises": [
        {
          "series_label": "A1",
          "exercise_name": "Chin Up - Medium Grip",
          "exercise_id": "1200726784",
          "tags": "Vertical Pull",
          "series_assignment": ["A", "B"],
          "sets": [{"set_number": 1, "reps": 6, "result": "0"}]
        }
      ]
    }
  ],
  "phase_detection": { "...see Phase Detection below..." }
}
```

**Key payload fields:**
- `series_label` — A1, A2, B1, C1, Warm Up. Gives exercise order and series.
- `series_assignment` — Which series this exercise belongs to (for pairing logic).
- `sets` — Per-set data with actual reps/result (completed data from TB).
- `phase_detection` — Added when `--scheme` is passed to normalization tool.

**Weekly sync/diff process:**
1. Pull latest week from `member_tbresults` for each active member.
2. Compare against the payload here.
3. Same exercises → update weights/reps, keep our order.
4. Minor change (1–2 exercises differ) → slot new exercise into same position.
5. Whole week different → new program detected. Archive old record, create new, infer order from rules.

**Coach feedback:** When a coach corrects exercise order or series assignments, update the payload immediately. Corrected version becomes baseline for next generation.

---

### programming_generated

**Purpose:** Engine output. One row = one generated program for one member in one run.

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK |
| run_id | uuid | Groups all members in one generation run |
| member_id | uuid | FK to member_database.id |
| assigned_to | uuid (nullable) | Coach assignment for filter/export |
| sessions_per_week | integer | 2, 3, or 4 (same as last time) |
| duration_weeks | integer (default 6) | First program = 4 weeks, standard = 6 |
| phase_number | integer (nullable) | Phase within scheme cycle (1–4) |
| scheme_name | text (nullable) | GPP, Hypertrophy, Strength, etc. |
| rep_range | text (nullable) | e.g. "10-12", "4-6" |
| changes_summary | text (nullable) | What changed from last phase (human-readable) |
| rules_applied | jsonb (nullable) | Array of rule_keys applied during generation |
| payload | jsonb | Canonical program JSON (see below) |
| created_at, updated_at | timestamptz | Audit |

Unique `(run_id, member_id)`. Migrations: `20250225100005` (create), `20250225100009` (add coach columns). Writer: `tools/write_programs.py`.

#### Canonical Program JSON (payload)

```json
{
  "metadata": {
    "run_id": "uuid",
    "member_id": "uuid",
    "scheme": "GPP",
    "confidence": "high",
    "phase_order": 4,
    "duration_weeks": 6,
    "sessions_per_week": 3,
    "current_rep_range": "6-8",
    "next_rep_range": "4-6",
    "exercise_behavior": "same_exercises"
  },
  "sessions": [
    {
      "day": 1,
      "exercises": [
        {
          "series_label": "A1",
          "exercise_name": "Press - Flat - Dumbbell",
          "exercise_id": "1182509177",
          "tags": "Horizontal Press",
          "sets": [
            {"set_number": 1, "reps": "4-6"},
            {"set_number": 2, "reps": "4-6"},
            {"set_number": 3, "reps": "4-6"}
          ]
        }
      ]
    }
  ]
}
```

**Key payload fields:**
- `metadata.scheme` — progression scheme (GPP, Hypertrophy, Strength).
- `metadata.confidence` — high / medium / low; certainty of phase detection.
- `metadata.exercise_behavior` — `same_exercises` (keep exercises, change reps) vs new selection.
- `sessions[].day` — day number (1, 2, 3).
- `sessions[].exercises[]` — ordered list; `series_label` defines structure.
- `sets[].reps` — prescribed rep range (string like "4-6"), not completed reps.

**Difference from normalized payload:** Normalized = past program (actual weights/results). Generated = next program (prescribed rep ranges). Same exercise shape so generated output becomes the next normalized baseline after completion.

---

### programming_feedback

**Purpose:** Coach feedback on generated programs. Retool form inserts here; feeds into exclusions and rule tuning.

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK |
| run_id | uuid (nullable) | Which generation run |
| member_id | uuid | Which member's program |
| coach_id | uuid (nullable) | Who gave feedback |
| feedback_type | text | exercise_swap, pairing_issue, too_hard, too_easy, positive, other |
| details | text (nullable) | Free text from coach |
| exercise_id | uuid (nullable) | If about a specific exercise |
| resolved | boolean (default false) | Has it been acted on |
| created_at, updated_at | timestamptz | Audit |

Migration: `20250225100008`.

---

### programming_rules

**Purpose:** Deterministic rules the engine loads before generating a program.

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK |
| gym | gym enum (nullable) | NULL = all gyms; non-null = gym-specific override |
| name | text | Human-readable label |
| category | text | volume, progression, exercise_selection, structure, member_specific |
| rule_key | text | Machine key |
| rule_value | jsonb | Flexible payload |
| priority | integer | Higher overrides lower for same rule_key |
| active | boolean | Only load where true |
| source | text (nullable) | Who/what created: 'manual', 'seed', later 'agent:slack_feedback' |
| source_ref | text (nullable) | Link to origin (Slack URL, coach note ID) |
| created_at, updated_at | timestamptz | Audit |

**Load query:**
```sql
SELECT * FROM programming_rules
WHERE (gym = :gym OR gym IS NULL) AND active = true
ORDER BY priority DESC;
```

---

### programming_progression_schemes

**Purpose:** Config for rep-range progression. Engine picks rows by scheme name and cycles through in order.

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK |
| gym | gym enum (nullable) | NULL = all gyms |
| name | text | e.g. "Default Locker Room" |
| goal | text (nullable) | default, strength, hypertrophy |
| from_rep_range | text | e.g. "10-12" |
| to_rep_range | text | e.g. "8-10" |
| exercise_behavior | text or jsonb | "same_exercises" or "allow_exercise_changes" |
| order | int | Cycle order within scheme |
| active | boolean | Include in engine |
| created_at, updated_at | timestamptz | Audit |

Seeded: GPP (order 1–4: 10-12→8-10→6-8→4-6→10-12), Hypertrophy, Strength. See [engine-config.md](engine-config.md).

---

### programming_exercise_exclusions

**Purpose:** Per-member exercises the engine must never assign. Sourced from injuries, contraindications, and coach feedback.

| Column | Type | Use |
|--------|------|-----|
| id | uuid | PK |
| member_id | uuid (FK) | Member |
| exercise_id | uuid (FK) | Exercise to exclude |
| reason | text (nullable) | Optional |
| active | boolean | If false, exclusion ignored |
| created_at, updated_at | timestamptz | Audit |

---

### exercise_library

**Purpose:** Canonical list of available exercises with tags.

| Column | Type |
|--------|------|
| exercise_id | text |
| exercise_name | text |
| tags | text |

Built by trigger from `member_tbhealthmax` + `member_tbresults`. Synced weekly to Google Sheet.

---

### member_programs

**Purpose:** Team-facing display table and batch-generation trigger. The engine reads `due_date`, `programming_stage`, and `scheme_name` to determine which members need a new program.

**Key columns for the engine:**

| Column | Type | Use |
|--------|------|-----|
| member_id | uuid | FK to member_database.id |
| member_name | text | Display |
| due_date | date | Program expiry; batch runner triggers 8 days before |
| programming_stage | text | Enum: awaiting_program, update_stage, complete, uploaded, inactive |
| programming_coach_id | uuid | Coach assignment |
| scheme_name | text (default 'GPP') | Progression scheme: GPP, Strength, Hypertrophy |
| duration_weeks | integer | Program length in weeks |

**Batch cohort query:** Members where `(due_date <= today + 8 AND programming_stage IN (update_stage, complete))` OR `programming_stage = 'awaiting_program'`. Skip if `programming_generated` row exists from last 7 days.

---

## Join Paths

```
member_database.id
  ├── member_tbresults.member_id               (raw TB data)
  ├── programming_normalized_programs.member_id (enriched baseline)
  ├── programming_generated.member_id           (engine output)
  ├── programming_feedback.member_id            (coach feedback)
  ├── programming_exercise_exclusions.member_id (exclusions)
  └── member_programs.member_id                 (display)

programming_rules              (loaded by gym, no member join)
programming_progression_schemes (loaded by scheme name)
exercise_library                (lookup by exercise_name/tags)
```

---

## Engine Read Path (summary)

1. **Cohort:** `member_database` → active, non-test members.
2. **Past program:** `programming_normalized_programs` → most recent payload per member (has order, series, pairings).
3. **Latest performance:** `member_tbresults` → most recent N weeks for weights/reps and drift detection.
4. **Rules:** `programming_rules` → filtered by gym + active.
5. **Progression:** `programming_progression_schemes` → by scheme name + order.
6. **Exclusions:** `programming_exercise_exclusions` → per-member blocked exercises.
7. **Exercise catalog:** `exercise_library` → available exercises + tags.

---

## Phase Detection (`tools/detect_phase.py`)

Determines a member's current progression phase from normalised A-series reps and recommends the next phase.

### Algorithm

1. **Extract A-series reps only.** Only exercises with `series_label` in {A1, A2} are sampled (B/C accessories run at higher reps and would skew detection).
2. **Compute block medians.** Sessions grouped into blocks of 4 (one training week). Median rep count of A-series working sets per block.
3. **Map median to detection band.**

   | Scheme range | Detection band | Centre |
   |-------------|----------------|--------|
   | 10-12 | 9–14 | 11 |
   | 8-10 | 7–11 | 9 |
   | 6-8 | 5–9 | 7 |
   | 4-6 | 3–7 | 5 |
   | 3-5 | 1–6 | 4 |

4. **Direction of travel.** Compare block 0 to block 1: down (>0.5 drop) = progressing, up (>0.5 rise) = reset, flat = stalling.
5. **Resolve overlap.** Direction breaks tie: down → lower range, up → higher range, flat → closest centre.
6. **Look up next phase.** Match detected `from_rep_range` to `programming_progression_schemes` row. `to_rep_range` = recommendation.
7. **Confidence:** high (distance ≤1, clear direction), medium (distance ≤2), low (ambiguous — flag for coach review).

### Output shape

```json
{
  "current_rep_range": "4-6",
  "next_rep_range": "3-5",
  "confidence": "medium",
  "median_reps": 5,
  "direction": "flat"
}
```

### Usage

```bash
python tools/detect_phase.py <member_id> Strength
python tools/normalize_one_member.py <member_id> --scheme Strength
```
