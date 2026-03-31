-- Drop the existing constraint
-- Since it wasn't explicitly named in the original migration, we need to find its auto-generated name or use a DO block to safely drop it.

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the constraint name for sessions_per_week in programming_generated
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'programming_generated'::regclass
    AND consrc LIKE '%sessions_per_week%';

  -- If found, drop it
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE programming_generated DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Add the new constraint allowing 1 to 6 sessions per week
ALTER TABLE programming_generated
ADD CONSTRAINT programming_generated_sessions_per_week_check
CHECK (sessions_per_week BETWEEN 1 AND 6);
