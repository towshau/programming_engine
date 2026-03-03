# Programming engine -- one-page plan and context

**Repo:** programming_engine. **Purpose:** (1) Sync exercise_library to Google Sheet (existing Node app). (2) AI programming engine: ingest past programs + apply rules + generate per-member programs -> write to Supabase.

---

## Data and integrations

- **Supabase (source):** member_tbresults, member_tbhealthmax, exercise_library (trigger-built), member table with current_status = 'active' for cohort.
- **Supabase (engine config):** All tables use `programming_` prefix; gym column uses enum `gym` (BLIGH, BRIDGE, COLLIN) where applicable.
- **Retool:** Admin form for deleted-exercise reports. View programs (staging + generated) with readable layout. Feedback form for coaches. Flagged-programs counter. PDF export on demand.
- **Output:** Normalised past programs -> programming_past_programs_staging. Generated programs -> programming_generated. Single source of truth; view/audit in Retool; optional PDF to Supabase Storage or shared drive.

---

## Tables (7 total, all created and applied)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| programming_progression_schemes | Rep-range progression by scheme (GPP / Hypertrophy / Strength) | gym, name, goal, scheme_type, from/to_rep_range, exercise_behavior, order, active. |
| programming_exercise_exclusions | Per-member exercise exclusions | member_id, exercise_id, reason, active. |
| programming_removal_requests | Queue for "deleted exercise" reports; senior coach review | exercise_id, reason, submitted_by, status, reviewed_by. |
| programming_rules | General engine rules (gym-scoped) | gym, category, rule_key, rule_value (jsonb), priority, active. **15 rules seeded.** |
| programming_past_programs_staging | Normalised past program per member per run | run_id, member_id, assigned_to, payload (jsonb). |
| programming_generated | Generated program per member per run | run_id, member_id, assigned_to, sessions_per_week, duration_weeks, phase_number, scheme_name, rep_range, changes_summary, rules_applied (jsonb), payload (jsonb). |
| programming_feedback | Coach feedback on generated programs | run_id, member_id, coach_id, feedback_type, details, exercise_id, resolved. |

---

## Progression schemes (seeded)

- **GPP (default):** 10-12 -> 8-10 -> 6-8 -> 4-6 -> cycle. exercise_behavior = same_exercises.
- **Hypertrophy:** Cycle in 6-12 range.
- **Strength:** 8-10 -> 6-8 -> 4-6 -> 3-5 -> cycle.
- **Engine logic:** Member has selected scheme. Load rows by name, order by order. Current rep range -> matching row -> next phase = to_rep_range. Last step cycles.

---

## Pipeline

1. **Ingest:** member_tbresults + exercise_library -> normalised past program per member (-> programming_past_programs_staging).
2. **Cohort:** Member table current_status = 'active' -> member IDs.
3. **Config:** Load programming_rules, programming_progression_schemes (by scheme name), programming_exercise_exclusions (by member). Never invent exercises.
4. **Generate:** Past program + rules + progression + exclusions -> canonical program JSON per member (LLM or deterministic).
5. **Write:** Persist to programming_generated (with duration_weeks, phase_number, scheme_name, rep_range, changes_summary, rules_applied).

---

## Self-improving features

- **Coach feedback:** programming_feedback table + Retool form. Coaches flag exercise_swap, pairing_issue, too_hard, too_easy, positive, other.
- **Auto-exclusion:** If exercise gets 3+ negative feedbacks for a member, auto-create row in programming_exercise_exclusions.
- **Rule hit tracking:** rules_applied jsonb on programming_generated; track which rules fire, correlate with feedback.
- **Changes summary:** Human-readable "what changed from last phase" on every generated program.
- **Flagged programs counter:** Retool badge/count of unresolved feedback per member or run.

---

## Tools and workflows (WAT)

- **Layout:** workflows/, tools/, requirements.txt at repo root.
- **Tools:** fetch, normalize, load_rules, generate (LLM), write. Utility: add_technical_debt.py.
- **Workflows:** Markdown SOPs in workflows/ (ingest -> apply rules -> generate -> write).

---

## Admin and operations

- **Deleted exercises:** Retool form -> programming_removal_requests (no delete). Senior coach reviews; gated step.
- **View programs:** Retool lists staging + generated; filter member, date, coach. Readable layout (not raw JSON).
- **Feedback form:** Next to program view; coaches submit in 30 seconds.
- **PDF export:** On-demand by run or per coach.

---

## Rules (15 seeded)

sources (only_exercise_library); composition (max_exercises_per_series, series_composition, avoid_exercises_when_possible); equipment (pairings_both_gyms, c_series_self_sufficient); session (home_workouts_weekends, set_structures, daily_programming_sets, warm_up_sets, additional_work_on_own); timing (session_timing, rest_times); volume (rehab_integration); progression (default_rep_progression).

---

## Open questions

- Sessions per week: member-level config?
- Deleted exercises: user feedback vs system?
- exercise_behavior values and semantics.
- Where does member goal / selected scheme live?

---

## Docs

build-plan.md, data-model.md, engine-config.md, MASTER-CHECKLIST.md, TECHNICAL-REVIEW.md, questions-to-answer-later.md, IMPROVEMENTS.md, ONE-PAGE-PLAN.md.
