-- Add scheme_name to member_programs for per-member progression scheme.
-- Default GPP; coaches update via Retool. Batch runner reads this to decide
-- which scheme to use when generating the next program.

ALTER TABLE member_programs
  ADD COLUMN IF NOT EXISTS scheme_name text DEFAULT 'GPP';

COMMENT ON COLUMN member_programs.scheme_name
  IS 'Progression scheme for this member: GPP, Strength, Hypertrophy. Default GPP.';
