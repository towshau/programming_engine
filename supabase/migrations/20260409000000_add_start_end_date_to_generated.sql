-- Migration to add start_date and end_date columns to programming_generated
-- This supports a continuous timeline of programs and chaining.

ALTER TABLE programming_generated
  ADD COLUMN start_date date,
  ADD COLUMN end_date   date;

CREATE INDEX idx_pg_member_start
  ON programming_generated (member_id, start_date DESC);
