# Supabase (Postgres) Database Map

**Purpose:** Internal documentation of the production-like Supabase database: core tables, relationships, key functions/triggers, and major business flows.  
**Source:** Verified from `information_schema`, `pg_catalog`, and live queries only. No guesses; unknowns are labelled.

---

## A) Executive summary

- **Schemas in use:** `public` (main), plus `auth`, `storage`, `realtime`, `cron`, `holds_tracker` (empty), `extensions`, `graphql*`, `net`, `vault`, `supabase_migrations`, `supabase_functions`.
- **Public schema:** ~120+ base tables and ~80+ views; core business data lives in `member_*`, `staff_*`, `fin_*`, `schedule_*`, and supporting tables.
- **Core hubs (by FK centrality):** `member_database` (master member), `member_memberships` (master membership + lifecycle), `staff_database` (coaches/staff); `member_renewal_meta` and `member_newsale_metadata` are the main sale/renewal metadata records linked from memberships.
- **Largest tables (approx.):** `member_tbresults` (~526k), `member_tbhealthmax` (~164k), `member_daily_sessions_attended` (~98k), `allcontacts_hubspot` (~34k), `fin_pandl` (~27k), `coach_session_actual` (~25k), `session_forecast_next_14_days` (~21k).
- **Membership lifecycle:** New sale → `member_newsale_metadata` + `member_memberships` (newsale_metadata FK). Renewal → `member_renewal_meta` + `member_memberships` (renewal_metadata FK). Holds → `member_holds` (member_id, membership_id) and `membership_holds_tracker`; renewal/new-sale meta both reference `holds_policies`.
- **Health metrics:** `member_health_metrics` stores InBody/body comp (weight, bf, bfm, ffm, smm, raw_payload JSONB); unique on (member_id, date_created). Staging table `stg_member_health_metrics` exists (~3k rows); exact ETL path not verified.
- **Attendance/sessions:** `member_daily_sessions_attended` is the main session log (~98k rows); triggers populate `member_id`, `gym`, `class_type`. `member_weekly_attendance_dd` holds weekly rollups (member_id, coach_id, week_start, sessions_attended, late_cancel, no_shows).
- **Finance:** `fin_pandl` is the main P&amp;L table (gym, category, date, debit/credit). Stripe: `stripe_customers` (→ member_database), `stripe_invoices` (member_id, membership_id); `payment_success_tracker` tracks payments and paid_through (trigger sets payment_status from paid_through).
- **RLS:** Only `member_database` and `staff_database` have RLS enabled in public; no custom policies returned from `pg_policies` for the tables checked (policy definitions may exist elsewhere — **Unknown / needs confirmation**).
- **Triggers:** Critical ones: membership lifecycle (`trg_member_not_renewing`, `trg_member_renewal_complete`), renewal/new-sale meta recalc (`trg_member_renewal_meta_recalc`, `trg_member_newsale_metadata_recalc`), holds end-date autofill (`trg_member_holds_autofill_end_date`), attendance processing (`process_attendance_complete`), and Stripe/webhook-related (`stripe_invoice_n8n`, `MemberNotRenewingN8N`).

---

## B) Core tables overview

