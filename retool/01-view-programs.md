# Retool: Generated Programs Viewer

## Status: Working

Dashboard is live in Retool. Filters (coach, member, scheme) working. Programs display with exercise detail table. Coach filter uses membership handoff logic.

---

## AI Builder Prompt

Build a Retool app page called **"Generated Programs"** that connects to Supabase and lets coaches view, filter, and edit generated training programs.

### Data source

Supabase (PostgreSQL). All queries below run against the Supabase resource.

---

### Queries

#### 1. `getCoaches` — Coach filter dropdown

```sql
SELECT id AS coach_id, coach_name
FROM staff_database
WHERE staff_status = 'active'
  AND coach_name IS NOT NULL
ORDER BY coach_name;
```

#### 2. `getMembers` — Member filter dropdown (filtered by selected coach)

Uses `member_memberships` for handoff logic. A member belongs to a coach when:
- `coach_id = X AND handoff_coach_id IS NULL` (original coach, not handed off), OR
- `handoff_coach_id = X` (member was handed off to this coach)

```sql
SELECT DISTINCT md.id AS member_id, md.member_name
FROM member_database md
  JOIN member_memberships mm ON mm.member_id = md.id
WHERE md.current_status = 'active'
  AND md.test_account = false
  AND CASE
    WHEN {{ coachFilter.value }} IS NOT NULL AND {{ coachFilter.value }} != '' THEN
      (mm.coach_id = {{ coachFilter.value }}::uuid AND mm.handoff_coach_id IS NULL)
      OR mm.handoff_coach_id = {{ coachFilter.value }}::uuid
    ELSE true
  END
ORDER BY md.member_name;
```

#### 3. `getPrograms` — Program list table (working query)

Joins `member_memberships` (most recent per member via lateral join) and `staff_database` x3 to resolve coach names. Coach filter uses handoff logic on the membership, not `g.assigned_to`.

```sql
SELECT
  g.id,
  g.run_id,
  g.member_id,
  mp.member_name,
  g.scheme_name,
  g.rep_range,
  g.sessions_per_week,
  g.duration_weeks,
  g.changes_summary,
  g.created_at::date AS generated_date,
  g.created_at,
  sc.coach_name  AS coach_name,
  sh.coach_name  AS handoff_coach_name,
  sp.coach_name  AS programming_coach_name
FROM programming_generated g
  JOIN member_programs mp ON mp.member_id = g.member_id
  LEFT JOIN LATERAL (
    SELECT coach_id, handoff_coach_id, programming_coach_id
    FROM member_memberships
    WHERE member_id = g.member_id
    ORDER BY start_date DESC
    LIMIT 1
  ) mm ON true
  LEFT JOIN staff_database sc ON sc.id = mm.coach_id
  LEFT JOIN staff_database sh ON sh.id = mm.handoff_coach_id
  LEFT JOIN staff_database sp ON sp.id = mm.programming_coach_id
WHERE
  ({{ !memberFilter.value }} OR g.member_id = {{ memberFilter.value }}::uuid)
  AND ({{ !schemeFilter.value }} OR {{ schemeFilter.value }} = 'All' OR g.scheme_name = {{ schemeFilter.value }})
  AND ({{ !coachFilter.value }}
       OR (mm.coach_id = {{ coachFilter.value }}::uuid AND mm.handoff_coach_id IS NULL)
       OR mm.handoff_coach_id = {{ coachFilter.value }}::uuid)
ORDER BY g.created_at DESC
LIMIT 400;
```

#### 4. `getExercises` — Unnest payload into one row per exercise

```sql
SELECT
  g.id                                    AS program_id,
  g.member_id,
  g.scheme_name,
  g.rep_range                             AS program_rep_range,
  g.sessions_per_week,
  g.duration_weeks,
  g.changes_summary,
  g.created_at,
  (s.val->>'day')::int                    AS day,
  ex.ord::int                             AS exercise_order,
  ex.val->>'series_label'                 AS series_label,
  ex.val->>'exercise_name'                AS exercise_name,
  ex.val->>'exercise_id'                  AS exercise_id,
  ex.val->>'tags'                         AS tags,
  jsonb_array_length(ex.val->'sets')      AS num_sets,
  ex.val->'sets'->0->>'reps'              AS reps
FROM programming_generated g,
  jsonb_array_elements(g.payload->'sessions')    WITH ORDINALITY AS s(val, ord),
  jsonb_array_elements(s.val->'exercises')       WITH ORDINALITY AS ex(val, ord)
WHERE g.id = {{ programTable.selectedRow.id }}::uuid
ORDER BY day, exercise_order;
```

#### 5. `updateSeriesLabel` — inline edit save handler (NOT YET WIRED)

```sql
UPDATE programming_generated
SET payload = jsonb_set(
  payload,
  ARRAY[
    'sessions',
    ({{ exerciseTable.selectedRow.day }} - 1)::text,
    'exercises',
    ({{ exerciseTable.selectedRow.exercise_order }} - 1)::text,
    'series_label'
  ],
  to_jsonb({{ exerciseTable.changesetObject.series_label }}::text)
),
updated_at = now()
WHERE id = {{ exerciseTable.selectedRow.program_id }}::uuid;
```

