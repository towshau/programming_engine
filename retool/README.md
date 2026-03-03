# Retool resources

Prompts and specs for building Retool pages. Each file contains a prompt you can paste into Retool's AI app builder to generate the page, plus the Supabase table/query context it needs.

**Supabase connection:** All pages connect to the same Supabase project (use your existing Retool Supabase resource).

## Pages

| File | Retool page | Purpose |
|------|------------|---------|
| `01-view-programs.md` | Program Viewer | View generated and staging programs per member; readable card layout |
| `02-feedback-form.md` | Coach Feedback | Quick feedback form next to program view; flags programs in 30 seconds |
| `03-flagged-counter.md` | Flagged Programs | Dashboard badge/counter of unresolved feedback by member or run |
| `04-deleted-exercise-form.md` | Exercise Removal Request | Form to request exercise deletion; senior coach reviews in queue |
| `05-pdf-export.md` | PDF Export | On-demand PDF export of a program run or per-coach subset |

Build order: start with **01** (view programs) since the feedback form (02) sits next to it.
