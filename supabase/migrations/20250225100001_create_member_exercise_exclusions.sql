-- Member-level exercise exclusions: do not assign these exercises to this member.
-- See docs/engine-config.md and docs/data-model.md.
-- FK targets: point to your member table and exercise_library (or source) when table names are confirmed.

create table if not exists public.programming_exercise_exclusions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  exercise_id uuid not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, exercise_id)
);

comment on table public.programming_exercise_exclusions is 'Exercises to exclude per member (injury, preference, etc.); engine never assigns these.';

create index if not exists idx_programming_exercise_exclusions_member_active
  on public.programming_exercise_exclusions (member_id, active);
