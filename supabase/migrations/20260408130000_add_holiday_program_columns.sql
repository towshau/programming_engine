-- Add holiday program support to programming_generated
-- Run this migration before deploying the frontend changes that filter on program_type.

ALTER TABLE programming_generated
  ADD COLUMN IF NOT EXISTS program_type text NOT NULL DEFAULT 'regular';

ALTER TABLE programming_generated
  ADD CONSTRAINT IF NOT EXISTS programming_generated_program_type_check
    CHECK (program_type IN ('regular', 'holiday'));

ALTER TABLE programming_generated
  ADD COLUMN IF NOT EXISTS holiday_start_date date;

ALTER TABLE programming_generated
  ADD COLUMN IF NOT EXISTS holiday_end_date date;

-- Index to speed up holiday program queries per member
CREATE INDEX IF NOT EXISTS idx_programming_generated_program_type
  ON programming_generated (member_id, program_type, created_at DESC);
