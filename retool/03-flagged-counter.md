# Retool prompt: Flagged Programs Counter

Paste this into Retool's AI app builder (or add as a component to the Program Viewer page).

---

## Prompt

Add a "Flagged Programs" dashboard widget that shows a count of unresolved feedback items, grouped by member and optionally by run. This can be a standalone page or a panel/badge on the Program Viewer.

### Data source

Query Supabase table `programming_feedback` where `resolved = false`.

### Layout requirements

1. **Summary badge (top of Program Viewer):**
   - Large number showing total unresolved feedback count
   - Red badge if > 0, grey if 0
   - Text: "X flagged programs"

2. **Breakdown table:**
   - Columns: member name/id, feedback_type, count of unresolved items, most recent feedback date
   - Group by member_id, then by feedback_type
   - Click a row to filter the Program Viewer to that member
   - Sort by count descending (most flagged first)

3. **Quick actions:**
   - "Mark resolved" button on each row — updates `resolved = true` for that feedback item
   - Bulk "Resolve all for member" button

4. **Styling:**
   - Red/orange colour scheme for unresolved items
   - Green check for resolved
   - Compact table, sortable columns

### Queries

```sql
-- Total unresolved count (for badge)
SELECT COUNT(*) AS unresolved_count
FROM programming_feedback
WHERE resolved = false;

-- Breakdown by member and type
SELECT
  f.member_id,
  f.feedback_type,
  COUNT(*) AS count,
  MAX(f.created_at) AS latest_feedback
FROM programming_feedback f
WHERE f.resolved = false
GROUP BY f.member_id, f.feedback_type
ORDER BY count DESC;

-- Mark one resolved
UPDATE programming_feedback
SET resolved = true, updated_at = now()
WHERE id = {{ selected_feedback_id }};

-- Bulk resolve for member
UPDATE programming_feedback
SET resolved = true, updated_at = now()
WHERE member_id = {{ selected_member_id }} AND resolved = false;
```
