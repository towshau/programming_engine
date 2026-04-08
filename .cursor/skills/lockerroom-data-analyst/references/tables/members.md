# Members Domain Tables

## Business Context

The members domain covers gym clients from signup through their entire lifecycle: trial → new member → renewal → potential churn. The central table is `member_database`. Memberships are tracked in `member_memberships` (one row per contract period). Holds, programs, and health data all hang off the member record.

---

## Key Tables

### `member_database`
**Description**: Master record for every gym member (current and past).
**Primary Key**: `id` (uuid)
**Standard Filter**: Always add `WHERE test_account = FALSE`

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Member ID | PK — use for all joins |
| `first_name` / `last_name` | text | Name | |
| `member_name` | text | Denormalized full name | Convenience field, may lag |
| `email` | text | Email | Empty string `''` used instead of NULL for missing |
| `current_status` | enum | Membership status | `active`, `expired`, `on_hold`, `trial`, `F&F`, etc. |
| `coach_id` | uuid | FK → `staff_database` | Use this for coach joins |
| `coach_name` | text | Denormalized coach name | **May be stale** — join via `coach_id` |
| `gym_string` | text | Home gym | `BLIGH`, `BRIDGE`, `COLLINS` |
| `test_account` | boolean | Test/fake member | **Filter = FALSE always** |
| `dob` | date | Date of birth | Used for age calculations |
| `gender` | enum | `Male` / `Female` | |
| `referrer_id` | uuid | FK → self | Who referred this member |
| `salesperson` | uuid | FK → `staff_database` | Staff who closed the sale |
| `stripe_primary_fk` | uuid | FK → `stripe_customers` | Billing link |
| `gr_bligh` / `gr_bridge` / `gr_collin` | boolean | Gym flags | True if member uses that gym |
| `initial_weight` | numeric | Weight at signup (kg) | |
| `initial_bf_percentage` | numeric | Body fat % at signup | |
| `injuries` / `goals` / `contraindications` | text | Health notes | |
| `last_physicals_date` | date | Most recent assessment | |

**Relationships**:
- Parent of `member_memberships` via `member_id`
- Parent of `member_holds` via `member_id`
- Parent of `member_health_metrics` via `member_id`
- Parent of `member_physicals_raw` via `member_id`
- Parent of `member_programs` via `member_id`
- Links to `stripe_customers` via `stripe_primary_fk`

---

### `member_memberships`
**Description**: Each membership contract (new sale or renewal). A member has ONE active row and potentially many historical rows.
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Membership ID | PK |
| `member_id` | uuid | FK → `member_database` | |
| `membership_type_id` | uuid | FK → `membership_types` | Frequency, sessions, category |
| `start_date` | date | Contract start | |
| `end_date` | date | Contract end | |
| `status` | text | `active`, `expired`, `pending` | |
| `journey_stage` | enum | Renewal pipeline stage | See entities.md for all values |
| `coach_id` | uuid | Assigned coach | |
| `gym` | text | Gym for this membership | `BLIGH`, `BRIDGE`, `COLLINS` |
| `membership_stage` | text | Onboarding stage | |
| `pipeline_lost` | enum | Churn marker | `good_churn` or `bad_churn` |
| `rm` | boolean | RM responsible | Default `true` |
| `primary_membership_id` | uuid | FK → self | For renewals: points to original membership |
| `renewal_date` | date | When renewal was processed | |
| `newsale_metadata` | uuid | FK → `member_newsale_metadata` | New sale details |
| `renewal_metadata` | uuid | FK → `member_renewal_meta` | Renewal details |

**Relationships**:
- `member_id` → `member_database`
- `membership_type_id` → `membership_types`
- `coach_id` → `staff_database`
- Parent of `stripe_invoices` via `membership_id`
- Parent of `member_holds` via `membership_id`

**Sample Queries**:

Current active memberships:
```sql
SELECT mm.*, mt.name AS membership_type_name, mt.session_frequency_per_week
FROM member_memberships mm
JOIN membership_types mt ON mm.membership_type_id = mt.id
JOIN member_database md ON mm.member_id = md.id
WHERE mm.status = 'active'
  AND md.test_account = FALSE;
```

