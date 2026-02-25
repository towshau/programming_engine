-- Queue for "deleted exercise" reports: admin form (Retool) inserts here; senior coach reviews.
-- No direct delete from exercise library on submit. See docs/build-plan.md.

create table if not exists public.programming_removal_requests (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid,
  exercise_external_ref text,
  reason text,
  submitted_by text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_removal_requests is 'Admin reports exercise no longer exists; senior coach approves/rejects before any delete.';

create index if not exists idx_programming_removal_requests_status
  on public.programming_removal_requests (status);
create index if not exists idx_programming_removal_requests_exercise_id
  on public.programming_removal_requests (exercise_id) where exercise_id is not null;
