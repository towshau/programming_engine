Use this skill when the user asks to update, edit, or modify the "client journey" or any of the client journey steps (e.g., "first session", "nutrition onboarding call", "renewal sit down", etc.).

### Context
The client journey is no longer managed via an Excalidraw diagram. It is now fully data-driven through Supabase tables:
1. `client_journey_templates` (holds the overall journeys: Sydney New Member, Melbourne Renewal, etc.)
2. `client_journey_steps` (holds the individual steps like title, actions JSONB, assigned_role, forms_links JSONB)
3. `client_journey_changelog` (tracks all edits/modifications made to the journey steps)

### Instructions for the Agent

When the user asks to update the client journey, you must follow these rules:

1. **Clarify if Ambiguous:** Always default to asking clarifying questions before modifying data if the user's instructions are not 100% clear. 
   - *Example:* If they say "update the first session assignee to Coach", ask them if they mean for ALL journeys (Sydney New Member, Melbourne New Member) or just a specific location/type.
   - *Example:* If they want to edit "actions", clarify exactly which bullet points should be added/removed, since it's stored as a JSONB array.

2. **Staff Roles (Extreme Detail):** When editing `assigned_role`, do not just drop in a raw role name or a typo. You must provide a comprehensive, human-readable description that specifies whether it's a primary role or a supplementary role. However, omit the phrase "in staff database" because it takes up too much room and is implied.
   - *Example:* Instead of just "sales_team", write `"Staff with the 'supplementary role' of sales_team"`.
   - *Example:* If multiple roles are given (e.g., "Coach, Advanced Coach, Gym Manager, Head of Exercise, and Senior Coach"), format it descriptively: `"Assigned to the roles of Coach, Advanced Coach, Gym Manager, Head of Exercise, and Senior Coach"`

3. **Update Tables via SQL:** Use the `user-supabase` MCP tool `execute_sql` to apply the changes directly to the `client_journey_steps` table. Always fetch the current row(s) first to verify the `id`, `journey_id`, and `old_value` before updating.

4. **Maintain Changelog:** Every time you update `client_journey_steps`, you MUST also insert a corresponding row into `client_journey_changelog`. 
   - Required changelog fields: `journey_id`, `step_id`, `change_type` (e.g., `'step_updated'`), `field_changed`, `old_value` (JSONB), `new_value` (JSONB), and `changed_by` (use `'Cursor AI'` or the user's name).
   - You can do this by executing a multi-statement SQL query or doing the UPDATE and INSERT in two sequential `execute_sql` calls.

### Example Flow

**User:** "Edit the client journey to modify the first session/physicals to be assigned to 'Coach, Advanced Coach, Gym Manager, Head of Exercise, and Senior Coach'."

**Agent:**
1. Identifies this impacts Step 3 ("First session / physicals").
2. Asks the user: "Should I apply this assignee change to the 'First session / physicals' step across all journeys (both Sydney and Melbourne)?"
3. Once confirmed, the agent runs a `SELECT` via `execute_sql` to get the `id`, `journey_id`, and current `assigned_role` for those steps.
4. The agent formulates an `UPDATE` query for `client_journey_steps` to set the new string, and an `INSERT` into `client_journey_changelog` to log the old vs. new values.
5. The agent executes the SQL and confirms success with the user.