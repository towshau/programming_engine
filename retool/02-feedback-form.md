# Retool prompt: Coach Feedback Form

Paste this into Retool's AI app builder.

---

## Prompt

Build a Retool app page (or modal/drawer on the Program Viewer page) called "Coach Feedback" that lets coaches flag issues with a generated program in under 30 seconds.

### Data source

Inserts into Supabase table `programming_feedback`:

- `id` (uuid, PK, auto-generated)
- `run_id` (uuid, nullable) — which generation run
- `member_id` (uuid) — which member's program
- `coach_id` (uuid, nullable) — who gave feedback
- `feedback_type` (text) — one of: exercise_swap, pairing_issue, too_hard, too_easy, positive, other
- `details` (text, nullable) — free text
- `exercise_id` (uuid, nullable) — if about a specific exercise
- `resolved` (boolean, default false)
- `created_at` (timestamptz, auto)

### Layout requirements

1. **Trigger:** Button on each program card in the Program Viewer that opens this form as a slide-out drawer or modal. Pre-fill run_id and member_id from the selected program.

2. **Form fields:**
   - **Feedback type** (required): radio buttons or segmented control with these options:
     - Exercise Swap — "Wrong exercise for this member"
     - Pairing Issue — "These exercises don't pair well"
     - Too Hard — "Load/reps too aggressive"
     - Too Easy — "Needs more challenge"
     - Positive — "This program is good"
     - Other
   - **Exercise** (optional): dropdown of exercises from the selected program's payload (exercise_name values). Maps to exercise_id on submit.
   - **Details** (optional): text area, 2-3 lines, placeholder "Any extra context..."
   - **Coach** (optional): dropdown of coaches or auto-filled from logged-in user if available

3. **Submit:**
   - Insert row into `programming_feedback`
   - Show success toast: "Feedback submitted"
   - Close the drawer/modal
   - Refresh the flagged counter if visible

4. **Styling:**
   - Compact — should take 15-30 seconds to fill out
   - Feedback type buttons should be large and tappable
   - Green accent for Positive, red for Too Hard, orange for Pairing Issue, blue for Exercise Swap

### Insert query

```sql
INSERT INTO programming_feedback (run_id, member_id, coach_id, feedback_type, details, exercise_id)
VALUES ({{ run_id }}, {{ member_id }}, {{ coach_id }}, {{ feedback_type }}, {{ details }}, {{ exercise_id }});
```
