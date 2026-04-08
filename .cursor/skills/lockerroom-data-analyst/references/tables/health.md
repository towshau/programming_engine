# Health & Physicals Domain Tables

## Business Context

Locker Room tracks member health through two main channels:
1. **Physicals (quarterly assessments)** — a structured battery of fitness tests conducted by coaches every quarter
2. **Health Metrics (InBody scans)** — body composition data from the InBody scanner (weight, body fat, muscle mass, etc.)
3. **Biomap** — a comprehensive health mapping service offered to members and external referrals

---

## Key Tables

### `member_physicals_raw`
**Description**: Raw results from quarterly physical assessments for each member.
**Primary Key**: `id` (uuid)
**Update Frequency**: Quarterly (per `physicals_quarterly_cycles`)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Assessment ID | |
| `member_id` | uuid | FK → `member_database` | |
| `coach_id` | uuid | FK → `staff_database` | Coach who conducted |
| `membership_id` | uuid | FK → `member_memberships` | |
| `quarter_cycle_id` | uuid | FK → `physicals_quarterly_cycles` | Which quarter |
| `submission_date` | date | Date of assessment | |
| `age_at_assessment` | integer | Age at time of test | |
| `vo2_value` | numeric | VO₂ max (mL/kg/min) | Cardiorespiratory fitness |
| `vo2_score` | numeric | Scored result (0-100) | |
| `push_ups_value` | numeric | Push-up count | |
| `push_ups_score` | numeric | Scored result | |
| `grip_strength_value` | numeric | Grip strength (kg, average) | Average of left + right |
| `grip_strength_left` / `grip_strength_right` | numeric | Left/right grip | |
| `grip_strength_score` | numeric | Scored result | |
| `vertical_jump_value` | numeric | Vertical jump (cm) | |
| `vertical_jump_score` | numeric | Scored result | |
| `chin_hold_value` | numeric | Chin-up hold (seconds) | |
| `chin_hold_score` | numeric | Scored result | |
| `rsi_value` | numeric | Reactive Strength Index | |
| `rsi_score` / `sl_rsi_value` / `sl_rsi_score` | numeric | RSI variants | `sl_` = single leg |
| `coh_value` / `coh_score` | numeric | Change of hand test | |
| `inbody_value` / `inbody_score` | numeric | InBody composite score | |
| `concept2_value` / `concept2_score` | numeric | Concept2 rowing test | |
| `picked_cardio` | text | Which cardio test was selected | |
| `bike_test_avg_watt` | numeric | Bike test average watts | |
| `run_test_meters` | numeric | Run test distance (meters) | |
| `goals` / `injuries` / `focus_program` | text | Coach notes | |
| `hinge` / `shoulder_flexion` / `toe_touch` / `squat` | text | Movement quality ratings | |
| `source` | text | Data entry source | `'form'` = coach submitted |

**Relationships**:
- Joins to `physicals_quarterly_cycles` for quarter context
- Joins to `physicals_scoring_lookup` for score benchmarks

**Sample Queries**:

Latest physicals per member:
```sql
SELECT DISTINCT ON (member_id)
    member_id,
    member_name,
    submission_date,
    vo2_value,
    vo2_score,
    push_ups_value,
    grip_strength_value
FROM member_physicals_raw
WHERE source = 'form'
ORDER BY member_id, submission_date DESC;
```

VO₂ improvement over time for a member:
```sql
SELECT
    submission_date,
    vo2_value,
    vo2_score
FROM member_physicals_raw
WHERE member_id = '<member_uuid>'
ORDER BY submission_date;
```

Average scores by gym:
```sql
SELECT
    md.gym_string,
    AVG(mpr.vo2_value) AS avg_vo2,
    AVG(mpr.push_ups_value) AS avg_pushups,
    AVG(mpr.grip_strength_value) AS avg_grip,
    COUNT(*) AS assessments
FROM member_physicals_raw mpr
JOIN member_database md ON mpr.member_id = md.id
WHERE mpr.submission_date >= CURRENT_DATE - INTERVAL '90 days'
  AND md.test_account = FALSE
GROUP BY md.gym_string;
```

---

