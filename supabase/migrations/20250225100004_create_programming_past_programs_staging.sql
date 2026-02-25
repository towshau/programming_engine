-- Staging table for normalised past programs (output of normalization tool).
-- One row per (run_id, member_id); upsert by run so each run overwrites that run's data.
-- See docs/build-plan.md and docs/data-model.md.

create table if not exists public.programming_past_programs_staging (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  member_id uuid not null,
  assigned_to uuid,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, member_id)
);

comment on table public.programming_past_programs_staging is 'Normalised past program per member per run; view in Retool, optional PDF export.';
comment on column public.programming_past_programs_staging.run_id is 'Groups all members in this normalization run; use for export/retention.';
comment on column public.programming_past_programs_staging.assigned_to is 'Optional coach/member assignment for filter by coach.';
comment on column public.programming_past_programs_staging.payload is 'Normalised structure: sessions, exercises, rep ranges.';

create index if not exists idx_programming_past_programs_staging_run_id
  on public.programming_past_programs_staging (run_id);
create index if not exists idx_programming_past_programs_staging_member_id
  on public.programming_past_programs_staging (member_id);
create index if not exists idx_programming_past_programs_staging_assigned_to
  on public.programming_past_programs_staging (assigned_to) where assigned_to is not null;
