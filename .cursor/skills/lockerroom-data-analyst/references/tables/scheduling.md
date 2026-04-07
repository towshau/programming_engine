# Scheduling Domain Tables

## Business Context

Locker Room operates on a structured scheduling system where coaches are assigned to time blocks across three gyms. The schedule is planned in advance by periods (multi-week blocks). Coaches submit preferences (HARD/SOFT/PREFERRED), and the final schedule is locked in `schedule_final`. Sessions are tracked in `schedule_sessions` with coaches assigned via `schedule_session_coaches`.

**Schedule Block Format**: `DAY_TIMEOFDAY` (e.g. `MON_EARLY`, `TUE_ARVO`, `FRI_LATE`)
**Days**: MON, TUE, WED, THU, FRI, SAT, SUN
**Times**: EARLY, MID, LUNCH, ARVO, LATE, AM_HALF, PM_HALF

---

## Key Tables

### `schedule_periods`
**Description**: Defines multi-week planning periods for the schedule.
**Primary Key**: `id` (uuid)

| Column | Description |
|--------|-------------|
| `id` | Period ID |
| `start_date` / `end_date` | Period dates |
| `name` | Period name |

---

### `schedule_sessions`
**Description**: All scheduled gym sessions (past and future).
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Session ID | |
| `session_date` | date | Date of session | |
| `session_time` | time | Start time | |
| `week_start` | date | Monday of the session week | Useful for weekly aggregations |
| `day_name` | text | Day name | |
| `gym` | text | Gym | `BLIGH`, `BRIDGE`, `COLLINS` |
| `session_type_id` | uuid | FK → `system_session_types` | |
| `period_id` | uuid | FK → `schedule_periods` | |
| `is_peak` | boolean | Peak-hour session | |
| `status` | text | `proposed`, `confirmed`, `cancelled` | |

---

### `schedule_session_coaches`
**Description**: Junction table mapping coaches to sessions.

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | uuid | FK → `schedule_sessions` |
| `coach_id` | uuid | FK → `staff_database` |

---

### `schedule_final`
**Description**: Locked/confirmed schedule assignments per coach per week.

| Column | Type | Description |
|--------|------|-------------|
| `coach_id` | uuid | FK → `staff_database` |
| `week_start` | date | Week start (Monday) |
| `block` | text | Schedule block (e.g. `MON_EARLY`) |
| `locked_at` | timestamptz | When locked |
| `locked_by` | text | Who locked |

---

### `schedule_preferences`
**Description**: Coach preferences for specific schedule blocks.

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `staff_id` | uuid | FK → `staff_database` | |
| `period_id` | uuid | FK → `schedule_periods` | |
| `block` | enum | `DAY_TIMEOFDAY` block | |
| `preference_type` | enum | `HARD` / `SOFT` / `PREFERRED` | HARD = unavailable; SOFT = prefer not; PREFERRED = want this |

---

### `schedule_block_config`
**Description**: Configuration for each schedule block (times, days).

---

### `system_session_types`
**Description**: Types of sessions offered (e.g. performance training, boxing, online).
**Primary Key**: `id` (uuid)

---

### `system_session_gym_capacity`
**Description**: Maximum capacity per session type per gym.

| Column | Description |
|--------|-------------|
| `session_type_id` | FK → `system_session_types` |
| `max_capacity` | Max members per session |

---

## Sample Queries

### This Week's Schedule by Gym
```sql
SELECT
    ss.session_date,
    ss.session_time,
    ss.gym,
    ss.is_peak,
    STRING_AGG(sd.coach_name, ', ') AS coaches
FROM schedule_sessions ss
LEFT JOIN schedule_session_coaches ssc ON ss.id = ssc.session_id
LEFT JOIN staff_database sd ON ssc.coach_id = sd.id
WHERE ss.week_start = DATE_TRUNC('week', CURRENT_DATE)
  AND ss.status != 'cancelled'
GROUP BY ss.session_date, ss.session_time, ss.gym, ss.is_peak
ORDER BY ss.session_date, ss.session_time, ss.gym;
```

### Coach Hours per Week (Next 4 Weeks)
```sql
SELECT
    sd.coach_name,
    ss.week_start,
    COUNT(ssc.session_id) AS sessions_assigned
FROM schedule_session_coaches ssc
JOIN staff_database sd ON ssc.coach_id = sd.id
JOIN schedule_sessions ss ON ssc.session_id = ss.id
WHERE ss.week_start BETWEEN DATE_TRUNC('week', CURRENT_DATE)
                        AND DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '4 weeks'
  AND sd.staff_status = 'active'
GROUP BY sd.coach_name, ss.week_start
ORDER BY ss.week_start, sessions_assigned DESC;
```

### Coach Preferences for Current Period
```sql
SELECT
    sd.coach_name,
    sp.block,
    sp.preference_type
FROM schedule_preferences sp
JOIN staff_database sd ON sp.staff_id = sd.id
JOIN schedule_periods per ON sp.period_id = per.id
WHERE per.start_date <= CURRENT_DATE AND per.end_date >= CURRENT_DATE
ORDER BY sd.coach_name, sp.block;
```

### Upcoming 14-Day Session Forecast
```sql
-- Pre-built: session_forecast_next_14_days
SELECT * FROM session_forecast_next_14_days;
```

---

## Common Gotchas

1. **`week_start` is always a Monday**: When filtering by week, use `DATE_TRUNC('week', some_date)` to get the Monday.

2. **Block enum has AM_HALF and PM_HALF**: These are half-day variations for coaches who work partial days. Don't assume all blocks are full days.

3. **`status = 'cancelled'`**: Always filter out cancelled sessions: `WHERE status != 'cancelled'`

4. **`schedule_final` vs `schedule_sessions`**: `schedule_final` records which blocks a coach is locked into for the week; `schedule_sessions` has the actual session details with times. They're related but different granularities.

---

## Related Views

| View | Description |
|------|-------------|
| `view_schedule_availability_summary` | Coach availability summary |
| `view_schedule_block_supply_totals` | Total block supply by period |
| `view_schedule_preference_supply` | Preference-weighted supply |
| `view_schedule_period_weeks` | Weeks within each schedule period |
| `view_staff_session_bracket` | Session bracket assignments |
| `view_coach_session_balance_sep25` | Session balance for Sep 2025 |
| `session_forecast_next_14_days` | 14-day session forecast |
| `view_sb_recommended_preview` | Recommended session brackets |
