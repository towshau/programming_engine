# Questions to answer later

Track open design/implementation questions here. Cross off when answered (change `[ ]` to `[x]` and add a short answer or link to where it was decided).

---

- [ ] **Sessions per week formula** — Currently “same as last time” (next program = same 2D/3D/4D as previous). Will there be optionality to base this on a member-level unified config instead of (or in addition to) last program?

- [ ] **Deleted exercises** — How do deleted exercises get factored in? If we delete an exercise from the software (exercise library), how do we recognise it no longer exists? Do we get feedback coming back from users, or is it purely system-driven (e.g. sync/API shows it removed)?

- [ ] **Exact exercise_behavior values and semantics** — Define allowed values and meaning for `programming_progression_schemes.exercise_behavior` (e.g. same_exercises vs allow_exercise_changes). See [engine-config.md](engine-config.md).

- [ ] **Where does member goal live?** — For progression branching (strength vs hypertrophy etc.), where is the member’s goal or preferred scheme stored? See [build-plan.md](build-plan.md) (Progression model – branching by goal).
