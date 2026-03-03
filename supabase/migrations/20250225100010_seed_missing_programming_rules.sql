-- Seed missing rules: warm_up_sets and additional_work_on_own.
-- See docs/IMPROVEMENTS.md items 11, 12.

insert into public.programming_rules (gym, name, category, rule_key, rule_value, priority, active)
values
  (null, 'Warm-up sets', 'session', 'warm_up_sets', '{"b_and_c": "sparing", "advanced_heavy_only": true, "description": "Warm-up sets sparing in B and C-series; only add for advanced clients with heavy lifts."}', 0, true),
  (null, 'Additional work on own', 'session', 'additional_work_on_own', '{"must_label": true, "simple": true, "minimal_setup": true, "description": "Extra client work must be clearly labelled in the title; should be simple, minimal setup, and easy for clients to do unsupervised."}', 0, true);
