-- Exercise priority: compounds fill A slots first; accessories fill C/D.
-- Lower body superset pairing: push/pull pairs on leg days (push-led or pull-led).
INSERT INTO programming_rules (gym, name, category, rule_key, rule_value, priority, active, source)
VALUES
  (NULL, 'Exercise priority by tag', 'composition', 'exercise_priority', '{
    "priority_order": [
      {"tier": 1, "tags": ["Lower Body Push", "Lower Body Pull"], "prefer_series": "A"},
      {"tier": 1, "tags": ["Horizontal Press", "Vertical Press", "Horizontal Pull", "Vertical Pull"], "prefer_series": "A"},
      {"tier": 2, "tags": ["Hip Dominant", "Dip"], "prefer_series": "B"},
      {"tier": 2, "tags": ["Lateral & Front Raise", "Hip Abduction"], "prefer_series": "B"},
      {"tier": 3, "tags": ["Elbow Flexion", "Elbow Extension", "Core Stability", "Spinal Flexion", "Lower Leg", "Hip Flexion"], "prefer_series": "C"}
    ],
    "description": "Compound movements fill A slots first; mid-tier fills B; accessories fill C/D."
  }'::jsonb, 50, true, 'manual'),
  (NULL, 'Lower body superset pairing', 'exercise_pairing', 'superset_lower_body_pairing', '{
    "push_tags": ["Lower Body Push"],
    "pull_tags": ["Lower Body Pull", "Hip Dominant"],
    "accessory_tags": ["Hip Abduction", "Lower Leg", "Hip Flexion"],
    "push_first": true,
    "description": "On lower body days, pair push + pull in A/B supersets. Push-led: A1=Push A2=Pull, B1=Push B2=Accessory. Pull-led: A1=Pull A2=Pull, B1=Push B2=Accessory."
  }'::jsonb, 50, true, 'manual');
