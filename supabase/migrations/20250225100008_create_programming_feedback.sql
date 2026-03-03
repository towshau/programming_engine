-- Coach feedback on generated programs. Retool form inserts here.
-- See docs/IMPROVEMENTS.md item 5.

create table if not exists public.programming_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  member_id uuid not null,
  coach_id uuid,
  feedback_type text not null check (feedback_type in ('exercise_swap', 'pairing_issue', 'too_hard', 'too_easy', 'positive', 'other')),
  details text,
  exercise_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_feedback is 'Coach feedback on generated programs; feeds back into exclusions and rule tuning.';

create index if not exists idx_programming_feedback_member_id
  on public.programming_feedback (member_id);
create index if not exists idx_programming_feedback_run_id
  on public.programming_feedback (run_id) where run_id is not null;
create index if not exists idx_programming_feedback_resolved
  on public.programming_feedback (resolved) where resolved = false;
create index if not exists idx_programming_feedback_exercise_id
  on public.programming_feedback (exercise_id) where exercise_id is not null;