| Table | Purpose | Key FKs | Used in flows |
|-------|---------|---------|----------------|
| **member_database** | Master member record (identity, contact, coach, gym flags) | coach_id, salesperson → staff_database; stripe_primary_fk → stripe_customers | All member flows |
| **member_memberships** | Master membership record + lifecycle (start/end, status, journey_stage) | member_id → member_database; coach_id, salesperson_id, renewal_assignee, etc. → staff_database; membership_type_id → membership_types; newsale_metadata → member_newsale_metadata; renewal_metadata → member_renewal_meta; primary_membership_id → self | New sale, renewal, holds, attendance |
| **member_renewal_meta** | Renewal pricing, total sessions, per-session value, holds agreement | member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk | Renewal flow |
| **member_newsale_metadata** | New sale metadata, attribution, price, sessions, holds agreement | member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk | New sale flow |
| **member_health_metrics** | InBody/body comp (weight, bf, bfm, ffm, smm, raw_payload) | member_id → member_database | Health metrics flow |
| **member_holds** | Hold start/end, weeks, credits, policy | member_id → member_database; membership_id → member_memberships | Holds flow |
| **membership_holds_tracker** | Hold tracking (dates, credits, policy selected) | member_id → member_database | Holds flow (complementary to member_holds) |
| **member_daily_sessions_attended** | Per-session attendance log | member_id (nullable, filled by trigger) | Attendance flow |
| **member_weekly_attendance_dd** | Weekly attendance rollup by member/coach | member_id, coach_id → staff_database | Attendance, reporting |
| **fin_pandl** | P&amp;L line items (gym, category, debit/credit) | None (standalone) | Finance flow |
| **staff_database** | Staff/coach master (name, role, status, bracket) | direct_report, buddy_coach → self; session_bracket_fk → system_bracket_policy_rules | All flows involving staff |
| **membership_types** | Membership product (name, session frequency, session total) | — | New sale, renewal |
| **holds_policies** | Hold policy definitions (name, multiplier) | — | New sale, renewal, holds |
| **stripe_customers** | Stripe customer ↔ member link | member_id → member_database | Payments |
| **stripe_invoices** | Stripe invoice records | member_id → member_database; membership_id → member_memberships | Payments |
| **payment_success_tracker** | Payment and paid_through tracking | member_id → member_database; membership_type_id → membership_types | Payments |
| **member_addons** | Member-level addon assignments | member_id, membership_id, addon_id → membership_addons | New sale / addons |
| **membership_addons** | Addon product catalog | — | New sale |
| **schedule_calendar_blocks** | Calendar block assignments | block_id → schedule_block_config; the_date → work_calendar | Scheduling |
| **schedule_preferences** | Staff schedule preferences by period/block | staff_id, period_id, block | Scheduling |
| **member_not_renewing** | Explicit “not renewing” tracking | membership_id, renewal_metadata_id, newsale_metadata_id, multiple staff FKs | Renewal flow |

---

## C) Detailed core table docs

### member_database

- **Purpose:** Master member record: identity, contact, assigned coach/salesperson, gym flags, and Stripe link.
- **Primary key:** `id` (uuid).
- **Key columns:**
  - Identifiers: `id`, `member_name`, `first_name`, `last_name`, `email`, `phone`.
  - Dates: `created_at`, `dob`.
  - Status/enums: `current_status` (USER-DEFINED, default 'active').
  - Staff: `coach_id`, `salesperson` (→ staff_database).
  - Money/metadata: `initial_weight`, `initial_bf_percentage`, `height`; `stripe_primary_fk` → stripe_customers.
  - Gym flags: `gym_string`, `gr_bligh`, `gr_bridge`, `gr_collin` (booleans).
  - Audit/metadata: referral fields, `test_account`, injuries/goals/medications/contraindications, `coach_name` (denorm).
- **Foreign keys:** coach_id, salesperson → staff_database; stripe_primary_fk → stripe_customers.
- **Indexes:** PK; `idx_member_database_coach_id`, `idx_member_database_salesperson`, `idx_member_database_email_lower`, multiple name/trgm indexes for search.
- **RLS:** Enabled. Policies: not listed in pg_policies (Unknown / needs confirmation).

---

### member_memberships

- **Purpose:** Master membership record with lifecycle: dates, status, journey stage, and links to new-sale and renewal metadata.
- **Primary key:** `id` (uuid).
- **Key columns:**
  - Identifiers: `id`, `member_id`, `member_name`, `membership_type_id`.
  - Dates: `start_date`, `end_date`, `created_at`, `renewal_date`.
  - Status/enums: `status` (default 'pending'), `journey_stage`, `membership_stage`, `pipeline_lost`.
  - Staff: `coach_id`, `salesperson_id`, `renewal_assignee`, `handoff_coach_id`, `programming_coach_id`, `revenue_team_assignee`, `nutrition_lead`.
  - Metadata: `newsale_metadata` (FK → member_newsale_metadata), `renewal_metadata` (FK → member_renewal_meta), `gym`, `coach_name`, `membership_notes`, `primary_membership_id` (self-FK for add-ons), `rm`, `check1`/`check2`/`check3`.
