-- Track whether a programming note has been actioned in the Program Editor / queue.
ALTER TABLE member_programming_notes
  ADD COLUMN IF NOT EXISTS implemented boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN member_programming_notes.implemented IS 'When true, note is hidden from Program Updates queue; coaches mark implemented from the editor panel.';