### `member_health_metrics`
**Description**: InBody body composition scan results for members.
**Primary Key**: `id` (uuid)
**Update Frequency**: On scan (ad-hoc)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Scan ID | |
| `member_id` | uuid | FK → `member_database` | |
| `date_created` | timestamptz | Scan date | |
| `weight` | numeric | Total body weight (kg) | |
| `bf` | numeric | Body fat % | |
| `bfm` | numeric | Body fat mass (kg) | |
| `ffm` | numeric | Fat-free mass (kg) | |
| `smm` | numeric | Skeletal muscle mass (kg) | |
| `tbw` | numeric | Total body water (litres) | |
| `bone_mineral_content` | numeric | Bone mineral content (kg) | |
| `visceral_fat_level` | numeric | Visceral fat score | |
| `inbody_score` | integer | Composite InBody score | |
| `bmr` | numeric | Basal metabolic rate (kcal) | |
| `age` | integer | Age at scan | |
| `gender` | enum | Gender | |
| `height` | numeric | Height (cm) | |
| `raw_payload` | jsonb | Full InBody scan data | Complete scan payload |

**Sample Query** — Body composition progress:
```sql
SELECT
    mhm.date_created::date AS scan_date,
    mhm.weight,
    mhm.bf AS body_fat_pct,
    mhm.smm AS skeletal_muscle_kg,
    mhm.inbody_score
FROM member_health_metrics mhm
WHERE mhm.member_id = '<member_uuid>'
ORDER BY mhm.date_created;
```

---

### `member_memberhealth`
**Description**: RAG health status tracking for each member (Red/Amber/Green).
**Primary Key**: `id`

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `member_id` | uuid | FK → `member_database` | |
| Health rating fields | enum `member_health_enum` | `green`, `yellow`, `red` | |

**Pre-built view**: `v_clients_at_risk` — members with yellow or red health status.

---

### `member_cardio_workout_log`
**Description**: Cardio workout entries for members.
**Primary Key**: `id`

| Column | Type | Description |
|--------|------|-------------|
| `member_id` | uuid | FK → `member_database` |
| `workout_id` | uuid | FK → `cardio_workouts` |

---

### `member_cardio_time_trials`
**Description**: Time trial results for cardio assessments.
**Primary Key**: `id`

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `member_id` | uuid | FK → `member_database` | |
| `test_type` | enum `cardio_timetrial_tests` | Type of test | e.g. `5 Minute Bike Erg Test`, `12 Minute Run Test` |

---

### Biomap Tables

The Biomap system is a health mapping service. Key tables:

| Table | Description |
|-------|-------------|
| `member_biomap` | Biomap engagement records per member (stage tracking) |
| `member_biomap_results` | Individual measurement results |
| `biomap_measurement_types` | Catalogue of measurement types |
| `biomap_measurement_dimensions` | Measurement categories (e.g. body composition, blood markers) |
| `biomap_units` | Units of measurement |
| `biomap_unit_aliases` | Alternative unit names |
| `biomap_measurement_unit_conversions` | Conversion factors between units |
| `biomap_reference_ranges` | Normal/healthy reference ranges per measurement type |
| `biomap_supplements` | Supplement recommendations |

`member_biomap.stage` uses the `biomap_stage2` enum: stages from `0_pre_contact` through `9_DNC`.

---

### `physicals_quarterly_cycles`
**Description**: Defines the quarterly assessment periods.

| Column | Description |
|--------|-------------|
| `id` | Cycle ID |
| `cycle_name` / `cycle_label` | Human-readable cycle name |
| `start_date` / `end_date` | Dates of the quarter |

---

### `physicals_scoring_lookup`
**Description**: Score lookup table — converts raw test values to normalised scores by age/gender cohort.

---

## Common Gotchas

1. **Multiple scans per member**: Both `member_physicals_raw` and `member_health_metrics` have multiple rows per member over time. Always use `DISTINCT ON (member_id) ORDER BY member_id, date DESC` for latest-only queries.

2. **Grip strength is the average**: `grip_strength_value` is the average of left and right. Raw left/right values are in `grip_strength_left` / `grip_strength_right`.

3. **VO₂ test type varies**: Members choose their cardio test (`picked_cardio`). Some do bike, some do run. Compare VO₂ values only when the test type is consistent.

4. **InBody scores in two tables**: `member_health_metrics.inbody_score` (from scanner) vs `member_physicals_raw.inbody_score` (scored in physicals battery) are different — the physicals score is normalised to 0-100.

---

## Related Views

| View | Description |
|------|-------------|
| `view_members_due_for_assessment` | Members who haven't had physicals recently |
| `view_physicals_quarterly_summary` | Summary of physicals completion by quarter |
| `view_cardio_vo2_scores` | VO₂ scores with member details |
| `view_renewals_with_vo2_summary` | Renewals with VO₂ performance context |
| `member_vo2_milestones` | VO₂ milestone achievements |
| `v_clients_at_risk` | Members with red/yellow health status |
| `stg_member_health_metrics` | Staging table for health metrics processing |
