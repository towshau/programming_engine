-- Add FK from programming_generated.member_id -> member_database.id
-- This enables PostgREST to resolve the member_database relationship
-- so the Active Programs tab can join member data correctly.

ALTER TABLE public.programming_generated
  ADD CONSTRAINT fk_programming_generated_member
  FOREIGN KEY (member_id) REFERENCES public.member_database(id);