- **Foreign keys:** member_id → member_database; coach_id, salesperson_id, renewal_assignee, handoff_coach_id, programming_coach_id, revenue_team_assignee, nutrition_lead → staff_database; membership_type_id → membership_types; newsale_metadata → member_newsale_metadata; renewal_metadata → member_renewal_meta; primary_membership_id → member_memberships.
- **Indexes:** PK; idx on member_id, coach_id, handoff_coach_id, programming_coach_id, revenue_team_assignee, renewal_assignee, salesperson_id, nutrition_lead, membership_type_id, newsale_metadata, renewal_metadata, primary_membership_id; composite filter/lookup indexes (e.g. active primary memberships).
- **RLS:** Disabled.
- **Triggers:** after_member_not_renewing (trg_member_not_renewing), after_member_renewal_complete (trg_member_renewal_complete), trigger_set_inactive_on_not_renewing_expired, trigger_set_status_inactive_on_no_sale, trigger_sync_member_coach_from_handoff_coach.

---

### member_renewal_meta

- **Purpose:** Renewal submission: pricing, total sessions, per-session value, hold value, and holds agreement; linked from member_memberships.renewal_metadata.
- **Primary key:** `id` (uuid, constraint name renewal_submissions_pkey).
- **Key columns:**
  - Identifiers: `id`, `member_id`, `member_name`, `client_email`, `coach_name`, `ongoing_coach_email`, `old_coach_email`, `sales_person`.
  - Dates: `date_created`, `expiry_date`, `cohort_start_date`, `created_data_entry`.
  - Money: `base_membership_value`, `price_paid`, `hold_value`, `per_session_value`, `psv_norm`.
  - Sessions: `session_credits`, `total_sessions`, `membership_weeks`, `renewal_duration_points`, `secondary_membership_session_per_week`, `secondary_memberships`.
  - Metadata: `membership_selected`, `membership_duration`, `gym`, `addons`, `holds_agreement` (text); FKs: coach_id, salesperson_id, membership_type_id, holds_policy_fk.
- **Foreign keys:** member_id → member_database; coach_id, salesperson_id → staff_database; membership_type_id → membership_types; holds_policy_fk → holds_policies.
- **Indexes:** PK; idx on member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk.
- **RLS:** Disabled.
- **Triggers:** trg_biur_member_renewal_meta_recalc (recalc totals); trg_set_holds_policy_renewal (set holds_policy from agreement).

---

### member_newsale_metadata

- **Purpose:** New sale submission: membership selected, price, sessions, per-session value, attribution; linked from member_memberships.newsale_metadata.
- **Primary key:** `id` (uuid, constraint name newsale_submissions_pkey).
- **Key columns:** Parallel to member_renewal_meta: member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk; membership_selected, expiry_date, cohort_start_date, session_credits, total_sessions, membership_weeks, base_membership_value, holds_agreement, price_paid, addons, per_session_value, psv_norm, gym, etc.
- **Foreign keys:** member_id → member_database; coach_id, salesperson_id → staff_database; membership_type_id → membership_types; holds_policy_fk → holds_policies.
- **Indexes:** PK; idx on member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk.
- **RLS:** Disabled.
- **Triggers:** trg_biur_member_newsale_metadata_recalc (recalc); trg_set_holds_policy_newsale (set holds_policy from agreement).

---

### member_health_metrics

- **Purpose:** InBody/body composition: weight, bf, bfm, ffm, smm, and raw payload; one row per member per date_created.
- **Primary key:** `id` (uuid).
- **Unique:** (member_id, date_created).
- **Key columns:** member_id, member_name; height, weight, bf, bfm, ffm, smm, bone_mineral_content, visceral_fat_level, tbw, bmr, inbody_score; age, gender; date_created; raw_payload (jsonb, default '{}').
- **Foreign keys:** member_id → member_database.
- **Indexes:** PK; idx_member_health_metrics_member_id; unique on (member_id, date_created).
- **RLS:** Disabled.

---

### member_holds

- **Purpose:** Hold periods: start/end, full_hold_week, policy, financial and session credits.
- **Primary key:** `id` (uuid).
- **Key columns:** member_id, membership_id, member_name, email; hold_start (NOT NULL), hold_end; full_hold_week, policy_applied, hold_notes; financial_hold_credit, session_account_credit; created_at; RM, travel_programming_notes.
- **Foreign keys:** member_id → member_database; membership_id → member_memberships.
- **Indexes:** PK; idx on member_id, membership_id, lower(email), lower(member_name).
- **RLS:** Disabled.
- **Triggers:** before_member_holds_autofill_end_date (trg_member_holds_autofill_end_date); trg_autofill_member_ids.

---

### membership_holds_tracker

