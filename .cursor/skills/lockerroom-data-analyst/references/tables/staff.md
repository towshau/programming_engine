# Staff & Coaches Domain Tables

## Business Context

Locker Room has a coaching team spanning three gyms (BLIGH, BRIDGE, COLLINS). Coaches are assigned members, write programming, and are tracked on renewals and session delivery. The scheduling system determines which coach covers which session in which time block each week.

---

## Key Tables

### `staff_database`
**Description**: Master record for all Locker Room staff (coaches, managers, admin).
**Primary Key**: `id` (uuid)
**Standard Filter**: `WHERE staff_status = 'active'`

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Staff ID | PK — use for all joins |
| `coach_name` | text | Full display name | Use this for display purposes |
| `first_name` / `last_name` | text | Name components | |
| `role` | text | Primary role (free text) | |
| `supplementary_roles` | text[] | Array of additional roles | e.g. `{results_manager, programming_coach}`. Unnest to filter |
| `staff_status` | enum `active_inactive` | `active` or `inactive` | Filter `= 'active'` for current staff |
| `home_gym` | text | Primary gym assignment | `BLIGH`, `BRIDGE`, `COLLINS` |
| `rm_ceiling` | numeric | Max clients as Results Manager | Capacity cap |
| `employment_type` | text | `FTE`, `casual`, etc. | |
| `direct_report` | uuid → self | Manager/supervisor | |
| `buddy_coach` | uuid → self | Buddy coach relationship | |
| `executive` | boolean | Leadership team member | |
| `tod_coaching` | text | Time-of-day coaching preference | |
| `session_bracket_fk` | uuid → `system_bracket_policy_rules` | Session bracket assignment | |
| `lockeroom_email` | text | Work email | `@lockeroomgym.com` |
| `slack_member_id` | text | Slack user ID | For Slack integrations |
| `auth_id` | uuid | Supabase auth user ID | |
| `cpr_perform` / `cpr_box` | numeric | CPR certification dates | |
| `kpi` | text | KPI descriptor | |
| `rgb_colour` | text | Coach colour for UI | |

**Filtering by role**:
```sql
-- Coaches who are Results Managers
WHERE 'results_manager' = ANY(supplementary_roles)

-- Active coaches only
WHERE staff_status = 'active'

-- Coaches at a specific gym
WHERE home_gym = 'BLIGH'
```

---

### `schedule_sessions`
**Description**: Every scheduled gym session across all locations.
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Session ID | |
| `session_date` | date | Date of session | |
| `session_time` | time | Start time | |
| `week_start` | date | Week this session belongs to | Monday of the week |
| `day_name` | text | Day name (e.g. `Monday`) | |
| `gym` | text | Gym location | `BLIGH`, `BRIDGE`, `COLLINS` |
| `session_type_id` | uuid | FK → `system_session_types` | Type of session |
| `is_peak` | boolean | Peak time session | |
| `status` | text | `proposed`, `confirmed`, `cancelled` | |
| `period_id` | uuid | FK → `schedule_periods` | Planning period |

**Relationships**:
- Parent of `schedule_session_coaches` (which coaches cover this session)

---

### `schedule_session_coaches`
**Description**: Junction table — which coach is assigned to which session.
**Primary Key**: composite (`session_id`, `coach_id`)

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | uuid | FK → `schedule_sessions` |
| `coach_id` | uuid | FK → `staff_database` |

---

### `schedule_final`
**Description**: Confirmed/locked schedule for a coach for a given week.
**Primary Key**: `id` (uuid)

| Column | Type | Description |
|--------|------|-------------|
| `coach_id` | uuid | FK → `staff_database` |
| `week_start` | date | Week start date |
| `block` | text | Schedule block (e.g. `MON_EARLY`) |
| `locked_at` | timestamptz | When schedule was locked |
| `locked_by` | text | Who locked it |

---

### `schedule_preferences`
**Description**: A coach's preferences for schedule blocks (HARD/SOFT/PREFERRED).
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `staff_id` | uuid | FK → `staff_database` | |
| `period_id` | uuid | FK → `schedule_periods` | |
| `block` | enum | Schedule block (e.g. `MON_EARLY`) | Day + time combo |
| `preference_type` | enum | `HARD`, `SOFT`, `PREFERRED` | HARD = unavailable |

