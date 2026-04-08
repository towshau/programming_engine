---
name: lockerroom-data-analyst
description: Provides Locker Room Gym Supabase (PostgreSQL 15) context for analytics—entities, enums, KPIs, filters, and SQL patterns. Use when analyzing member retention, renewals, health, coach load, scheduling, Stripe revenue, HubSpot CRM, or any Locker Room–specific database question.
---

# Locker Room Gym — Data Analysis

## SQL Dialect: PostgreSQL (Supabase)

- **Table references**: `public.table_name` or just `table_name` (all tables in `public` schema)
- **Safe division**: `a / NULLIF(b, 0)` returns NULL instead of divide-by-zero error
- **Date functions**:
  - `DATE_TRUNC('month', date_col)` for month truncation
  - `date_col - INTERVAL '1 day'` for date arithmetic
  - `DATE_PART('day', end_date - start_date)` for day difference
  - `CURRENT_DATE` for today's date
- **JSON**: `jsonb_col->>'field_name'` for text values, `jsonb_col->'field_name'` for JSON
- **Arrays**: `UNNEST(array_column)` to expand (e.g. `staff_database.supplementary_roles`)
- **Timestamps**: All `timestamp with time zone` columns are stored in UTC. Use `AT TIME ZONE 'Australia/Sydney'` for local display.
- **String matching**: `LIKE`, `ILIKE` (case-insensitive), `col ~ 'pattern'` for regex
- **Boolean**: Use `TRUE` / `FALSE` literals
- **Enums**: PostgreSQL custom enum types are used extensively — see the enum reference in `references/entities.md`

---

## Business Overview

Locker Room Gym is a premium personal training gym operating across **three locations**:

| Code | Location |
|------|----------|
| `BLIGH` | Sydney CBD — Bligh St |
| `BRIDGE` | Sydney CBD — Bridge St |
| `COLLINS` | Melbourne — Collins St |

Members receive personalised coaching, programming, physicals assessments, and health monitoring. Memberships run for 3, 6, or 12 months and are billed through Stripe. Leads and prospects are managed in HubSpot (synced to Supabase).

---

## Entity Disambiguation

### "Member" vs "Contact" vs "Staff"

| Term | What it means | Primary Table | ID field |
|------|---------------|---------------|----------|
| **Member** | A current or past gym client | `member_database` | `id` (uuid) |
| **Contact / Lead** | A prospect in HubSpot (not yet a member) | `hubspot_contacts_clean` | `id` (text, HubSpot ID) |
| **Staff / Coach** | A Locker Room employee or coach | `staff_database` | `id` (uuid) |

> When someone says "user" or "client" they almost certainly mean **Member** (`member_database`).

### "Membership" vs "Membership Type"

| Term | What it means | Primary Table |
|------|---------------|---------------|
| **Membership** | A specific member's active/historical contract | `member_memberships` |
| **Membership Type** | The product template (e.g. "3x/week, 6 months") | `membership_types` |

A member can have **multiple memberships over time** (renewals each create a new row). The most recent membership is the current one.

### Key Relationships

```
member_database (1) ──── (many) member_memberships
member_database (1) ──── (many) member_holds
member_database (1) ──── (many) member_health_metrics
member_database (1) ──── (many) member_physicals_raw
member_database (1) ──── (1)   stripe_customers
staff_database  (1) ──── (many) member_database  [coach_id]
membership_types (1) ──── (many) member_memberships
member_memberships (1) ──── (many) stripe_invoices
schedule_sessions (1) ──── (many) schedule_session_coaches ──── (many) staff_database
```

---

## Business Terminology

| Term | Definition | Notes |
|------|------------|-------|
| **RM / Results Manager** | The coach assigned to manage a member's results and retention | `member_memberships.rm` flag; staff in `results_manager` supplementary role |
| **Sprint** | A ~3-month business cycle (4 sprints per year) | Sprint 1: Feb–Apr, Sprint 2: May–Jul, Sprint 3: Aug–Oct, Sprint 4: Nov–Jan |
| **Journey Stage** | Where a member sits in the renewal pipeline | See `journey_stage_type` enum below |
| **Hold** | A pause on a membership (member temporarily not training) | `member_holds` table |
| **Physicals** | Quarterly fitness assessment for members | `member_physicals_raw`, scored test battery |
| **Biomap** | A comprehensive health/body composition assessment | `member_biomap`, `member_biomap_results` |
| **Programming** | The personalised workout program written for a member | `member_programs`, `programming_generated` |
| **VOₒ₂ / VO2** | Cardiorespiratory fitness metric (mL/kg/min) | `member_physicals_raw.vo2_value` |
| **Peak / Off-Peak** | Session time-of-day classification | `schedule_sessions.is_peak`; `membership_types.tod_category` |
| **F&F** | Friends & Family membership (discounted) | `membership_status` enum value `'F&F'` |
| **GPP** | General Physical Preparedness — default programming scheme | `member_programs.scheme_name` default |
| **WCR** | Weekly Coach Report | `coach_wcr_logging` |
| **LDP** | Leadership Development Program | `staff_database.roles_ldp` |
| **NPS** | Net Promoter Score (member satisfaction survey) | `survey_newclient_nps` |
| **Inbody** | Body composition scanner used for health metrics | `member_health_metrics.inbody_score` |
| **TeamBuildr** | Third-party app used for workout delivery/completion | `teambuildr_completion_dd` |
| **gr_bligh / gr_bridge / gr_collin** | Boolean flags for gym locations a member belongs to | `member_database` columns |

