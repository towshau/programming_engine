# Improvements log

Track improvements identified and their implementation status. Cross off when done.

**Priority (this doc):** **A** = ship first when touching the area. **C** = later / nice-to-have bucket (ordering polish, richer inputs, drag UX). **D** = exploratory / bigger UX; implement when there is time and a clear spec.

---

## Program Editor (coach UI)

### Priority A

- [ ] **14. Fuzzy exercise search (swap / add)** — In the exercise picker (`ExerciseSwapModal`, used for swap and add exercise), matching is effectively a single contiguous substring on name/tags. Change to **fuzzy / multi-token** behavior so coaches can type words in any order (e.g. `bench barbell` surfaces `Barbell Bench Press`). Consider simple token-and intersection scoring or a small fuzzy library; rank best matches to the top.

### Priority C

- [ ] **15. Series labels chronological within letter** — Revisit ordering/refactor for A1/A2 and B1/B2 (etc.) so series within each letter group is always **chronological** (e.g. B1 then B2 in display and logical order), even when edits or imports produce odd ordering.
- [ ] **16. Drag to reorder exercises** — Allow moving rows up/down within a session (same bucket as series ordering polish).
- [ ] **17. Seconds rest: allow dash ranges** — Today seconds mode accepts a single value (e.g. `30`); support a **range** like reps (e.g. `45-60` or `45-60s`) in `parseReps` / `validateRepsInput` / coach messaging in `frontend/src/lib/reps.ts`.

### Priority D

- [ ] **18. Weekly “matrix” view (toggle)** — Optional view mode (e.g. tab or toggle at the top of the program screen): Lay out **sessions as columns** — all Day 1 / Monday together, all Day 2 / Tuesday, etc. — so coaches scan the week **side by side**. Repeat the same layout for **last (current) program** and **next program** stacked (last block above, next below) for quick comparison. Implementation TBD (separate route vs. same page toggle; how day labels map when the program is day-numbered vs. calendar weekdays).

---

## From technical review (25 Feb 2026)

### Coaching ease of viewing

- [ ] **1. Define canonical JSON shape for payload** — Even rough; unpack in Retool into readable program cards not raw JSON.
- [ ] **2. Add coach-friendly columns to programming_generated** — `phase_number`, `scheme_name`, `rep_range`, `duration_weeks` so coaches see context without opening the blob.
- [ ] **3. Add changes_summary** — Text field on programming_generated: "what changed from last phase" (e.g. rep range moved, exercises kept/changed).
- [ ] **4. Build Retool view** — Unpack payload into readable layout: Day 1 A-Series exercises, sets, reps, rest etc.

### Easy to add and give feedback

- [x] **5. Add programming_feedback table** — Coaches flag programs or leave feedback (exercise_swap, pairing_issue, too_hard, too_easy, positive). Retool form next to program view.
- [ ] **6. Auto-exclusion from repeated feedback** — If exercise gets 3+ negative feedbacks for a member, auto-create row in programming_exercise_exclusions. **Tool:** `python tools/apply_auto_exclusions.py` (implemented; run after feedback is in, or on a schedule). See ONE-PAGE-PLAN § "How to make it self-improving".

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