- **Purpose:** Tracks hold dates, credits, and policy selected; complementary to member_holds.
- **Key columns:** id, member_id, member_name, coach_name; hold_start_date, hold_end_date; sessions_per_week, base_membership_value, current_membership_value, hold_credits, hold_credit_applied, vo2_credits; hold_notes, hold_policy_selected; created_at.
- **Foreign keys:** member_id → member_database.
- **Cardinality with member_holds:** Not enforced by FK between the two; both reference member_database. Relationship is logical (same member/hold concept). Unknown / needs confirmation for sync rules.

---

### member_daily_sessions_attended

- **Purpose:** Per-session attendance (session name, date, time, member, coach, gym, class type).
- **Primary key:** `id` (uuid).
- **Key columns:** id, created_at; session_name, session_date, session_start, session_end; member_name, email, phone, client_id, member_id (populated by trigger); coach_name; membership_type, expiry, remaining_visits; gym, class_type.
- **Foreign keys:** member_id → member_database (nullable until trigger fills).
- **Indexes:** PK; idx_mds_att_member_date (member_id, session_date); idx_member_sessions_member_date_desc.
- **Triggers:** trg_auto_populate_member_id; trg_process_attendance_complete; trigger_set_gym_and_class_type.

---

### member_weekly_attendance_dd

- **Purpose:** Weekly attendance rollup by member and coach (sessions_attended, late_cancel, no_shows).
- **Key columns:** id, member_name, member_id, coach_id, coach_name; week_start; sessions_attended, late_cancel, no_shows; slack_channel_id.
- **Foreign keys:** member_id → member_database; coach_id → staff_database.
- **Trigger:** trg_fill_member_weekly_attendance_all.

---

### fin_pandl

- **Purpose:** P&amp;L line items by gym, category, date (debit/credit).
- **Primary key:** `id` (bigint).
- **Key columns:** id, gym, category, date, source, description, reference, debit, credit, comments, created_at, payroll_type, recharge_to_gym.
- **Foreign keys:** None.
- **Indexes:** PK only (no FKs).

---

### staff_database

- **Purpose:** Staff/coach master: name, role, status, bracket, reporting, home gym.
- **Primary key:** `id` (uuid).
- **Key columns:** id, first_name, last_name, coach_name, dob, lockeroom_email, personal_email, mobile_number; role, staff_status (active/inactive), direct_report, buddy_coach; session_bracket_fk, sb_selector, sb_recommended; home_gym, state, employment_type; updated_at; style_* (relator, transformer, etc.), rm_ceiling, supplementary_roles, kpi, slack_*.
- **Foreign keys:** direct_report, buddy_coach → staff_database; session_bracket_fk → system_bracket_policy_rules.
- **Indexes:** PK; ux_staff_coach_name_ci (unique lower trim coach_name); idx_staff_database_session_bracket_fk; idx_staff_direct_report_active.
- **RLS:** Enabled. Policies: not listed in pg_policies (Unknown / needs confirmation).
- **Triggers:** trg_create_staff_onboarding_tasks, trg_staff_database_updated_at, trg_update_bracket_fk, trg_update_staff_onboarding_state_responsible.

---

### stripe_customers / stripe_invoices

- **stripe_customers:** id (uuid), member_id (→ member_database), stripe_customer_id, billing_name, email. Triggers: auto_assign member_id, autofill billing, set updated_at.
- **stripe_invoices:** id, stripe_invoice_id, stripe_customer_id, member_id, membership_id, status, payment_method, payment_date, amount_due, amount_paid, currency, created_at, updated_at, raw_event (jsonb), plus many Stripe-specific fields. Triggers: stripe_invoice_n8n (http_request), auto_assign member_id, set updated_at.

---

### payment_success_tracker

- **Purpose:** Tracks payment success, paid_through date, and payment_status (derived from paid_through via trigger).
- **Key columns:** member_id, membership_type_id; payment_date, amount, sale_type, payment_status, payment_method, product_description; start_date, end_date, paid_through_date, paid_through_updated_at; multiple amount_2..amount_12 and payment_date_2..payment_date_12 (installment-style). Trigger: set_payment_status_from_paid_through.

---

### holds_policies

- **Purpose:** Hold policy definitions (name, multiplier, description).
- **Key columns:** id (uuid), policy_name, date_created, policy_multiplier, description.
- **Referenced by:** member_renewal_meta, member_newsale_metadata (holds_policy_fk).

---

### membership_types

- **Purpose:** Membership product catalog (name, session_frequency_per_week, session_total, category, sort_order, tod_category).
- **Referenced by:** member_memberships, member_renewal_meta, member_newsale_metadata, membership_versions.

