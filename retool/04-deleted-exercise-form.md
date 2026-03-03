# Retool prompt: Exercise Removal Request Form

Paste this into Retool's AI app builder.

---

## Prompt

Build a Retool app page called "Exercise Removal Requests" with two sections: a submission form and a review queue. Coaches submit requests; senior coaches review and approve/reject.

### Data source

Supabase table `programming_removal_requests`:

- `id` (uuid, PK, auto-generated)
- `exercise_id` (uuid) — FK to exercise_library
- `reason` (text) — why this exercise should be removed
- `submitted_by` (uuid, nullable) — who submitted
- `status` (text) — pending, approved, rejected (default: pending)
- `reviewed_by` (uuid, nullable) — senior coach who reviewed
- `created_at` (timestamptz, auto)
- `updated_at` (timestamptz, auto)

Also read from `exercise_library` for the exercise dropdown:

- `exercise_id` (text/uuid)
- `exercise_name` (text)
- `tags` (text, nullable)

### Layout requirements

**Section 1: Submit a removal request**

1. **Exercise** (required): searchable dropdown querying `exercise_library` by exercise_name. Show exercise_name and tags.
2. **Reason** (required): text area. Placeholder: "Why should this exercise be removed? (injury risk, equipment issue, etc.)"
3. **Submitted by** (optional): dropdown of coaches or auto-filled from logged-in user
4. **Submit button:** Insert into `programming_removal_requests` with status = 'pending'
5. Success toast: "Removal request submitted for review"

**Section 2: Review queue (senior coach view)**

1. Table of all pending requests, showing: exercise_name (joined from exercise_library), reason, submitted_by, created_at
2. Two action buttons per row:
   - **Approve** — sets status = 'approved', reviewed_by = current user. Does NOT delete the exercise (that's a separate gated step).
   - **Reject** — sets status = 'rejected', reviewed_by = current user
3. Filter toggle: Pending / Approved / Rejected / All
4. Approved items show a note: "Approved — exercise will be deactivated in next admin run"

**Important:** This form does NOT delete exercises directly. It only creates a request. Actual deactivation is a separate admin step.

### Queries

```sql
-- Exercise dropdown
SELECT exercise_id, exercise_name, tags
FROM exercise_library
ORDER BY exercise_name;

-- Submit request
INSERT INTO programming_removal_requests (exercise_id, reason, submitted_by, status)
VALUES ({{ exercise_id }}, {{ reason }}, {{ submitted_by }}, 'pending');

-- Pending requests (review queue)
SELECT r.*, e.exercise_name, e.tags
FROM programming_removal_requests r
LEFT JOIN exercise_library e ON e.exercise_id::text = r.exercise_id::text
WHERE r.status = {{ status_filter }}
ORDER BY r.created_at DESC;

-- Approve
UPDATE programming_removal_requests
SET status = 'approved', reviewed_by = {{ reviewer_id }}, updated_at = now()
WHERE id = {{ request_id }};

-- Reject
UPDATE programming_removal_requests
SET status = 'rejected', reviewed_by = {{ reviewer_id }}, updated_at = now()
WHERE id = {{ request_id }};
```