---

### `coach_wcr_logging`
**Description**: Weekly Coach Report entries — coaches log interactions and notes for members.
**Primary Key**: `id`

| Column | Type | Description |
|--------|------|-------------|
| `coach_id` | uuid | FK → `staff_database` |
| `member_id` | uuid | FK → `member_database` |
| `created_at` | timestamptz | When logged |

---

### `coach_monthly_report`
**Description**: Monthly coach performance reports.

| Column | Type | Description |
|--------|------|-------------|
| `coach_id` | uuid | FK → `staff_database` |

---

### `staff_leave_requests` / `staff_leave_confirmed`
**Description**: Staff leave management.

| Column | Type | Description |
|--------|------|-------------|
| `staff_id` | uuid | FK → `staff_database` |
| `leave_type` | enum | `sick_leave`, `annual_leave`, `parental_leave`, `birthday_leave`, etc. |
| `start_date` / `end_date` | date | Leave period |

---

## Sample Queries

### All Active Coaches with Member Counts
```sql
SELECT
    sd.coach_name,
    sd.home_gym,
    COUNT(md.id) AS active_members,
    sd.rm_ceiling
FROM staff_database sd
LEFT JOIN member_database md ON md.coach_id = sd.id
    AND md.current_status = 'active'
    AND md.test_account = FALSE
WHERE sd.staff_status = 'active'
GROUP BY sd.id, sd.coach_name, sd.home_gym, sd.rm_ceiling
ORDER BY active_members DESC;
```

### Coach Sessions This Week
```sql
SELECT
    sd.coach_name,
    ss.session_date,
    ss.session_time,
    ss.gym,
    st.name AS session_type
FROM schedule_session_coaches ssc
JOIN staff_database sd ON ssc.coach_id = sd.id
JOIN schedule_sessions ss ON ssc.session_id = ss.id
JOIN system_session_types st ON ss.session_type_id = st.id
WHERE ss.week_start = DATE_TRUNC('week', CURRENT_DATE)
  AND sd.staff_status = 'active'
ORDER BY sd.coach_name, ss.session_date, ss.session_time;
```

### Results Managers and Their Clients
```sql
SELECT
    sd.coach_name AS results_manager,
    COUNT(md.id) AS client_count,
    sd.rm_ceiling AS capacity
FROM staff_database sd
JOIN member_database md ON md.coach_id = sd.id
    AND md.current_status = 'active'
    AND md.test_account = FALSE
WHERE 'results_manager' = ANY(sd.supplementary_roles)
  AND sd.staff_status = 'active'
GROUP BY sd.coach_name, sd.rm_ceiling
ORDER BY client_count DESC;
```

---

## Common Gotchas

1. **Supplementary roles are an array**: Use `= ANY(supplementary_roles)` not `= supplementary_roles`
   - Wrong: `WHERE supplementary_roles = 'results_manager'`
   - Right: `WHERE 'results_manager' = ANY(supplementary_roles)`

2. **`schedule_block_enum` is day+time combo**: Blocks follow the pattern `DAY_TIMEOFDAY` (e.g. `MON_EARLY`, `TUE_ARVO`). There are 7 half-day slots per day.

3. **Staff hierarchy is self-referential**: `direct_report` points to the manager's `id` in the same table.

---

## Related Views

| View | Description |
|------|-------------|
| `view_active_coaches` | Currently active coaches |
| `view_active_coaches_with_managers` | Active coaches + their managers |
| `view_active_coaches_with_managers_and_leadership_team` | Full leadership hierarchy |
| `view_staff_hours_weekly` | Weekly hours per staff |
| `view_staff_sup_hours_weekly` | Weekly supplementary hours |
| `view_staff_bracket_effective` | Effective session bracket per staff |
| `view_coach_total_workload_weekly` | Total weekly workload per coach |
| `view_coach_session_expectations` | Expected session delivery per coach |
| `view_preference_points_by_staff_period` | Schedule preference scoring |
| `active_members_by_coach` | Active member count by coach |
