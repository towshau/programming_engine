# Entities & Relationships

## Core Entities

### Member (`member_database`)
**Definition**: A current or former gym client of Locker Room.
**Primary Key**: `id` (uuid)
**Business Key**: `email` (text, may be null for old records)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Internal member ID | Primary key, use for all joins |
| `first_name` / `last_name` | text | Member's name | Also stored denormalized as `member_name` |
| `email` | text | Email address | May be empty string `''` not NULL for missing |
| `dob` | date | Date of birth | Used to compute age |
| `current_status` | enum `membership_status` | Current membership status | `active`, `expired`, `on_hold`, `trial`, etc. |
| `coach_id` | uuid → `staff_database.id` | Assigned coach | Main coaching relationship |
| `coach_name` | text | Denormalized coach name | May be stale — join via `coach_id` for accuracy |
| `gym_string` | text | Home gym location | `BLIGH`, `BRIDGE`, or `COLLINS` |
| `gr_bligh` / `gr_bridge` / `gr_collin` | boolean | Gym location flags | Set `true` if member trains at that gym |
| `stripe_primary_fk` | uuid → `stripe_customers.id` | Link to Stripe | For billing lookups |
| `test_account` | boolean | Is this a test/fake member? | **ALWAYS filter `test_account = FALSE`** |
| `referrer_id` | uuid → `member_database.id` | Who referred this member | Self-referential |
| `salesperson` | uuid → `staff_database.id` | Staff who sold the membership | |
| `initial_weight` | numeric | Weight at signup (kg) | |
| `initial_bf_percentage` | numeric | Body fat % at signup | |

---

### Staff / Coach (`staff_database`)
**Definition**: A Locker Room employee (coach, manager, admin, etc.)
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Internal staff ID | Primary key |
| `coach_name` | text | Full display name | Use this for display |
| `first_name` / `last_name` | text | Name parts | |
| `role` | text | Primary role | Free text |
| `supplementary_roles` | text[] | Additional roles | Array, e.g. `{results_manager, programming_coach}` |
| `staff_status` | enum `active_inactive` | `active` or `inactive` | Filter `= 'active'` for current staff |
| `home_gym` | text | Primary gym | `BLIGH`, `BRIDGE`, `COLLINS` |
| `rm_ceiling` | numeric | Max number of clients as RM | Results Manager capacity cap |
| `direct_report` | uuid → `staff_database.id` | Manager | Self-referential hierarchy |
| `employment_type` | text | `FTE`, `casual`, etc. | |
| `auth_id` | uuid | Supabase Auth user ID | Links to `auth.users` |
| `executive` | boolean | Is executive/leadership team | |

**Supplementary roles** (from `staff_roles` enum):
`results_manager`, `programming_coach`, `sales_team`, `nutrition_team`, `human_resources`

---

### Membership (`member_memberships`)
**Definition**: A specific membership contract for a member.
**Primary Key**: `id` (uuid)
**Note**: A member can have MULTIPLE rows — one per contract period (new sale + each renewal)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Membership ID | |
| `member_id` | uuid → `member_database.id` | The member | |
| `membership_type_id` | uuid → `membership_types.id` | Product type | Frequency, sessions, category |
| `start_date` | date | Contract start | |
| `end_date` | date | Contract end | |
| `status` | text | `active`, `expired`, `pending`, etc. | |
| `journey_stage` | enum `journey_stage_type` | Renewal pipeline stage | See SKILL.md for all values |
| `coach_id` | uuid → `staff_database.id` | Assigned coach | |
| `gym` | text | Gym location | `BLIGH`, `BRIDGE`, `COLLINS` |
| `pipeline_lost` | enum `pipelinelost_churnmarker` | Churn type | `good_churn` or `bad_churn` |
| `rm` | boolean | Results Manager responsible | Default `true` |
| `primary_membership_id` | uuid → `member_memberships.id` | For renewals: links to original | Self-referential |
| `renewal_date` | date | Date renewal was processed | |

---

### Membership Type (`membership_types`)
**Definition**: The product template defining sessions, frequency, and category.
**Primary Key**: `id` (uuid)

| Column | Type | Description |
|--------|------|-------------|
| `name` | text | Product name (e.g. "3x/week All Inclusive - 6 Months") |
| `session_frequency_per_week` | integer | Sessions per week |
| `session_total` | integer | Total sessions over membership |
| `category` | enum `membership_category_enum` | `all_inclusive`, `boxing_only`, `online_coaching`, `na` |
| `tod_category` | enum `tod_category_enum` | `on_peak`, `off_peak`, `online` |

---

## Relationship Map

```
member_database
├── coach_id ────────────────────────→ staff_database.id
├── salesperson ─────────────────────→ staff_database.id
├── referrer_id ─────────────────────→ member_database.id  (self-ref)
├── stripe_primary_fk ───────────────→ stripe_customers.id
│
├── member_memberships (member_id)
│   ├── membership_type_id ──────────→ membership_types.id
│   ├── coach_id ────────────────────→ staff_database.id
│   ├── newsale_metadata ────────────→ member_newsale_metadata.id
│   ├── renewal_metadata ────────────→ member_renewal_meta.id
│   ├── primary_membership_id ───────→ member_memberships.id (self-ref)
│   └── stripe_invoices (membership_id)
│
├── member_holds (member_id)
├── member_health_metrics (member_id)
├── member_physicals_raw (member_id)
├── member_programs (member_id)
├── member_biomap (member_id)
├── member_addons (member_id)
└── teambuildr_completion_dd (member_id)

staff_database
├── direct_report ───────────────────→ staff_database.id  (self-ref)
├── buddy_coach ─────────────────────→ staff_database.id  (self-ref)
├── schedule_final (coach_id)
├── schedule_session_coaches (coach_id)
├── coach_wcr_logging (coach_id)
└── coach_monthly_report (coach_id)
```

---

## ID Conventions

| Entity | ID Column | Type | Notes |
|--------|-----------|------|-------|
| Member | `member_database.id` | uuid | Use for all member joins |
| Staff | `staff_database.id` | uuid | Use for all coach/staff joins |
| Membership | `member_memberships.id` | uuid | |
| Stripe Customer | `stripe_customers.stripe_customer_id` | text | External Stripe ID (prefix `cus_`) |
| Stripe Invoice | `stripe_invoices.stripe_invoice_id` | text | External Stripe ID (prefix `in_`) |
| HubSpot Contact | `hubspot_contacts_clean.id` | text | HubSpot numeric ID as string |

**Never join on name strings** — coach names and member names are denormalized convenience fields that can be stale or inconsistent. Always join on `id` columns.
