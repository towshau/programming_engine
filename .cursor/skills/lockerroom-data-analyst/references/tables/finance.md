# Finance & Payments Domain Tables

## Business Context

Locker Room processes all membership payments through Stripe. Invoices are triggered by membership start dates and renewal cycles. The `stripe_invoices` table is the primary source of truth for revenue tracking. All financial figures are stored in **AUD cents** — always divide by 100 for dollar values.

> **Critical**: `amount_paid` and `amount_due` are in CENTS. 50000 = $500.00 AUD.

---

## Key Tables

### `stripe_customers`
**Description**: Stripe customer records linked to Locker Room members.
**Primary Key**: `id` (uuid, internal)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Internal Stripe customer record ID | Use for joins within Supabase |
| `member_id` | uuid | FK → `member_database` | |
| `stripe_customer_id` | text | Stripe external ID | Prefix `cus_` |
| `billing_name` | text | Name on billing | |
| `email` | text | Billing email | |

**Relationship**: `member_database.stripe_primary_fk` → `stripe_customers.id`

---

### `stripe_invoices`
**Description**: Every Stripe invoice — the primary table for revenue reporting.
**Primary Key**: `id` (uuid, internal)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Internal ID | |
| `stripe_invoice_id` | text | Stripe external ID | Prefix `in_` |
| `stripe_customer_id` | text | Stripe customer ID | Prefix `cus_` |
| `member_id` | uuid | FK → `member_database` | May be NULL for orphaned records |
| `membership_id` | uuid | FK → `member_memberships` | |
| `status` | text | Invoice status | `paid`, `open`, `void`, `uncollectible`, `draft`, `failed` |
| `payment_date` | timestamptz | When paid | NULL if not yet paid |
| `amount_due` | numeric | Amount billed (cents) | What was invoiced |
| `amount_paid` | numeric | Amount collected (cents) | **Use this for revenue** |
| `currency` | text | Currency code | Default `'aud'` |
| `payment_method` | text | Payment method type | |
| `last_4_digits` | text | Card last 4 | |
| `brand` | text | Card brand (Visa, Mastercard) | |
| `attempt_count` | integer | Number of payment attempts | |
| `next_payment_attempt` | timestamptz | Next retry time | For failed payments |
| `description` | text | Invoice description | |
| `customer_name` / `customer_email` | text | Denormalized customer info | |
| `stripe_subscription_id` | text | Subscription ID if recurring | |
| `raw_event` | jsonb | Full Stripe webhook payload | |

**Key filters**:
```sql
-- Paid invoices only (revenue)
WHERE status = 'paid' AND member_id IS NOT NULL

-- Failed / outstanding
WHERE status IN ('open', 'uncollectible') AND attempt_count > 0

-- Specific period
WHERE payment_date >= '2025-01-01' AND payment_date < '2025-04-01'
```

---

### `stripe_transactions`
**Description**: Individual payment transaction events (charges/charge attempts).
**Primary Key**: `id` (uuid)

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Internal ID | |
| `stripe_payment_intent_id` | text | Payment intent ID | Prefix `pi_` |
| `stripe_charge_id` | text | Charge ID | Prefix `ch_` |
| `stripe_customer_id` | text | Customer ID | |
| `stripe_invoice_id` | text | Invoice ID | |
| `member_id` | uuid | FK → `member_database` | |
| `membership_id` | uuid | FK → `member_memberships` | |
| `amount` | numeric | Transaction amount (cents) | Divide by 100 for dollars |
| `currency` | text | Currency | |
| `status` | text | `succeeded`, `failed`, `pending` | |
| `payment_method_type` | text | e.g. `card`, `au_becs_debit` | |
| `failure_code` | text | Stripe failure code | For failed payments |
| `failure_message` | text | Failure explanation | |
| `stripe_created` | timestamptz | Stripe event timestamp | |

---

### `fin_pandl`
**Description**: P&L (Profit & Loss) financial data table.

---

### `fin_payroll_hrs`
**Description**: Payroll hours tracked per coach.

| Column | Type | Description |
|--------|------|-------------|
| `coach_id` | uuid | FK → `staff_database` |

---

## Sample Queries

### Monthly Revenue Summary
```sql
SELECT
    DATE_TRUNC('month', payment_date) AS month,
    COUNT(*) AS invoices_paid,
    SUM(amount_paid) / 100.0 AS revenue_aud,
    AVG(amount_paid) / 100.0 AS avg_invoice_aud
FROM stripe_invoices
WHERE status = 'paid'
  AND member_id IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
```

### Revenue by Gym (via member location)
```sql
SELECT
    md.gym_string,
    DATE_TRUNC('month', si.payment_date) AS month,
    SUM(si.amount_paid) / 100.0 AS revenue_aud
FROM stripe_invoices si
JOIN member_database md ON si.member_id = md.id
WHERE si.status = 'paid'
  AND md.test_account = FALSE
GROUP BY md.gym_string, DATE_TRUNC('month', si.payment_date)
ORDER BY month DESC, revenue_aud DESC;
```

### Failed / Outstanding Payments
```sql
SELECT
    si.customer_name,
    si.customer_email,
    si.amount_due / 100.0 AS amount_aud,
    si.attempt_count,
    si.next_payment_attempt,
    md.coach_name
FROM stripe_invoices si
LEFT JOIN member_database md ON si.member_id = md.id
WHERE si.status IN ('open', 'uncollectible')
  AND si.attempt_count > 0
ORDER BY si.amount_due DESC;
```

### Revenue per Coach (Membership Revenue)
```sql
SELECT
    sd.coach_name,
    COUNT(si.id) AS invoices,
    SUM(si.amount_paid) / 100.0 AS total_revenue_aud
FROM stripe_invoices si
JOIN member_memberships mm ON si.membership_id = mm.id
JOIN staff_database sd ON mm.coach_id = sd.id
WHERE si.status = 'paid'
  AND si.payment_date >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY sd.coach_name
ORDER BY total_revenue_aud DESC;
```

### Full Member Payment History
```sql
SELECT
    md.member_name,
    si.stripe_invoice_id,
    si.payment_date,
    si.amount_paid / 100.0 AS amount_aud,
    si.status,
    si.payment_method,
    si.last_4_digits
FROM stripe_invoices si
JOIN member_database md ON si.member_id = md.id
WHERE md.id = '<member_uuid>'
ORDER BY si.payment_date DESC;
```

---

## Common Gotchas

1. **Amounts are in cents**: ALWAYS divide by 100 for AUD dollar values.
   - Wrong: `SUM(amount_paid)` → shows cents, not dollars
   - Right: `SUM(amount_paid) / 100.0`

2. **Use `amount_paid` not `amount_due`**: `amount_due` is what was invoiced; `amount_paid` is what was collected. These differ for failed or partial payments.

3. **Orphaned Stripe records**: Some `stripe_invoices` rows have `member_id IS NULL` (records created before the FK was established). Filter `AND member_id IS NOT NULL` for member-level reporting.

4. **`status` vs `stripe_invoice_status_enum`**: The `status` column is text, not the enum type. Valid values: `paid`, `open`, `draft`, `void`, `uncollectible`, `failed`.

5. **Timestamps are UTC**: `payment_date` is stored in UTC. For AEST/AEDT reporting, use `AT TIME ZONE 'Australia/Sydney'`.
