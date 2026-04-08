-- Holiday / equipment filtering: canonical tags per exercise for n8n + form queries.
-- Backfill: python tools/backfill_exercise_equipment_tags.py

ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS equipment_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN exercise_library.equipment_tags IS
  'Canonical equipment keys for holiday program filtering (overlap query). See tools/backfill_exercise_equipment_tags.py and docs/data-model.md.';

CREATE INDEX IF NOT EXISTS idx_exercise_library_equipment_tags_gin
  ON exercise_library USING GIN (equipment_tags);
