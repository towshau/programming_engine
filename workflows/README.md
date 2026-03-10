# Programming engine -- chronological workflow

This folder documents the **order of operations** for the engine. The pipeline can be run end-to-end with `tools/run_pipeline.py` or step-by-step with individual scripts.

---

## Pipeline order

### 1. Ingest / Normalize
Read `member_tbresults` + `exercise_library` for a member → normalised past program (sessions by day, series labels A1/A2/B1/...) → write to `programming_normalized_programs`.

**Tool:** `python tools/normalize_one_member.py <member_id> [--scheme GPP|Strength|Hypertrophy]`

Phase detection runs automatically when `--scheme` is set: detects current rep range from A-series median reps, direction of travel, and confidence. Result stored in `payload.phase_detection`.

### 2. Load Config
Load `programming_rules` (15 rules), `programming_progression_schemes` (by member's scheme), and `programming_exercise_exclusions` (by member).

**Tool:** `python tools/load_rules.py --member-id <uuid> --scheme Strength`

Returns JSON with `rules`, `scheme`, and `exclusions` — consumed by the generator.

### 3. Generate
Past program + rules + progression + exclusions + exercise library → canonical program JSON. Deterministic: carries forward same exercises with updated rep ranges (exercise_behavior = same_exercises). A/B compounds at scheme range; C/D accessories at +2 reps. Applies: max 2 per series, C-series self-sufficient, excluded exercises filtered, avoid-list respected.

**Tool:** `python tools/generate_program.py <member_id> --scheme Strength --sessions-per-week 3`

**Cue (when to run):** Not yet automated. Options: manual for selected members; weekly cron (e.g. Monday); Retool "Generate" button; or trigger when current program period ends.

### 4. Write
Persist the generated program JSON to `programming_generated` with run_id, member_id, sessions_per_week, phase_number, scheme_name, rep_range, changes_summary, rules_applied.

**Tool:** `python tools/write_programs.py --run-id <uuid> --member-id <uuid> --sessions-per-week 3 program.json`

---

## End-to-end (single command)

**Tool:** `python tools/run_pipeline.py <member_id> --scheme Strength --sessions-per-week 3`

Runs all 4 steps. Writes to both staging and generated tables. Options:
- `--dry-run` — print program JSON without writing to Supabase.
- `--skip-staging` — don't write to `programming_normalized_programs`.
- `--output FILE` — save program JSON to a local file.
- `--duration-weeks 4|6` — program duration (default 6).

---

## Summary

| Step | Tool | Input | Output |
|------|------|-------|--------|
| Ingest | normalize_one_member.py | member_tbresults, exercise_library | programming_normalized_programs |
| Config | load_rules.py | programming_rules, schemes, exclusions | JSON config bundle |
| Generate | generate_program.py | past program, config, library, phase | canonical program JSON |
| Write | write_programs.py | program JSON | programming_generated |
| **All** | **run_pipeline.py** | member_id + scheme | staging + generated |

Canonical program payload shape: see `docs/data-model.md` § programming_generated.
