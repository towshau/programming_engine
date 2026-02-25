-- Generated programs (output of engine). One row per (run_id, member_id) per generation run.
-- See docs/build-plan.md and docs/data-model.md.

create table if not exists public.programming_generated (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  member_id uuid not null,
  assigned_to uuid,
  sessions_per_week int not null check (sessions_per_week in (2, 3, 4)),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, member_id)
);

comment on table public.programming_generated is 'Generated program per member per run; view in Retool, PDF export on demand.';
comment on column public.programming_generated.run_id is 'Groups all members in this generation run; use for export/audit.';
comment on column public.programming_generated.assigned_to is 'Optional coach assignment for filter by coach / export for Coach X.';
comment on column public.programming_generated.payload is 'Canonical program JSON (shape TBD in Phase 2).';

create index if not exists idx_programming_generated_run_id
  on public.programming_generated (run_id);
create index if not exists idx_programming_generated_member_id
  on public.programming_generated (member_id);
create index if not exists idx_programming_generated_assigned_to
  on public.programming_generated (assigned_to) where assigned_to is not null;
create index if not exists idx_programming_generated_created_at
  on public.programming_generated (created_at);
