-- General programming rules (gym-scoped, category, key/value). Engine loads active rows.
-- Uses existing enum "gym" for gym column. See docs/engine-config.md and docs/programming-rules-source.md.

create table if not exists public.programming_rules (
  id uuid primary key default gen_random_uuid(),
  gym public.gym,
  name text,
  category text,
  rule_key text not null,
  rule_value jsonb,
  priority int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_rules is 'Engine rules: load where gym = :gym or gym is null, active = true; higher priority overrides.';

create index if not exists idx_programming_rules_gym_active
  on public.programming_rules (gym, active);
create index if not exists idx_programming_rules_category
  on public.programming_rules (category) where category is not null;
