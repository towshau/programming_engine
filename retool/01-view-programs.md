# Retool prompt: Program Viewer

Paste this into Retool's AI app builder (or use it as a spec to build manually).

---

## Prompt

Build a Retool app page called "Program Viewer" that connects to Supabase and displays generated gym programs in a readable card layout.

### Data source

Connect to the Supabase `programming_generated` table. Here are the columns:

- `id` (uuid, PK)
- `run_id` (uuid) — groups all members in one generation run
- `member_id` (uuid)
- `assigned_to` (uuid, nullable) — coach assignment
- `sessions_per_week` (int: 2, 3, or 4)
- `duration_weeks` (int, default 6)
- `phase_number` (int, nullable) — e.g. 1-4
- `scheme_name` (text, nullable) — GPP, Strength, Hypertrophy
- `rep_range` (text, nullable) — e.g. "8-10"
- `changes_summary` (text, nullable) — human-readable what changed
- `rules_applied` (jsonb, nullable) — array of rule keys
- `payload` (jsonb) — the full program; structure below
- `created_at` (timestamptz)

Also connect to `programming_normalized_programs` (same shape but simpler: run_id, member_id, assigned_to, payload, created_at) for viewing past normalised programs.

### Payload structure (programming_generated.payload)

```json
{
  "sessions": [
    {
      "day": 1,
      "exercises": [
        {
          "exercise_name": "Squat - Back - Barbell - High Bar",
          "exercise_id": "...",
          "series_label": "A1",
          "tags": "Lower Body Push",
          "sets": [
            { "set_number": 1, "reps": "8-10" },
            { "set_number": 2, "reps": "8-10" },
            { "set_number": 3, "reps": "8-10" }
          ]
        }
      ]
    }
  ],
  "metadata": {
    "scheme": "Strength",
    "next_rep_range": "3-5",
    "confidence": "medium",
    "sessions_per_week": 3
  }
}
```

### Layout requirements

1. **Top bar filters:**
   - Dropdown: select member (query distinct member_ids, ideally join to a member/staff table for names)
   - Dropdown: filter by scheme_name (GPP, Strength, Hypertrophy, or All)
   - Date range picker: filter by created_at
   - Toggle: "Generated" vs "Staging" (switches between programming_generated and programming_normalized_programs)

2. **Program list (left panel or top section):**
   - Table or list of programs matching filters, showing: member name/id, scheme_name, rep_range, phase_number, duration_weeks, sessions_per_week, created_at, changes_summary
   - Click a row to view the full program in the detail panel

3. **Program detail (main panel) — card layout:**
   - Header: member name, scheme, rep range, phase, duration, confidence badge (green=high, yellow=medium, red=low)
   - For each session (day): a card with the day number as header
   - Inside each day card: a table or list of exercises showing:
     - Series label (A1, A2, B1, etc.) — bold, colour-coded by series letter (A=blue, B=green, C=orange, D=grey)
     - Exercise name
     - Number of sets × rep range (e.g. "3 × 8-10")
   - Changes summary as a callout/banner at the top if present
   - Rules applied as small tags/chips at the bottom

4. **Styling:**
   - Clean, modern, card-based
   - Series labels colour-coded
   - Confidence badge: high=green, medium=amber, low=red
   - Mobile-friendly if possible

### Queries to create

```sql
-- Generated programs (main query)
SELECT g.*, s.first_name, s.last_name
FROM programming_generated g
LEFT JOIN staff_database s ON s.id::text = g.member_id::text
ORDER BY g.created_at DESC
LIMIT 50;

-- Staging programs (toggle)
SELECT p.*, s.first_name, s.last_name
FROM programming_normalized_programs p
LEFT JOIN staff_database s ON s.id::text = p.member_id::text
ORDER BY p.created_at DESC
LIMIT 50;
```

Note: adjust the JOIN to match your actual member/staff table. The member_id in programming_generated comes from member_tbresults which uses the TeamBuildr member_id format.
