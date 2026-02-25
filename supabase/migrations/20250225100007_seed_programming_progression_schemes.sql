-- Seed progression schemes: GPP (default), Hypertrophy, Strength.
-- Each scheme is a set of rows with the same name, ordered 1,2,3,4. Engine loads by scheme name, orders by "order", and uses from_rep_range -> to_rep_range for the next phase. After the last step, cycle to the first step's to_rep_range (e.g. 4-6 -> 10-12 for GPP).
-- gym NULL = all gyms.

insert into public.programming_progression_schemes (gym, name, goal, scheme_type, from_rep_range, to_rep_range, exercise_behavior, "order", active)
values
  -- GPP: standard 10-12 -> 8-10 -> 6-8 -> 4-6, then cycle back to 10-12
  (null, 'GPP', 'default', 'gpp', '10-12', '8-10', 'same_exercises', 1, true),
  (null, 'GPP', 'default', 'gpp', '8-10', '6-8', 'same_exercises', 2, true),
  (null, 'GPP', 'default', 'gpp', '6-8', '4-6', 'same_exercises', 3, true),
  (null, 'GPP', 'default', 'gpp', '4-6', '10-12', 'same_exercises', 4, true),
  -- Hypertrophy: emphasis on moderate/higher rep ranges; cycle within 8-12
  (null, 'Hypertrophy', 'hypertrophy', 'hypertrophy', '10-12', '8-10', 'same_exercises', 1, true),
  (null, 'Hypertrophy', 'hypertrophy', 'hypertrophy', '8-10', '6-8', 'same_exercises', 2, true),
  (null, 'Hypertrophy', 'hypertrophy', 'hypertrophy', '6-8', '8-10', 'same_exercises', 3, true),
  (null, 'Hypertrophy', 'hypertrophy', 'hypertrophy', '8-10', '10-12', 'same_exercises', 4, true),
  -- Strength: emphasis on lower rep ranges; 8-10 -> 6-8 -> 4-6 -> 3-5, then cycle
  (null, 'Strength', 'strength', 'strength', '8-10', '6-8', 'same_exercises', 1, true),
  (null, 'Strength', 'strength', 'strength', '6-8', '4-6', 'same_exercises', 2, true),
  (null, 'Strength', 'strength', 'strength', '4-6', '3-5', 'same_exercises', 3, true),
  (null, 'Strength', 'strength', 'strength', '3-5', '8-10', 'same_exercises', 4, true);