Memberships expiring in next 30 days:
```sql
SELECT
    md.member_name,
    mm.end_date,
    mm.journey_stage,
    sd.coach_name
FROM member_memberships mm
JOIN member_database md ON mm.member_id = md.id
JOIN staff_database sd ON mm.coach_id = sd.id
WHERE mm.status = 'active'
  AND mm.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND md.test_account = FALSE
ORDER BY mm.end_date;
```

---

### `member_holds`
**Description**: Periods where a member's membership is paused.
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Hold ID | |
| `member_id` | uuid | FK → `member_database` | |
| `membership_id` | uuid | FK → `member_memberships` | |
| `hold_start` | date | Start of hold | |
| `hold_end` | date | End of hold | NULL = indefinite hold |
| `policy_applied` | text | Hold policy name | |
| `hold_notes` | text | Reason/notes | |
| `financial_hold_credit` | numeric | Financial credit amount | |
| `session_account_credit` | numeric | Session credit applied | |
| `RM` | text | Results Manager name | Denormalized |
| `travel_programming_notes` | text | Notes for travel programming | |

**Gotchas**:
- `hold_end = NULL` means an **indefinite/ongoing hold** — use `COALESCE(hold_end, '9999-12-31')` in date range checks
- A member with an active hold still shows `current_status = 'active'` in `member_database`

Current holds:
```sql
SELECT mh.member_name, mh.hold_start, mh.hold_end, mh.policy_applied
FROM member_holds mh
WHERE CURRENT_DATE BETWEEN mh.hold_start AND COALESCE(mh.hold_end, '9999-12-31');
-- Pre-built view: membership_holds_tracker, v_member_holds_with_agreement
```

---

### `member_programs`
**Description**: Programming assignments — which coach writes programming for which member.
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Program ID | |
| `member_id` | uuid | FK → `member_database` | |
| `membership_id` | uuid | FK → `member_memberships` | |
| `programming_coach_id` | uuid | FK → `staff_database` | Coach writing the program |
| `programming_stage` | enum | `new_member`, `awaiting_program`, `upload_required`, `complete`, `inactive` | |
| `scheme_name` | text | Programming scheme | Default `'GPP'` |
| `due_date` | date | Program due date | |
| `weeks_completed` | text | Weeks completed (text field) | |
| `completion_bucket` | text | Completion categorization | |

---

### `membership_types`
**Description**: Product catalogue — the different membership packages available.
**Primary Key**: `id` (uuid)

| Column | Type | Description |
|--------|------|-------------|
| `name` | text | Product name |
| `session_frequency_per_week` | integer | Sessions per week (e.g. 3, 4, 5) |
| `session_total` | integer | Total sessions over contract |
| `category` | enum | `all_inclusive`, `boxing_only`, `online_coaching`, `na` |
| `tod_category` | enum | `on_peak`, `off_peak`, `online` |

---

## Common Gotchas

1. **Multiple memberships per member**: Don't join directly without filtering status. Use `WHERE mm.status = 'active'` for current memberships.
   - Wrong: `JOIN member_memberships mm ON mm.member_id = md.id`
   - Right: `JOIN member_memberships mm ON mm.member_id = md.id AND mm.status = 'active'`

2. **Holds don't change `current_status`**: A member on hold still appears as `active`. To find truly training members, cross-reference with `member_holds`.

3. **Empty email vs NULL**: `member_database.email` defaults to `''` (empty string) not NULL. Use `email != ''` not `email IS NOT NULL`.

4. **Denormalized name fields**: `coach_name` and `member_name` are convenience columns that may be stale. Always join on `id` for accurate data.

---

## Related Views

| View | Description |
|------|-------------|
| `view_active_members` | Active members only |
| `view_all_members` | All members (all statuses) |
| `view_active_memberships` | Active memberships |
| `view_member_membership_full_details` | Members joined with membership details |
| `view_member_count_per_coach` | Member counts per coach |
| `view_monthly_active_client_count` | Historical active counts by month |
| `membership_holds_tracker` | Current holds with member info |
| `v_member_holds_with_agreement` | Holds with policy detail |
| `view_members_due_for_assessment` | Members due for physicals |
| `member_database_with_age` | `member_database` + computed age |
