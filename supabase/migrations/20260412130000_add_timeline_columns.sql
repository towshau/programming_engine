-- Migration: Add timeline positioning columns to client_journey_steps

ALTER TABLE client_journey_steps
  ADD COLUMN IF NOT EXISTS days_from_start INT,
  ADD COLUMN IF NOT EXISTS days_from_expiry INT,
  ADD COLUMN IF NOT EXISTS min_membership_months INT;

-- Populate New Member journeys (Sydney = 00..01, Melbourne = 00..03)
-- Step 1: Point of Sale
UPDATE client_journey_steps SET days_from_start = 0, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 1;

-- Step 2: Admin team member setup
UPDATE client_journey_steps SET days_from_start = 3, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 2;

-- Step 3: Nutrition onboarding call
UPDATE client_journey_steps SET days_from_start = 14, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 3;

-- Step 4: First session / physicals
UPDATE client_journey_steps SET days_from_start = 3, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 4;

-- Step 5: 30-day review call
UPDATE client_journey_steps SET days_from_start = 30, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 5;

-- Step 6: 12-week check-in
UPDATE client_journey_steps SET days_from_start = 84, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 6;

-- Step 7: 6-week pre-renewal call
UPDATE client_journey_steps SET days_from_start = NULL, days_from_expiry = 42
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 7;

-- Step 8: Renewal sit down
UPDATE client_journey_steps SET days_from_start = NULL, days_from_expiry = 0
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 8;

-- Step 9: Renewed member
UPDATE client_journey_steps SET days_from_start = NULL, days_from_expiry = NULL
WHERE journey_id IN ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')
  AND step_number = 9;

-- Populate Renewal journeys (Sydney = 00..02, Melbourne = 00..04)
-- Step 1: 3-month check-in call (6mo+ memberships only)
UPDATE client_journey_steps SET days_from_start = 84, min_membership_months = 6
WHERE journey_id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004')
  AND step_number = 1;

-- Step 2: 9-month check-in call (12mo only)
UPDATE client_journey_steps SET days_from_expiry = 84, min_membership_months = 12
WHERE journey_id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004')
  AND step_number = 2;

-- Step 3: 6-week pre-renewal call
UPDATE client_journey_steps SET days_from_expiry = 42
WHERE journey_id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004')
  AND step_number = 3;

-- Step 4: Sit down renewal
UPDATE client_journey_steps SET days_from_expiry = 0
WHERE journey_id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004')
  AND step_number = 4;
