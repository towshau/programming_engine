# Programming engine – planning and design

## Current state (from codebase)

- **Data**: Supabase holds `member_tbhealthmax` and `member_tbresults`; a trigger builds `exercise_library` (exercise_id, exercise_name, tags). The repo only references these tables; full schema lives in Supabase.
- **Repo**: This repo has two parts: (1) **exercise-library-sheet-sync** (Node app in `exercise-library-sheet-sync/` that syncs `exercise_library` to a Google Sheet). (2) **Programming engine** (planned): WAT-based pipeline to generate per-member programs from past programs + rules. No rules system or program entity in code yet.

The engine will use **member_tb results** (row-based exercise data for all gym members) as “past programs” plus **rules** (Supabase `programming_rules` table) to generate new programs per member.

---

## WAT integration (Workflows, Agents, Tools)

The programming engine follows the **WAT framework**: AI orchestrates, deterministic tools execute.

| WAT layer     | Role in programming engine |
| ------------- | --------------------------- |
| **Workflows** | Markdown SOPs in `workflows/` (e.g. ingest, apply rules, generate, write). Define inputs, tools, outputs, edge cases. |
| **Agent**     | Reads workflow(s), runs tools in order, handles failures. Does not implement API/DB directly—invokes tools. |
| **Tools**     | Python scripts in `tools/`: fetch Supabase, normalize data, load rules, call LLM, write programs. Credentials in `.env`. |

**Directory layout:** `workflows/`, `tools/`, `requirements.txt` at repo root. Deliverables → Supabase. Sync app stays in `exercise-library-sheet-sync/`.

---

## 1. Data and schema clarity

- **member_tbresults** / **member_tbhealthmax**: document columns, grain, how “past programs” are identified.
- **Members**: which table has `current_status`; how to get member IDs for `member_tbresults` / program tables.
- Document in `docs/data-model.md` (and optionally `docs/schema.md`).

### Sessions per week (program days) — start basic

**Principle:** “Same as last time.” Next phase = same number of sessions per week (2D, 3D, 4D) as the previous program. No member-level master config for now.

**Implementation:** Program table (e.g. `member_programs`) stores `sessions_per_week` (or `program_days`: 2, 3, 4). Ingest reads last program per member and passes that into the generator. First program: fallback TBD (default or manual).

### Identifying which programs to create

**Scope:** Only active members.

**Source:** **Member database** (Supabase table with member status). Filter `current_status = 'active'`. That list = cohort for the run.

**Implementation:** Ingest (or a tool) queries member table for `current_status = 'active'`, gets member IDs; use when fetching past programs and writing new ones. Confirm table name, “active” value, and join path in schema docs.

---

## 2. Rules system

**Decided:** Rules live in **Supabase** in a **`programming_rules`** table.

**Suggested columns:** `id`, `gym` (nullable; NULL = all gyms), `name`, `category`, `rule_key`, `rule_value` (jsonb), `priority`, `active`, `created_at`, `updated_at`, `source` (nullable text; who/what created the rule, e.g. `'manual'`, `'seed'`, or later `'agent:slack_feedback'`), `source_ref` (nullable text; link to original input, e.g. Slack message URL or coach note ID). Engine loads rows where `gym = :gym OR gym IS NULL` and `active = true`; higher `priority` overrides. Narrative source: `docs/programming-rules-source.md`.

---

## 3. Output format

**Decided:** **Supabase.** Generated programs go to new Supabase table(s) (e.g. `member_programs` or `generated_programs` with `sessions_per_week` per program). Define canonical JSON shape for “one program” then implement writer in `tools/write_programs.py`.

---

## 4. High-level pipeline

- **Ingest** (tool): member_tbresults + exercise_library → normalized “past program” per member.
- **Apply rules** (tool): Load from `programming_rules`; evaluate against member + past program.
- **Generate** (tool): LLM input = past program summary + rules + exercise_library; output = one program per member (canonical JSON).
- **Write** (tool): Persist to Supabase.

---

## 5. Skills and Cursor rules

- Cursor rule: programming engine purpose, rules location (`programming_rules` + `docs/programming-rules-source.md`), canonical program shape, output (Supabase).
- Optional skill: how to run/extend the engine (data sources, pipeline steps).

---

## 6. Phased implementation

1. Adopt WAT layout: `workflows/`, `tools/`, `requirements.txt`; one workflow after approval.
2. Schema and data model in `docs/data-model.md`.
3. Canonical program JSON shape and rules format (Supabase table already decided).
4. Tools: fetch, normalize, load_rules, write (no LLM yet).
5. Engine pipeline (no LLM): fetch → normalize → load_rules → write fixture.
6. LLM tool: `generate_program_llm.py`.
7. Output writer: Supabase in `tools/write_programs.py`.
8. Skills and docs; keep workflows current.

---

## 7. Resolved decisions

- **Output:** Supabase.
- **Rules:** Supabase (`programming_rules` with `gym` column).
- **Sessions per week:** Same as last time (from program table); first program fallback TBD.
- **Cohort:** Active members only (`current_status = 'active'` in member database).

Next: Phase 1 (schema + data model) and Phase 2 (canonical program shape), then implement.
