-- Progression schemes: rep-range progression config (e.g. 10-12 -> 8-10, same_exercises).
-- Uses existing enum "gym" for gym column. goal/scheme_type nullable for branching (e.g. strength/hypertrophy).
-- See docs/engine-config.md and docs/data-model.md.

create table if not exists public.programming_progression_schemes (
  id uuid primary key default gen_random_uuid(),
  gym public.gym,
  name text not null,
  goal text,
  scheme_type text,
  from_rep_range text not null,
  to_rep_range text not null,
  exercise_behavior text not null default 'same_exercises',
  "order" int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_progression_schemes is 'Config for rep-range progression; engine picks rows by gym/name/goal.';
comment on column public.programming_progression_schemes.exercise_behavior is 'e.g. same_exercises | allow_exercise_changes';
comment on column public.programming_progression_schemes.goal is 'Optional: e.g. default, strength, hypertrophy for branching.';
comment on column public.programming_progression_schemes.scheme_type is 'Optional: alternate identifier for scheme branch.';

create index if not exists idx_programming_progression_schemes_gym_active
  on public.programming_progression_schemes (gym, active);
create index if not exists idx_programming_progression_schemes_name_active
  on public.programming_progression_schemes (name, active);
create index if not exists idx_programming_progression_schemes_goal_active
  on public.programming_progression_schemes (goal, active) where goal is not null;
