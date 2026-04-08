# Key Metrics & KPIs

## Member Metrics

### Total Active Members
```sql
SELECT COUNT(*) AS active_members
FROM member_database
WHERE current_status = 'active'
  AND test_account = FALSE;
-- Pre-built: view_active_members
```

### Active Members by Gym
```sql
SELECT gym_string, COUNT(*) AS count
FROM member_database
WHERE current_status = 'active' AND test_account = FALSE
GROUP BY gym_string;
```

### Active Members by Coach
```sql
-- Pre-built views: view_member_count_per_coach, active_members_by_coach
SELECT
    sd.coach_name,
    COUNT(md.id) AS member_count
FROM member_database md
JOIN staff_database sd ON md.coach_id = sd.id
WHERE md.current_status = 'active'
  AND md.test_account = FALSE
  AND sd.staff_status = 'active'
GROUP BY sd.coach_name
ORDER BY member_count DESC;
```

### Monthly Active Client Count (Historical Trend)
```sql
-- Pre-built: view_monthly_active_client_count
```

### Members on Hold (Current)
```sql
SELECT COUNT(DISTINCT mh.member_id) AS on_hold_count
FROM member_holds mh
JOIN member_database md ON mh.member_id = md.id
WHERE CURRENT_DATE BETWEEN mh.hold_start AND COALESCE(mh.hold_end, '9999-12-31')
  AND md.test_account = FALSE;
```

---

## Renewal Metrics

### Renewal Rate by Coach (Sprint)
```sql
-- Pre-built views:
-- view_sprint_one_renewal_count_total
-- view_sprint_2_renewal_count_total
-- view_sprint_3_renewal_count_total
-- view_sprint_4_renewal_count_total
-- view_coach_lifetime_renewals
```

### Renewal Pipeline Breakdown
```sql
SELECT
    mm.journey_stage,
    COUNT(*) AS count
FROM member_memberships mm
JOIN member_database md ON mm.member_id = md.id
WHERE mm.status = 'active'
  AND md.test_account = FALSE
GROUP BY mm.journey_stage
ORDER BY count DESC;
```

### Churn Classification
```sql
-- Good churn vs bad churn for expired/not-renewing members
SELECT
    mm.pipeline_lost,
    COUNT(*) AS count
FROM member_memberships mm
WHERE mm.pipeline_lost IS NOT NULL
GROUP BY mm.pipeline_lost;
-- Values: 'good_churn' | 'bad_churn'
```

---

## Financial Metrics

### Total Revenue Collected (Stripe)
> Amounts stored in CENTS — divide by 100 for AUD dollars

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

### Failed Payments
```sql
SELECT
    DATE_TRUNC('month', payment_date) AS month,
    COUNT(*) AS failed_count,
    SUM(amount_due) / 100.0 AS amount_at_risk_aud
FROM stripe_invoices
WHERE status IN ('open', 'uncollectible')
  AND attempt_count > 0
GROUP BY 1
ORDER BY 1 DESC;
```

### Revenue by Membership Type
```sql
SELECT
    mt.name AS membership_type,
    COUNT(si.id) AS invoice_count,
    SUM(si.amount_paid) / 100.0 AS total_revenue_aud
FROM stripe_invoices si
JOIN member_memberships mm ON si.membership_id = mm.id
JOIN membership_types mt ON mm.membership_type_id = mt.id
WHERE si.status = 'paid'
GROUP BY mt.name
ORDER BY total_revenue_aud DESC;
```

---

## Coach Performance Metrics

### Coach Session Load (Weekly)
```sql
-- Pre-built: view_staff_hours_weekly, view_coach_total_workload_weekly
SELECT
    sd.coach_name,
    COUNT(ssc.session_id) AS sessions_this_week
FROM schedule_session_coaches ssc
JOIN staff_database sd ON ssc.coach_id = sd.id
JOIN schedule_sessions ss ON ssc.session_id = ss.id
WHERE ss.week_start = DATE_TRUNC('week', CURRENT_DATE)
GROUP BY sd.coach_name
ORDER BY sessions_this_week DESC;
```

### Coach Google Reviews
```sql
-- Pre-built: view_coach_google_reviews, view_google_reviews_with_coach
SELECT
    sd.coach_name,
    COUNT(gr.id) AS review_count,
    AVG(gr.rating) AS avg_rating   -- verify column name
FROM google_reviews gr
JOIN member_database md ON gr.member_id = md.id
JOIN staff_database sd ON md.coach_id = sd.id
GROUP BY sd.coach_name
ORDER BY avg_rating DESC;
```

---

## Health & Physicals Metrics

### Members Due for Physicals Assessment
```sql
-- Pre-built: view_members_due_for_assessment
```

### Average VO2 by Gym
```sql
SELECT
    md.gym_string,
    AVG(mpr.vo2_value) AS avg_vo2,
    COUNT(*) AS assessments
FROM member_physicals_raw mpr
JOIN member_database md ON mpr.member_id = md.id
WHERE mpr.vo2_value IS NOT NULL
  AND md.test_account = FALSE
GROUP BY md.gym_string;
```

### Member Health Status Distribution
```sql
-- Health rating: green / yellow / red
SELECT
    mmh.health_status,   -- verify column name
    COUNT(*) AS count
FROM member_memberhealth mmh
JOIN member_database md ON mmh.member_id = md.id
WHERE md.current_status = 'active'
  AND md.test_account = FALSE
GROUP BY mmh.health_status;
-- Pre-built: v_clients_at_risk
```

---

## Scheduling Metrics

### Session Capacity Utilisation
```sql
-- Compare actual scheduled sessions vs capacity
SELECT
    ss.session_date,
    ss.session_time,
    ss.gym,
    COUNT(ssc.coach_id) AS coaches_assigned,
    sgc.max_capacity    -- from system_session_gym_capacity
FROM schedule_sessions ss
LEFT JOIN schedule_session_coaches ssc ON ss.id = ssc.session_id
LEFT JOIN system_session_gym_capacity sgc ON ss.session_type_id = sgc.session_type_id
WHERE ss.session_date >= CURRENT_DATE
GROUP BY ss.session_date, ss.session_time, ss.gym, sgc.max_capacity
ORDER BY ss.session_date, ss.session_time;
```

---

## Metric Quick Reference Table

| Metric | Source Table(s) | Pre-built View | Notes |
|--------|----------------|----------------|-------|
| Active member count | `member_database` | `view_active_members` | Filter `test_account = FALSE` |
| Members per coach | `member_database` | `view_member_count_per_coach` | |
| Monthly active count trend | `member_database` | `view_monthly_active_client_count` | |
| Current holds | `member_holds` | `view_test_indefinite_holds` | |
| Revenue collected | `stripe_invoices` | — | Divide by 100 for AUD |
| Renewal pipeline | `member_memberships` | `view_sprint_*_renewal_count_total` | |
| Coach renewals | `member_memberships` | `view_coach_lifetime_renewals` | |
| Coach session load | `schedule_session_coaches` | `view_staff_hours_weekly` | |
| Physicals completion | `member_physicals_raw` | `view_physicals_quarterly_summary` | |
| Members at risk | `member_memberhealth` | `v_clients_at_risk` | |
| New client NPS | `survey_newclient_nps` | — | |
