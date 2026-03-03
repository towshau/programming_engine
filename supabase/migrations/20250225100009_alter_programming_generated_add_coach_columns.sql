-- Add coach-friendly columns and self-improving fields to programming_generated.
-- See docs/IMPROVEMENTS.md items 2, 3, 7.

alter table public.programming_generated
  add column if not exists duration_weeks int not null default 6,
  add column if not exists phase_number int,
  add column if not exists scheme_name text,
  add column if not exists rep_range text,
  add column if not exists changes_summary text,
  add column if not exists rules_applied jsonb;

comment on column public.programming_generated.duration_weeks is 'Program duration: first program = 4 weeks, standard = 6 weeks.';
comment on column public.programming_generated.phase_number is 'Phase within the scheme cycle (e.g. 1,2,3,4 for GPP).';
comment on column public.programming_generated.scheme_name is 'Denormalised: GPP, Hypertrophy, Strength etc.';
comment on column public.programming_generated.rep_range is 'Rep range this program uses (e.g. 10-12).';
comment on column public.programming_generated.changes_summary is 'Human-readable: what changed from last phase.';
comment on column public.programming_generated.rules_applied is 'Array of rule_keys applied during generation; for tracking and self-improvement.';
