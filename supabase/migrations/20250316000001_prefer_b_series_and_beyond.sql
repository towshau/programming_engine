-- Rule: prefer_b_series_and_beyond — place listed exercises in B series or later, never A.
-- Used for cable presses and reverse flies so they appear as PRIMARY (B) or ACCESSORY (C), not A.
INSERT INTO programming_rules (gym, name, category, rule_key, rule_value, priority, active, source)
VALUES (
  NULL,
  'Prefer B series and beyond',
  'composition',
  'prefer_b_series_and_beyond',
  '{"exercise_names": ["Press - Cable - Mid Pulley", "Reverse Fly"], "description": "These exercises are placed in B series or later (C, D), never A."}'::jsonb,
  55,
  true,
  'manual'
);

-- Downgrade cable mid-pulley press to B/C in library so eligibility keeps it out of A
UPDATE exercise_library
SET series_assignment = ARRAY['B', 'C']
WHERE exercise_name IN ('Press - Cable - Mid Pulley', 'Press - Cable - Mid Pulley - 2 Arm');
