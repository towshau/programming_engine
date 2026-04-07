# CRM & Sales Domain Tables

## Business Context

Locker Room uses HubSpot as its CRM for managing leads and prospects. Data is synced into Supabase via periodic imports. Contacts in HubSpot represent potential members (pre-signup). Once they convert to members, they exist in both `hubspot_contacts_clean` (as a contact) and `member_database` (as a member), linked by email address.

Referrals from existing members are tracked in `lead_referral` and `member_referral_log`.

---

## Key Tables

### `hubspot_contacts_clean`
**Description**: HubSpot CRM contacts (leads/prospects, includes converted members).
**Primary Key**: `id` (text — HubSpot numeric ID as string)
**Note**: NOT real-time. Data is synced periodically.

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | text | HubSpot contact ID | External ID, not uuid |
| `email` | text | Contact email | Use to link to `member_database` |
| `first_name` / `last_name` | text | Name | |
| `phone` | text | Phone number | |
| `lifecycle_stage` | text | HubSpot lifecycle stage | e.g. `lead`, `customer`, `opportunity` |
| `lead_status` | text | Lead status | |
| `owner_id` | text | HubSpot owner ID | Maps to a salesperson |
| `company_id` | text | HubSpot company ID | |
| `attrs` | jsonb | All HubSpot contact attributes | Extended properties in JSON |

**Linking to members**:
```sql
SELECT hc.*, md.id AS member_id, md.current_status
FROM hubspot_contacts_clean hc
LEFT JOIN member_database md ON LOWER(hc.email) = LOWER(md.email)
  AND md.test_account = FALSE;
```

---

### `hubspot_deals_clean`
**Description**: HubSpot deals (sales opportunities).
**Primary Key**: `id` (text — HubSpot deal ID)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | text | HubSpot deal ID | |
| `deal_name` | text | Deal name | |
| `amount` | text | Deal value (text) | Convert to numeric for calculations |
| `pipeline` | text | Pipeline name | |
| `deal_stage` | text | Stage within pipeline | |
| `last_modified` | text | Last modified timestamp | |
| `owner_id` | text | Sales owner | |
| `deal_type` | text | Type of deal | |
| `contact_id` | text | FK → `hubspot_contacts_clean.id` | |
| `attrs` | jsonb | All HubSpot deal attributes | |

**Note**: `amount` is stored as TEXT — cast to numeric for aggregations:
```sql
CAST(NULLIF(amount, '') AS numeric)
```

---

### `lead_referral`
**Description**: Referral records — tracks when an existing member refers a new prospect.
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Referral ID | |
| `referring_member` | uuid | FK → `member_database` | Who made the referral |
| `membership` | uuid | FK → `member_memberships` | Which membership of the referrer |
| `touchpoint_type` | enum | Type of referral touchpoint | e.g. `renewal`, `30_day_call`, `3_month_revenue_call` |
| `created_at` | timestamptz | When referral was logged | |

---

### `member_referral_log`
**Description**: Log of referral actions taken (e.g. referral credits issued).

| Column | Type | Description |
|--------|------|-------------|
| `member_id` | uuid | FK → `member_database` (referring member) |
| `staff_member_id` | uuid | FK → `staff_database` |
| `touchpoint_type` | enum `referral_touchpoint_type` | Type of referral touchpoint |

---

### `member_referral_credits`
**Description**: Credits granted to members for successful referrals.

| Column | Type | Description |
|--------|------|-------------|
| `member_id` | uuid | FK → `member_database` |
| `membership_id` | uuid | FK → `member_memberships` |
| `lead_referral_id` | uuid | FK → `lead_referral` |

---

### `crm_contacts_clean`
**Description**: Cleaned/deduplicated CRM contacts (merged from multiple sources).

| Column | Type | Description |
|--------|------|-------------|
| `email` | text | Email address |
| `first_name` / `last_name` | text | Name |
| `phone` | text | Phone |
| `uploaded_at` | timestamptz | When record was synced |
| `hubspot_updated_at` | timestamp | Last HubSpot update |

---

### `member_newsale_metadata`
**Description**: Metadata captured at the point of a new membership sale.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `member_id` | uuid | FK → `member_database` |
| `salesperson_id` | uuid | FK → `staff_database` |
| `membership_type_id` | uuid | FK → `membership_types` |
| `coach_id` | uuid | FK → `staff_database` |
| `holds_policy_fk` | uuid | FK → `holds_policies` |

---

### `member_renewal_meta`
**Description**: Metadata for membership renewals.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `member_id` | uuid | FK → `member_database` |
| `salesperson_id` | uuid | FK → `staff_database` |
| `membership_type_id` | uuid | FK → `membership_types` |
| `coach_id` | uuid | FK → `staff_database` |
| `holds_policy_fk` | uuid | FK → `holds_policies` |

---

## Sample Queries

### Leads Not Yet Converted to Members
```sql
SELECT
    hc.email,
    hc.first_name,
    hc.last_name,
    hc.lifecycle_stage,
    hc.lead_status
FROM hubspot_contacts_clean hc
LEFT JOIN member_database md ON LOWER(hc.email) = LOWER(md.email)
    AND md.test_account = FALSE
WHERE md.id IS NULL
  AND hc.lifecycle_stage = 'lead'
ORDER BY hc.lead_status;
```

### Top Referrers (Members Who Refer Most)
```sql
SELECT
    md.member_name,
    md.gym_string,
    COUNT(lr.id) AS referrals_made
FROM lead_referral lr
JOIN member_database md ON lr.referring_member = md.id
GROUP BY md.id, md.member_name, md.gym_string
ORDER BY referrals_made DESC
LIMIT 20;
```

### Sales by Salesperson (New Sales)
```sql
SELECT
    sd.coach_name AS salesperson,
    COUNT(mm.id) AS new_sales,
    DATE_TRUNC('month', mm.start_date) AS month
FROM member_memberships mm
JOIN member_newsale_metadata nsm ON mm.newsale_metadata = nsm.id
JOIN staff_database sd ON nsm.salesperson_id = sd.id
JOIN member_database md ON mm.member_id = md.id
WHERE md.test_account = FALSE
GROUP BY sd.coach_name, DATE_TRUNC('month', mm.start_date)
ORDER BY month DESC, new_sales DESC;
```

---

## Common Gotchas

1. **HubSpot data is NOT real-time**: `hubspot_contacts_clean` and `hubspot_deals_clean` are synced periodically. Don't rely on them for live sales pipeline.

2. **`amount` in hubspot_deals_clean is TEXT**: Cast it: `CAST(NULLIF(amount, '') AS numeric)`.

3. **Email case sensitivity**: Email matching between HubSpot and member_database should use `LOWER()` on both sides to handle case differences.

4. **HubSpot IDs are strings**: `hubspot_contacts_clean.id` is a text field (HubSpot numeric IDs), not a uuid. Never try to cast to uuid.

---

## Related Views

| View | Description |
|------|-------------|
| `consolidated_crm_dashboard` | Combined CRM + member data |
| `crm_contacts_dashboard_summary` | Contact summary stats |
| `crm_deals_enriched` | Deals with additional context |
| `crm_member_flags` | Member flags from CRM |
| `member_referral_view` | Referral log with member details |
