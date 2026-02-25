# Technical review – scalability and potential debt

Pre-build review of the current design: config scalability, rule-set expansion, and areas of potential future technical debt with proposed solutions.

**How to log new debt:** Run `python tools/add_technical_debt.py "Title" "Debt description." "Proposed solution."` from the repo root (or run without args for interactive prompts). The script appends a new numbered subsection (e.g. ### 2.10) to section 2 in this document.

---

## 1. Config tables – are they set up scalably?

**Yes.** The design is row-based and key/value where it needs to be:

| Table | Scalability | How to expand |
|-------|-------------|---------------|
| **programming_rules** | High | Add rows. `rule_key` + `rule_value` (jsonb) + `category` + `priority`. New rule types = new rows; new categories (e.g. "pairing", "timing", "volume") need no schema change. |
| **programming_progression_schemes** | High | Add rows per transition. Multiple schemes = multiple `name` values (or add nullable `goal`/`scheme_type` for branching). More rep-range steps or goals = more rows. |
| **programming_exercise_exclusions** | Per-member | One row per (member, exercise). Grows with members × excluded exercises. For rule-based exclusions later, add a separate table (e.g. `programming_exclusion_rules`) as already noted in docs. |

**Rule set expansion:** `programming_rules` has no practical limit on rows or categories. You can add many categories and `rule_key`s; `rule_value` jsonb holds arbitrary structure per rule. The engine only needs to load active rows and interpret known keys. Convention: document expected shapes per `rule_key` (e.g. in engine-config or a small rule catalogue) so new rules stay consistent.

---

## 2. Potential technical debt and solutions

### 2.1 Indexes missing

**Debt:** No indexes on the new tables. As data grows, filters (e.g. `WHERE gym = ? AND active = true`, `WHERE member_id = ? AND active = true`) will do full table scans.

**Solution:** Add indexes when you run the first migrations (or in a follow-up migration):

- **programming_progression_schemes:** `(gym, active)`, and optionally `(name, active)` or `(goal, active)` when you add `goal`.
- **programming_exercise_exclusions:** `(member_id, active)` so the engine can quickly load exclusions per member.
- **programming_rules:** `(gym, active)`, optionally `(category)` if you often filter by category.
- **programming_removal_requests:** `(status)` for the review queue; optionally `(exercise_id)` if you look up by exercise.

---

### 2.2 Foreign keys not yet defined

**Debt:** `programming_exercise_exclusions.member_id` and `exercise_id` are uuid without FKs. Same for `programming_removal_requests.exercise_id`. Risk: orphan rows if members or exercises are removed; no DB-level referential integrity.

**Solution:** Once the member table and exercise source (e.g. `exercise_library`) are confirmed, add FK constraints in a migration. If the source system soft-deletes, consider FK to a view or document that "exercise_id may reference a table that soft-deletes." Optional: use `ON DELETE SET NULL` or a dedicated "deleted" table for removal_requests so approved deletions don’t break the FK.

---

### 2.3 Progression branching column not in migration

**Debt:** Build plan recommends a `goal` or `scheme_type` on `programming_progression_schemes` for strength/hypertrophy branching. Current migration has no such column; adding it later means another migration and backfill.

**Solution:** Add a nullable column now (e.g. `goal text` or `scheme_type text`) in the first migration. No backfill needed; existing rows stay NULL and behave as "default." New schemes can set goal/scheme_type when you implement branching.

---

### 2.4 Staging table growth and lifecycle

**Debt:** `programming_past_programs_staging` will grow unbounded if every normalization run appends rows. Same idea for `programming_generated` if we never purge.

**Solution:** Decide and document up front:

- **Staging:** Either (a) upsert by run_id + member_id so each run overwrites that run’s data, or (b) append with `run_id` and add a retention policy (e.g. keep last N runs or last 30 days) and a small cleanup job.
- **programming_generated:** Keep all generated programs; add `run_id` or `generated_at` so you can query by run or time. If you ever need to purge, do it by run_id or date in a controlled way.

---

### 2.5 program output and staging schema – run and coach

**Debt:** When we create `programming_generated` and `programming_past_programs_staging`, we might forget fields that support "run" and "per-coach" use cases.

**Solution:** When defining the schema (Phase 2), include from the start:

- **run_id** (or batch_id) – groups all programs from one generation/run; needed for "export this run to PDF" and for staging overwrite/retention.
- **member_id** – who the program is for.
- **coach_id** or **assigned_to** (nullable) – for future "filter by coach" and "export for Coach X." Add as nullable so it’s optional until coach assignment exists in your model.

---

### 2.6 rule_value jsonb – no schema enforcement

**Debt:** Any structure can go in `rule_value`. New rule types might use inconsistent shapes; the engine has to tolerate unknown keys.

**Solution:** Keep flexibility; add lightweight governance: (a) document in engine-config or a rule catalogue the expected shape per `rule_key` (e.g. `max_exercises_per_series` → `{"value": 2}`), and (b) in tools that write rules, validate against that convention. Optional later: a small `programming_rule_types` table (rule_key, expected_schema or description) for validation or UI hints.

---

### 2.7 exercise_behavior: text vs jsonb

**Debt:** Migration uses `text` for `exercise_behavior` (e.g. "same_exercises", "allow_exercise_changes"). If we later need structured options (e.g. swap pools, conditions), we’d need a migration to jsonb and backfill.

**Solution:** Keep text for now; it matches current semantics. If you later need structured behavior, add a migration to change the column to jsonb and backfill from the existing enum-like values. Doc already says "text or jsonb" so the intent is clear.

---

### 2.8 Duplicate removal requests

**Debt:** `programming_removal_requests` has no unique constraint. Multiple "pending" rows for the same exercise could be created.

**Solution:** Either (a) allow duplicates and let the review process merge or close duplicates, or (b) add a unique partial index, e.g. `UNIQUE (exercise_id) WHERE status = 'pending'`, so only one pending request per exercise. Document the chosen behaviour in build-plan or data-model.

---

### 2.9 RLS (Row Level Security)

**Debt:** No RLS on the new tables. If Retool or other clients use a shared key and you need per-gym or per-role access, you’ll need RLS later.

**Solution:** Document that RLS is not yet applied; add when access control requirements are clear (e.g. gym-scoped or role-based). Optional: add RLS policies in the same migrations as the tables if you already know the policy (e.g. "service role bypass; anon read nothing").

---

## 3. Summary

- **Config and rules:** Set up scalably. Adding rules, progression schemes, and exclusions is row-based; `programming_rules` in particular can grow and diversify without schema change.
- **Rule set expansion:** Supported via new rows and flexible `rule_value` jsonb; document conventions per `rule_key` to keep behaviour predictable.
- **Recommended before or during first apply:** Add indexes (2.1), add nullable `goal`/`scheme_type` to progression_schemes (2.3), and document staging/output lifecycle and run/coach fields (2.4, 2.5). FKs (2.2), RLS (2.9), and removal-request uniqueness (2.8) can follow once table names and access model are fixed.