### Journey Stage Enum (`journey_stage_type`)

| Value | Meaning |
|-------|---------|
| `trial` | On a trial membership |
| `first_30` | First 30 days of membership |
| `new_member` | New member (post-30 days) |
| `awaiting_call` | Due for a renewal call |
| `called_nobooking` | Called but no renewal booked |
| `booked` | Renewal call booked |
| `renewal_complete` | Renewal has been completed |
| `renew_30` | Within 30 days of renewal completion |
| `renewed_member` | Has renewed at least once |
| `non_core_membership` | On a non-standard membership |
| `expired` | Membership has expired |
| `not_renewing` | Confirmed not renewing |
| `no_sale` | Never converted |
| `deciding` | In the decision process |

### Membership Status Enum (`membership_status`)

`active`, `on_hold`, `trial`, `online_coaching`, `boxing_pack`, `expired`, `no_sale`, `F&F`, `inactive`

---

## Standard Filters

**Always apply these filters for member queries:**

```sql
-- Exclude test accounts
WHERE md.test_account = FALSE

-- For active member counts
AND md.current_status = 'active'

-- For active memberships
AND mm.status = 'active'
```

**For financial/invoice queries:**
```sql
-- Only count real payments
WHERE status = 'paid'
  AND member_id IS NOT NULL  -- excludes orphaned Stripe records
```

**For staff queries:**
```sql
-- Only active staff
WHERE staff_status = 'active'
```

**When to override:**
- Historical churn analysis: Include `current_status = 'expired'` and `test_account = FALSE`
- Full member lifecycle: Use `view_all_members` which includes all statuses
- Holds analysis: Use `member_holds` directly (hold records are not filtered by membership status)

---

## Key Metrics

### Active Member Count
- **Definition**: Number of members with an active membership right now
- **Formula**: `COUNT(*) FROM member_database WHERE current_status = 'active' AND test_account = FALSE`
- **Source**: `member_database.current_status`
- **Pre-built view**: `view_active_members`
- **Caveats**: Members on hold still count as `active` in `member_database`; check `member_holds` if you need hold-adjusted counts

### Active Members per Coach
- **Definition**: How many active members each coach is currently responsible for
- **Formula**: `COUNT(member_database.id) GROUP BY coach_id WHERE current_status = 'active' AND test_account = FALSE`
- **Pre-built view**: `view_member_count_per_coach`, `active_members_by_coach`
- **Caveats**: Use `coach_id` (FK to `staff_database`), not `coach_name` text field

### Revenue Collected (Stripe)
- **Definition**: Total payments successfully received
- **Formula**: `SUM(amount_paid) FROM stripe_invoices WHERE status = 'paid'`
- **Source**: `stripe_invoices.amount_paid` (in AUD cents — divide by 100 for dollar value)
- **Caveats**: `amount_due` ≠ `amount_paid` — always use `amount_paid` for collected revenue; amounts are in **cents** (e.g. 50000 = $500.00)

### Renewal Rate
- **Definition**: Proportion of expiring members who renew
- **Formula**: `COUNT(*) WHERE journey_stage = 'renewed_member' / COUNT(*) WHERE membership expired in period`
- **Source**: `member_memberships.journey_stage`, `member_memberships.end_date`
- **Pre-built views**: `view_coach_lifetime_renewals`, `view_sprint_*_renewal_count_total`
- **Caveats**: Use sprint-specific views for accurate sprint renewal tracking

### Coach Session Load
- **Definition**: How many sessions per week a coach is delivering
- **Formula**: Count of `schedule_session_coaches` rows per coach per week
- **Pre-built views**: `view_staff_hours_weekly`, `view_coach_total_workload_weekly`
- **Caveats**: Cross-reference with `staff_database.rm_ceiling` for maximum load context

### Member Health Score
- **Definition**: RAG (Red/Amber/Green) rating of a member's overall health and engagement
- **Source**: `member_memberhealth` table, enum `member_health_enum` (`green`, `yellow`, `red`)
- **Pre-built view**: `v_clients_at_risk` for members at risk (red/yellow)

---

## Data Freshness

| Table | Update Frequency | Notes |
|-------|-----------------|-------|
| `member_database` | Real-time | Updated via app |
| `member_memberships` | Real-time | Updated via app |
| `stripe_invoices` | Near real-time | Webhook-driven |
| `stripe_transactions` | Near real-time | Webhook-driven |
| `member_health_metrics` | On scan | InBody scanner submissions |
| `member_physicals_raw` | Quarterly | Coach-submitted |
| `hubspot_contacts_clean` | Periodic sync | Not real-time |
| `schedule_sessions` | Real-time | Schedule management app |
| `teambuildr_completion_dd` | Daily sync | TeamBuildr API |