---

## D) Relationship map (ERD-style)

```
member_database (1) ──< member_memberships (many)  [member_id]
       │                         │
       │                         ├── newsale_metadata (0..1) ──> member_newsale_metadata
       │                         ├── renewal_metadata (0..1) ──> member_renewal_meta
       │                         ├── primary_membership_id (0..1) ──> member_memberships (self)
       │                         └── membership_type_id ──> membership_types
       │
       ├──< member_holds (many) [member_id, membership_id ──> member_memberships]
       ├──< membership_holds_tracker (many) [member_id]
       ├──< member_health_metrics (many) [member_id]
       ├──< member_daily_sessions_attended (many) [member_id]
       ├──< member_weekly_attendance_dd (many) [member_id, coach_id ──> staff_database]
       ├── stripe_primary_fk (0..1) ──> stripe_customers
       └── coach_id / salesperson ──> staff_database

member_renewal_meta (1) ──< member_memberships (0..1 per renewal_metadata)  [renewal_metadata]
  └── member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk

member_newsale_metadata (1) ──< member_memberships (0..1 per newsale_metadata)  [newsale_metadata]
  └── member_id, coach_id, salesperson_id, membership_type_id, holds_policy_fk

member_holds (many) ── membership_id ──> member_memberships (many)  [1:many per membership]

staff_database (1) ──< member_database.coach_id, salesperson (many)
staff_database (1) ──< member_memberships (many: coach_id, salesperson_id, renewal_assignee, handoff_coach_id, programming_coach_id, revenue_team_assignee, nutrition_lead)
staff_database (1) ──< member_renewal_meta / member_newsale_metadata (many: coach_id, salesperson_id)
staff_database (1) ──< member_holds (none direct); member_weekly_attendance_dd.coach_id (many)
staff_database (1) ── direct_report, buddy_coach ──> staff_database (self)

stripe_customers (1) ──< member_database.stripe_primary_fk (0..1)
stripe_invoices (many) ── member_id ──> member_database; membership_id ──> member_memberships

fin_pandl — standalone (no FKs to member/staff)
payment_success_tracker ── member_id ──> member_database; membership_type_id ──> membership_types
```

**Cardinality summary:**

- **member_database ↔ member_memberships:** 1:many (one member, many memberships over time).
- **member_memberships ↔ member_renewal_meta:** many:1 (many memberships can point to one renewal_meta in theory; in practice often 1:1 per renewal).
- **member_memberships ↔ member_newsale_metadata:** many:1 (similarly, 1:1 per new sale in practice).
- **member_memberships ↔ member_holds:** 1:many (one membership can have multiple holds).
- **member_database ↔ member_health_metrics:** 1:many (one row per member per date_created).
- **member_database ↔ member_daily_sessions_attended:** 1:many.
- **member_database ↔ member_weekly_attendance_dd:** 1:many (per week/coach).

---

## E) Functions & triggers catalog (grouped by domain)

### Membership lifecycle

| Function | Trigger / usage | When it fires | What it does |
|----------|-----------------|---------------|--------------|
| **trg_member_not_renewing** | after_member_not_renewing on member_memberships | After INSERT/UPDATE on member_memberships | Creates/updates member_not_renewing row when membership is marked not renewing. |
| **trg_member_renewal_complete** | after_member_renewal_complete on member_memberships | After membership renewal completed | Links renewal_metadata / updates lifecycle. |
| **set_status_inactive_on_not_renewing_expired** | trigger on member_memberships | When not-renewing period expired | Sets membership status to inactive. |
| **set_status_inactive_on_no_sale** | trigger on member_memberships | When no sale recorded | Sets status inactive. |
| **sync_member_coach_from_handoff_coach** | trigger on member_memberships | When handoff_coach_id set | Syncs coach from handoff to main coach (denorm). |

### Renewal / new sale meta (recalc & holds policy)

