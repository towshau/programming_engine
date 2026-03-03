# Improvements log

Track improvements identified and their implementation status. Cross off when done.

---

## From technical review (25 Feb 2026)

### Coaching ease of viewing

- [ ] **1. Define canonical JSON shape for payload** — Even rough; unpack in Retool into readable program cards not raw JSON.
- [ ] **2. Add coach-friendly columns to programming_generated** — `phase_number`, `scheme_name`, `rep_range`, `duration_weeks` so coaches see context without opening the blob.
- [ ] **3. Add changes_summary** — Text field on programming_generated: "what changed from last phase" (e.g. rep range moved, exercises kept/changed).
- [ ] **4. Build Retool view** — Unpack payload into readable layout: Day 1 A-Series exercises, sets, reps, rest etc.

### Easy to add and give feedback

- [x] **5. Add programming_feedback table** — Coaches flag programs or leave feedback (exercise_swap, pairing_issue, too_hard, too_easy, positive). Retool form next to program view.
- [ ] **6. Auto-exclusion from repeated feedback** — If exercise gets 3+ negative feedbacks for a member, auto-create row in programming_exercise_exclusions.

### Self-improving engine

- [x] **7. Rule hit tracking** — `rules_applied` jsonb array on programming_generated; track which rules fire per program. Over time: dead rules, correlations with feedback.
- [ ] **8. Flagged programs counter** — Retool badge/count of unresolved feedback per member or run.
- [ ] **9. Version the LLM prompt** — Store prompt template in programming_rules or versioned file in workflows/. Prompt changes = rule changes; review before deploy.
- [ ] **10. Program comparison / diff view** — When generating, produce changes_summary so coaches see what changed without comparing two programs manually.

### Missing seeded rules

- [x] **11. Seed warm_up_sets rule** — Category session; sparing in B/C, advanced heavy only.
- [x] **12. Seed additional_work_on_own rule** — Category session; must label, simple, minimal setup.

### Housekeeping

- [x] **13. Update MASTER-CHECKLIST** — Mark applied tables as done (all 6 tables applied).