```sql
-- Check data freshness for any table
SELECT MAX(created_at) as latest_record FROM stripe_invoices;
SELECT MAX(updated_at) as latest_update FROM member_memberships;
```

---

## Knowledge Base Navigation

| Domain | Reference File | Use For |
|--------|----------------|---------|
| Entities & Relationships | `references/entities.md` | Full entity definitions, enum values, ID conventions |
| Metrics & KPIs | `references/metrics.md` | All KPI formulas, pre-built views |
| Members | `references/tables/members.md` | member_database, member_memberships, member_holds, member_programs |
| Staff & Coaches | `references/tables/staff.md` | staff_database, schedule_sessions, coach reporting |
| Finance & Payments | `references/tables/finance.md` | stripe_invoices, stripe_transactions, stripe_customers |
| Health & Physicals | `references/tables/health.md` | member_physicals_raw, member_health_metrics, biomap tables |
| CRM & Sales | `references/tables/crm.md` | hubspot_contacts_clean, hubspot_deals_clean, lead_referral |
| Scheduling | `references/tables/scheduling.md` | schedule_sessions, schedule_final, schedule_preferences |

For deeper detail on a topic, read the linked file from this skill directory (paths are relative to `SKILL.md`).

---

## Common Query Patterns

### Active Members by Gym
```sql
SELECT
    gym_string,
    COUNT(*) AS member_count
FROM member_database
WHERE current_status = 'active'
  AND test_account = FALSE
GROUP BY gym_string
ORDER BY member_count DESC;
```

### Members per Coach with Gym Breakdown
```sql
SELECT
    sd.coach_name,
    md.gym_string,
    COUNT(md.id) AS member_count
FROM member_database md
JOIN staff_database sd ON md.coach_id = sd.id
WHERE md.current_status = 'active'
  AND md.test_account = FALSE
  AND sd.staff_status = 'active'
GROUP BY sd.coach_name, md.gym_string
ORDER BY sd.coach_name, md.gym_string;
```

### Monthly Revenue (Stripe)
```sql
SELECT
    DATE_TRUNC('month', payment_date) AS month,
    COUNT(*) AS invoice_count,
    SUM(amount_paid) / 100.0 AS revenue_aud
FROM stripe_invoices
WHERE status = 'paid'
  AND member_id IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
```

### Renewal Pipeline by Journey Stage
```sql
SELECT
    mm.journey_stage,
    COUNT(*) AS member_count
FROM member_memberships mm
JOIN member_database md ON mm.member_id = md.id
WHERE mm.status = 'active'
  AND md.test_account = FALSE
GROUP BY mm.journey_stage
ORDER BY member_count DESC;
```

### Members on Hold Right Now
```sql
SELECT
    mh.member_name,
    mh.hold_start,
    mh.hold_end,
    mh.policy_applied,
    mh.hold_notes
FROM member_holds mh
JOIN member_database md ON mh.member_id = md.id
WHERE CURRENT_DATE BETWEEN mh.hold_start AND COALESCE(mh.hold_end, '9999-12-31')
  AND md.test_account = FALSE
ORDER BY mh.hold_start;
```

---

## Troubleshooting

### Common Mistakes

- **Using `coach_name` (text) instead of `coach_id` (uuid)**: The `coach_name` text column can be stale. Always join via `coach_id → staff_database.id` for accurate results.
- **Counting holds as inactive members**: Members on hold still have `current_status = 'active'` in `member_database`. Use `member_holds` to identify who is currently paused.
- **Stripe amounts are in cents**: `stripe_invoices.amount_paid` and `amount_due` are stored in cents (AUD). Divide by 100 for dollar figures.
- **Multiple memberships per member**: A member can have many rows in `member_memberships` (one per contract period). For current membership, filter `WHERE status = 'active'` or use `view_active_memberships`.
- **Test accounts in counts**: Always add `WHERE test_account = FALSE` when counting real members.
- **Timezone**: All timestamps are UTC. For local Australian time, append `AT TIME ZONE 'Australia/Sydney'`.

### Useful Pre-built Views (Use These First!)

| View | Description |
|------|-------------|
| `view_active_members` | All currently active members |
| `view_all_members` | All members regardless of status |
| `view_member_count_per_coach` | Member counts grouped by coach |
| `view_active_memberships` | Currently active memberships with full details |
| `view_member_membership_full_details` | Members joined with their membership details |
| `v_clients_at_risk` | Members flagged as health/engagement risk |
| `view_monthly_active_client_count` | Month-by-month active client count |
| `view_coach_lifetime_renewals` | Renewal stats per coach |
| `view_staff_hours_weekly` | Weekly hours per staff member |
| `consolidated_crm_dashboard` | CRM + member data combined |