| Function | Trigger / usage | When it fires | What it does |
|----------|-----------------|---------------|--------------|
| **trg_member_renewal_meta_recalc** | trg_biur_member_renewal_meta_recalc on member_renewal_meta | BEFORE INSERT OR UPDATE | Recalculates derived totals (e.g. per_session_value, total_sessions) for renewal. |
| **trg_member_newsale_metadata_recalc** | trg_biur_member_newsale_metadata_recalc on member_newsale_metadata | BEFORE INSERT OR UPDATE | Recalculates new-sale derived totals. |
| **set_holds_policy_from_agreement_renewal** | trg_set_holds_policy_renewal on member_renewal_meta | When holds_agreement text set | Sets holds_policy_fk from agreement text. |
| **set_holds_policy_from_agreement_newsale** | trg_set_holds_policy_newsale on member_newsale_metadata | When holds_agreement text set | Sets holds_policy_fk from agreement text. |

Helper (called by recalc triggers): **recalc_member_renewal_meta_totals**, **recalc_member_newsale_metadata_totals**.

### Holds

| Function | Trigger / usage | When it fires | What it does |
|----------|-----------------|---------------|--------------|
| **trg_member_holds_autofill_end_date** | before_member_holds_autofill_end_date on member_holds | BEFORE INSERT/UPDATE | Derives hold_end from hold_start + full_hold_week (or policy). |
| **trg_autofill_member_ids** | on member_holds | — | Fills member_id (and possibly membership_id) from name/email. |

### Attendance / sessions

| Function | Trigger / usage | When it fires | What it does |
|----------|-----------------|---------------|--------------|
| **auto_populate_member_id** | trg_auto_populate_member_id on member_daily_sessions_attended | Before/after insert | Populates member_id from name/email. |
| **process_attendance_complete** | trg_process_attendance_complete on member_daily_sessions_attended | After insert/update | Post-processing for attendance (downstream rollups or flags — exact side effects not inspected). |
| **set_gym_and_class_type** | trigger_set_gym_and_class_type on member_daily_sessions_attended | — | Sets gym and class_type. |
| **fill_member_weekly_attendance_all** | trg_fill_member_weekly_attendance_all on member_weekly_attendance_dd | — | Fills weekly attendance (likely from daily). |

### Member master / sync

| Function | Trigger / usage | When it fires | What it does |
|----------|-----------------|---------------|--------------|
| **sync_membership_gym_from_member** | trg_sync_membership_gym_from_member on member_database | When member_database changes | Copies gym from member to active membership(s). |
| **propagate_member_name_change** | trg_propagate_member_name_change on member_database | When member name changes | Propagates name to related tables (e.g. memberships, renewal/newsale meta). |
| **set_member_fullname** | trg_set_member_fullname on member_database | — | Sets member_name from first_name/last_name. |
| **set_gym_flags** | trg_set_gym_flags on member_database | — | Sets gym boolean flags. |
| **notify_email_change** / **notify_member_email_update** | on member_database | On email update | Notify (e.g. webhook or audit). |
| **update_boxing_list_on_inactive** | on member_database | When status inactive | Updates member_boxing_list. |

### Stripe / payments

| Function | Trigger / usage | When it fires | What it does |
|----------|-----------------|---------------|--------------|
| **trg_stripe_customers_auto_assign_member_id** | on stripe_customers | — | Links stripe customer to member_database. |
| **trg_stripe_invoices_auto_assign_member_id** | on stripe_invoices | — | Assigns member_id (and possibly membership_id) to invoice. |
| **stripe_invoice_n8n** | stripe_invoice_n8n on stripe_invoices | After insert/update | http_request — calls N8N webhook. |
| **set_payment_status_from_paid_through** | on payment_success_tracker | When paid_through_date set | Sets payment_status from paid_through. |

### Other (staff, admin, schedule, etc.)

- **staff_database:** create_staff_onboarding_tasks, trg_update_timestamp, trg_update_bracket_fk, update_staff_onboarding_state_responsible.
- **member_not_renewing:** MemberNotRenewingN8N (http_request), calculate_member_not_renewing_dates, set_good_bad_from_membership.
- **Admin onboarding/tickets:** reorder/sync tasks, fire_webhook_on_admin_ticket_status, auto_populate_assignee_from_department.
- **Schedule:** sync_to_rolling (schedule_preferences → rolling_schedule_preferences), trg_enforce_pref_rules, trg_populate_coach_name_schedule_preferences.
- **Biomap / physicals / Teambuildr / VO2:** update_updated_at_column, auto_calculate_physicals_scores, sync_exercise_library_from_tbhealthmax, fill_member_id_teambuildr, etc.

---

## F) Business flows (narrative)

### New sale flow

