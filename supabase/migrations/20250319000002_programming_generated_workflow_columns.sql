-- Workflow columns for coach-to-admin handoff on programming_generated.
-- Coach: Save (coach_edited), Finalize (coach_approved + next_due_date). Admin: Uploaded (uploaded_to_teambuildr).

ALTER TABLE public.programming_generated
  ADD COLUMN IF NOT EXISTS coach_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coach_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uploaded_to_teambuildr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_due_date date;

COMMENT ON COLUMN public.programming_generated.coach_edited IS 'Coach has modified the generated program in the Program Editor (set on Save).';
COMMENT ON COLUMN public.programming_generated.coach_approved IS 'Coach has finalized the program; ready for admin upload (set on Finalize).';
COMMENT ON COLUMN public.programming_generated.uploaded_to_teambuildr IS 'Admin has loaded this program into TeamBuildr (tick box).';
COMMENT ON COLUMN public.programming_generated.next_due_date IS 'When the next program starts: member_programs.due_date + duration_weeks, snapped to next Monday.';
