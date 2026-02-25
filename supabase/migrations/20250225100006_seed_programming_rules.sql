-- Seed programming_rules from docs (programming-rules-source.md, engine-config).
-- gym NULL = all gyms. Engine loads where gym = :gym OR gym IS NULL and active = true.

insert into public.programming_rules (gym, name, category, rule_key, rule_value, priority, active)
values
  (null, 'Exercise source', 'sources', 'only_exercise_library', '{"description": "Never invent exercises; only use the exercise library. No new exercises without approval."}', 0, true),
  (null, 'Max exercises per series', 'composition', 'max_exercises_per_series', '{"value": 2, "description": "Only two exercises can be paired inside any series."}', 0, true),
  (null, 'Pairings both gyms', 'equipment', 'pairings_both_gyms', '{"description": "Pairings must work at both Bridge and Bligh Street without equipment conflict. Avoid barbell squat + leg curl; flat press + leg curl at opposite ends; barbell squat + barbell/DB press in one spot."}', 0, true),
  (null, 'C-series self-sufficient', 'equipment', 'c_series_self_sufficient', '{"description": "C-Series must be self-sufficient; minimum equipment. Good: arm work, core. Avoid: hip thrusts, leg press, exercises requiring a bench or machine needed for next class."}', 0, true),
  (null, 'Home workouts weekends', 'session', 'home_workouts_weekends', '{"description": "Home workouts must be loaded on weekends. Exception: if client prefers exact day, label clearly so coaches do not coach it."}', 0, true),
  (null, 'Avoid exercises when possible', 'composition', 'avoid_exercises_when_possible', '{"exercises": ["walking lunges", "farmer carries"], "description": "Leave out when possible."}', 0, true),
  (null, 'Session timing', 'timing', 'session_timing', '{"total_minutes": 40, "work_minutes_max": 35, "splits": ["15 min A, 10 min B, 10 min C", "20 min A, 15 min B"], "description": "Every session 40 minutes including warm-up; programs should not exceed 35 minutes work time."}', 0, true),
  (null, 'Set structures', 'session', 'set_structures', '{"standard": {"a": 3, "b": 3, "c": 2}, "quicker": {"a": 4, "b": 2, "c": 2}, "b_max": 3, "description": "Standard: 3-set A, 3-set B, 2-set C. Quicker: 4-2-2. B capped at 3 sets max."}', 0, true),
  (null, 'Series composition', 'composition', 'series_composition', '{"no_single_double_same_body": true, "single_limb_upper_with_double_lower_ok": true, "max_one_single_limb_series_per_day": true, "description": "No single-limb upper with double-limb upper (same for lower); only one single-limb series per day."}', 0, true),
  (null, 'Rest times', 'timing', 'rest_times', '{"under_6_reps_sec": 120, "7_to_12_reps_sec": 90, "12_plus_reps_sec": 75, "range_sec": [60, 120], "description": "Under 6 reps: 120s; 7-12: 90s; 12+: 75s. Coaches discretion 60-120s where appropriate."}', 0, true),
  (null, 'Daily programming sets', 'session', 'daily_programming_sets', '{"bilateral": "3-3-2 or 4-2-2", "single_limb_cap": "3-2-2", "description": "If fully bilateral, some clients 3-3-2 or 4-2-2; if single-limb work, cap at 3-2-2 for A, B, C."}', 0, true),
  (null, 'Rehab integration', 'volume', 'rehab_integration', '{"counts_toward_volume": true, "description": "Rehab work counts toward total set volume; factor into workload."}', 0, true),
  (null, 'Default rep progression', 'progression', 'default_rep_progression', '{"ranges": ["10-12", "8-10", "6-8", "4-6"], "description": "Default Locker Room progression: 10-12 to 8-10 to 6-8 to 4-6. May change for goals, injuries, strength phases."}', 0, true);