1. **Lead / member:** Member may already exist in `member_database` (or be created). `member_database` has coach_id, salesperson (→ staff_database).
2. **Sale captured:** A row is created in `member_newsale_metadata` with membership_selected, price_paid, total_sessions, per_session_value, holds_agreement, coach_id, salesperson_id, membership_type_id. Triggers: **trg_member_newsale_metadata_recalc** recalculates totals; **set_holds_policy_from_agreement_newsale** sets holds_policy_fk from holds_agreement text.
3. **Membership created:** `member_memberships` row is created with member_id, start_date, end_date, membership_type_id, **newsale_metadata** = id of the new-sale meta row, coach_id, salesperson_id, status (e.g. active), journey_stage, gym.
4. **Payment fields:** Payment can be recorded in `payment_success_tracker` (member_id, membership_type_id, payment_date, amount, paid_through_date); trigger sets payment_status from paid_through. Stripe: `stripe_customers` links to member_database; `stripe_invoices` has member_id and membership_id — populated by triggers and optionally N8N (stripe_invoice_n8n).
5. **Addons:** Optional `member_addons` rows (member_id, membership_id, addon_id → membership_addons).

**Missing / unclear:** Exact source of “lead captured” (e.g. CRM table or app). Whether membership is always created in same transaction as member_newsale_metadata is application logic (not enforced by DB).

---

### Renewal flow

1. **Renewal created/updated:** A row is created or updated in `member_renewal_meta` (member_id, coach_id, salesperson_id, membership_type_id, base_membership_value, price_paid, total_sessions, per_session_value, hold_value, holds_agreement, etc.). Triggers: **trg_member_renewal_meta_recalc** recalculates totals; **set_holds_policy_from_agreement_renewal** sets holds_policy_fk.
2. **Membership linked:** `member_memberships` is updated with **renewal_metadata** = id of the renewal_meta row, and likely end_date extended, status/journey_stage updated.
3. **Completion:** Trigger **trg_member_renewal_complete** on member_memberships runs when renewal is completed (exact condition in function — not inspected).
4. **Not renewing:** If member is marked not renewing, **trg_member_not_renewing** creates/updates `member_not_renewing` (membership_id, renewal_metadata_id, newsale_metadata_id, staff FKs). **MemberNotRenewingN8N** fires http_request. **set_status_inactive_on_not_renewing_expired** later sets membership status to inactive when the not-renewing window expires.

**Missing / unclear:** Definitive source of “renewal date” vs “renewal_metadata created” (e.g. renewal_date on member_memberships). Per-session value (PSV) is stored and recalculated in member_renewal_meta; usage in reporting is via views (e.g. view_active_session_total_psv).

---

### Holds flow

1. **Hold created:** Row inserted into `member_holds` with member_id, membership_id, hold_start (required), full_hold_week, policy_applied, hold_notes, financial_hold_credit, session_account_credit. **trg_member_holds_autofill_end_date** (before insert/update) fills hold_end from hold_start + full_hold_week (or policy). **trg_autofill_member_ids** can fill member_id/membership_id from name/email.
2. **Entitlement / forecast:** Holds affect “remaining” entitlement and scheduling; exact tables for “entitlement” or “forecast” are not fully verified — likely derived in views or app logic from member_memberships + member_holds (e.g. session_forecast_next_14_days, or membership_holds_tracker).
3. **membership_holds_tracker:** Holds are also tracked in membership_holds_tracker (hold_start_date, hold_end_date, hold_credits, hold_policy_selected). Sync or ownership between member_holds and membership_holds_tracker is **Unknown / needs confirmation**.

---

### Health metrics flow (InBody)

1. **Import / staging:** Data may land in `stg_member_health_metrics` (~3k rows). ETL or app then upserts into `member_health_metrics`. Exact import path (e.g. InBody API, CSV, manual) not verified.
2. **member_health_metrics:** One row per (member_id, date_created). Columns: weight, bf, bfm, ffm, smm, inbody_score, raw_payload (jsonb), etc. member_id → member_database.
3. **Downstream usage:** Views such as `member_bodyweight_combined`; reporting and “members due for assessment” (view_members_due_for_assessment). No triggers on member_health_metrics that write to other tables (only schema verified).

**Missing / unclear:** Staging → member_health_metrics ETL (job or app); whether InBody device/source is recorded in raw_payload or elsewhere.

---

### Attendance / sessions flow