#### 6. `updateExerciseName` — inline edit save handler (NOT YET WIRED)

```sql
UPDATE programming_generated
SET payload = jsonb_set(
  payload,
  ARRAY[
    'sessions',
    ({{ exerciseTable.selectedRow.day }} - 1)::text,
    'exercises',
    ({{ exerciseTable.selectedRow.exercise_order }} - 1)::text,
    'exercise_name'
  ],
  to_jsonb({{ exerciseTable.changesetObject.exercise_name }}::text)
),
updated_at = now()
WHERE id = {{ exerciseTable.selectedRow.program_id }}::uuid;
```

---

### Layout

#### Top filter bar

| Control | Name | Type | Source | Behaviour |
|---------|------|------|--------|-----------|
| Coach | `coachFilter` | Select dropdown | `getCoaches`. Display: `coach_name`. Value: `coach_id`. "All Coaches" = empty. | Re-run `getMembers` and `getPrograms`. |
| Member | `memberFilter` | Select dropdown | `getMembers`. Display: `member_name`. Value: `member_id`. "All Members" = empty. | Re-run `getPrograms`. |
| Scheme | `schemeFilter` | Select dropdown | Static: All, GPP, Strength, Hypertrophy. | Re-run `getPrograms`. |

#### Program list (`programTable`, top section)

Columns: `member_name`, `coach_name`, `handoff_coach_name`, `programming_coach_name`, `scheme_name`, `rep_range`, `sessions_per_week`, `duration_weeks`, `generated_date`, `changes_summary`. Row click loads `getExercises`.

#### Exercise detail (`exerciseTable`, main section)

| Column | Header | Editable | Notes |
|--------|--------|----------|-------|
| `day` | Day | No | Group by day |
| `exercise_order` | # | No | |
| `series_label` | Series | **Yes** (TODO) | On save: `updateSeriesLabel` then refresh |
| `exercise_name` | Exercise | **Yes** (TODO) | On save: `updateExerciseName` then refresh |
| `tags` | Tags | No | |
| `num_sets` | Sets | No | |
| `reps` | Reps | No | |

---

### Coach filter logic

Source: `member_memberships` (most recent by `start_date DESC`), resolved via `staff_database`.

- `member_memberships.coach_id` — original assigned coach
- `member_memberships.handoff_coach_id` — if not null, member handed off to this coach

**Rule:** Member belongs to Coach X if `(coach_id = X AND handoff_coach_id IS NULL) OR handoff_coach_id = X`.

---

### Payload structure

`programming_generated.payload` is JSONB:

```json
{
  "metadata": {
    "run_id": "uuid",
    "member_id": "uuid",
    "scheme": "GPP",
    "confidence": "high",
    "current_rep_range": "6-8",
    "next_rep_range": "4-6",
    "sessions_per_week": 3,
    "duration_weeks": 6,
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
            { "set_number": 1, "reps": "4-6" },
            { "set_number": 2, "reps": "4-6" },
            { "set_number": 3, "reps": "4-6" }
          ]
        }
      ]
    }
  ]
}
```

`getExercises` uses `jsonb_array_elements ... WITH ORDINALITY` to unnest. `exercise_order` and `day` (1-based) convert to 0-based for `jsonb_set` paths.

---

## Next steps (pick up here)

### 1. Make exercise table editable

- [ ] Wire `updateSeriesLabel` to the `series_label` column save event in `exerciseTable`
- [ ] Wire `updateExerciseName` to the `exercise_name` column save event
- [ ] Add `updateReps` query (same `jsonb_set` pattern targeting `sets->N->reps`) and make `reps` column editable
- [ ] Add `updateNumSets` — needs to add/remove set objects from the array, not just edit a value
- [ ] Add `updateTags` query for editing tags inline
- [ ] After any save, re-run `getExercises` to refresh the table

### 2. Scheme / goal editing

- [ ] Add ability to change `scheme_name` on `programming_generated` (top-level column, not inside payload)
- [ ] Consider a dropdown for scheme (GPP / Strength / Hypertrophy) rather than free text
- [ ] Changing scheme should also update `member_programs.scheme_name` so the batch runner uses it next time

### 3. Coach feedback integration

- [ ] Add a feedback button/slide-out on the exercise table (per-exercise or per-program)
- [ ] Insert into `programming_feedback` table (run_id, member_id, coach_id, feedback_type, details, exercise_id)
- [ ] feedback_type values: exercise_swap, pairing_issue, too_hard, too_easy, positive, other
- [ ] See `retool/02-feedback-form.md` for the original spec
- [ ] Show unresolved feedback count badge (see `retool/03-flagged-counter.md`)

### 4. Other items not yet addressed

- [ ] PDF export of programs (`retool/05-pdf-export.md`)
- [ ] Exercise removal request form (`retool/04-deleted-exercise-form.md`)
- [ ] Batch runner: add `SUPABASE_SERVICE_ROLE_KEY` to local `.env` for full `member_database` filtering (active/test). GitHub Actions already has it.
- [ ] Data freshness: `member_tbresults` sync needs to be current for accurate program generation (was ~10 days stale during testing)
- [ ] Normalizer currently runs for all members — may want `--member-id` filtering for the weekly workflow