1. **Session log:** Rows inserted into `member_daily_sessions_attended` (session_name, session_date, session_start, session_end, member_name, email, coach_name, etc.). **auto_populate_member_id** fills member_id from name/email; **set_gym_and_class_type** sets gym and class_type; **process_attendance_complete** runs after insert/update (downstream effects not fully traced).
2. **Weekly rollup:** `member_weekly_attendance_dd` holds weekly aggregates (member_id, coach_id, week_start, sessions_attended, late_cancel, no_shows). Trigger **fill_member_weekly_attendance_all** fills or refreshes this (likely from daily data or external source).
3. **Forecast:** `session_forecast_next_14_days` (~21k rows) is a table (not a view) used for capacity/forecast; relationship to member_daily_sessions_attended and member_holds not fully mapped here.

---

### Finance flow

1. **fin_pandl:** Line items inserted/updated with gym, category, date, debit, credit, source, description. No FKs; used for P&amp;L reporting.
2. **Stripe:** `stripe_invoices` and `stripe_customers` linked to member_database and member_memberships via triggers; stripe_invoice_n8n sends events to N8N.
3. **payment_success_tracker:** Tracks payments and paid_through_date; **set_payment_status_from_paid_through** sets payment_status. Used for “paid through” and payment status reporting.
4. **Reconciliation:** No single “source of truth” view documented here; fin_pandl vs Stripe vs payment_success_tracker reconciliation is application-level.

---

## G) Risks & recommendations

### Missing constraints

- **member_daily_sessions_attended.member_id** is nullable and filled by trigger; consider NOT NULL after backfill + constraint to enforce referential integrity once populated.
- **member_holds.hold_end** is derived by trigger; consider CHECK (hold_end >= hold_start) or similar if not present.
- **payment_success_tracker:** Many repeated columns (amount_2..12, payment_date_2..12) suggest installments; consider normalizing to a payment_installments child table and add FK to membership or invoice where appropriate.
- **membership_holds_tracker** has no FK to member_holds or member_memberships; relationship is by member_id only. If intended to align with member_holds, consider membership_id and/or hold_id and constraints.

### Duplicated sources of truth

- **Hold tracking:** Both `member_holds` and `membership_holds_tracker` store hold dates/credits; clarify which is authoritative and document sync or deprecation.
- **Payment status:** payment_success_tracker.payment_status is derived from paid_through; Stripe state lives in stripe_invoices. Ensure reporting uses one consistent source or a single view.
- **Coach name:** Denormalized on member_database, member_memberships, member_renewal_meta, member_newsale_metadata; triggers propagate. Acceptable for read performance but keep propagation triggers documented and tested.

### Naming inconsistencies

- **member_newsale_metadata** vs user-facing “new_sale_meta” (documented as alias in requirements); table name is member_newsale_metadata.
- **Primary key names:** member_newsale_metadata uses constraint name `newsale_submissions_pkey`; member_renewal_meta uses `renewal_submissions_pkey` (consistent pattern but different from table prefix).
- **staff_database** has two PK constraint names (Performance_review_test_id_key and Performance_review_test_pkey); redundant and naming is legacy.

### Performance hotspots

- **member_tbresults** (~526k) and **member_tbhealthmax** (~164k): Verify indexes on member_id and date/timestamp columns for common filters.
- **member_daily_sessions_attended** (~98k): Indexes on (member_id, session_date) and (member_id, session_date DESC, session_start DESC) exist; monitor query patterns for coach_id or gym-only filters (consider partial indexes if needed).
- **fin_pandl** (~27k): No non-PK indexes; add (gym, date) or (category, date) if reporting filters by these.
- **session_forecast_next_14_days** (~21k): Confirm indexes for date and membership/coach filters.

### Places to add views for analytics

- **Single “member + active membership + renewal/new-sale meta” view:** Join member_database, member_memberships (filter active/primary), member_renewal_meta, member_newsale_metadata for reporting and BI.
- **Hold summary per membership:** View aggregating member_holds (and optionally membership_holds_tracker) by membership_id with total hold weeks and credits.
- **Payment vs membership:** View joining payment_success_tracker and stripe_invoices to member_memberships for “paid through” and next payment date.
- **Attendance summary by member/coach/period:** Materialized view or view on member_daily_sessions_attended / member_weekly_attendance_dd for dashboards to avoid repeated heavy aggregation.

---

*Document generated from verified database metadata. Last verification: public schema tables, FKs, indexes, triggers, and selected column/constraint queries. RLS policy details and trigger body logic not fully inspected.*
