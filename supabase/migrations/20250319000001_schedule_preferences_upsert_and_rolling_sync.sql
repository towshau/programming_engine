-- schedule_preferences: allow newer submissions to override same (staff_id, period_id, block)
-- 1) RPC to upsert a single preference row (Retool can call this instead of raw INSERT)
-- 2) AFTER UPDATE trigger so overrides are reflected in rolling_schedule_preferences

-- Single-row upsert (use from Retool RPC or from SQL with multiple VALUES for batch)
CREATE OR REPLACE FUNCTION public.schedule_preferences_upsert(
  p_staff_id uuid,
  p_period_id uuid,
  p_block public.schedule_block_enum,
  p_preference_type public.schedule_preference_type,
  p_rank integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO schedule_preferences (staff_id, period_id, block, preference_type, rank)
  VALUES (p_staff_id, p_period_id, p_block, p_preference_type, p_rank)
  ON CONFLICT (staff_id, period_id, block)
  DO UPDATE SET
    preference_type = EXCLUDED.preference_type,
    rank = EXCLUDED.rank,
    submitted_at = now(),
    updated_at = now();

  SELECT id INTO v_id
  FROM schedule_preferences
  WHERE staff_id = p_staff_id AND period_id = p_period_id AND block = p_block;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.schedule_preferences_upsert(uuid, uuid, public.schedule_block_enum, public.schedule_preference_type, integer) IS
  'Insert or update one schedule preference. Newer submission overrides existing (staff_id, period_id, block). Use from Retool instead of INSERT to avoid unique violation.';

-- Batch upsert: pass array of { staff_id, period_id, block, preference_type, rank, submitted_at } (e.g. from Retool transformer)
CREATE OR REPLACE FUNCTION public.schedule_preferences_upsert_batch(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_staff_id uuid;
  v_period_id uuid;
  v_block text;
  v_preference_type text;
  v_rank integer;
  v_submitted_at timestamptz;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_staff_id        := (r->>'staff_id')::uuid;
    v_period_id       := (r->>'period_id')::uuid;
    v_block           := r->>'block';
    v_preference_type := r->>'preference_type';
    v_rank            := (r->>'rank')::integer;
    v_submitted_at    := COALESCE((r->>'submitted_at')::timestamptz, now());

    INSERT INTO schedule_preferences (staff_id, period_id, block, preference_type, rank, submitted_at)
    VALUES (v_staff_id, v_period_id, v_block::schedule_block_enum, v_preference_type::schedule_preference_type, v_rank, v_submitted_at)
    ON CONFLICT (staff_id, period_id, block)
    DO UPDATE SET
      preference_type = EXCLUDED.preference_type,
      rank            = EXCLUDED.rank,
      submitted_at    = EXCLUDED.submitted_at,
      updated_at      = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rows_processed', jsonb_array_length(p_rows));
END;
$$;

COMMENT ON FUNCTION public.schedule_preferences_upsert_batch(jsonb) IS
  'Upsert multiple schedule preferences. Pass array of { staff_id, period_id, block, preference_type, rank?, submitted_at? }. Newer rows override existing (staff_id, period_id, block).';

-- When a schedule_preference row is updated (e.g. via upsert override), sync to rolling
CREATE OR REPLACE FUNCTION public.trg_sync_schedule_preferences_to_rolling_on_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE rolling_schedule_preferences
  SET
    preference_type = NEW.preference_type::text,
    coach_name      = NEW.coach_name,
    updated_at      = now()
  WHERE staff_id   = NEW.staff_id
    AND period_id  = NEW.period_id
    AND block      = NEW.block::text;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_schedule_preferences_to_rolling_on_update
  AFTER UPDATE ON schedule_preferences
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_schedule_preferences_to_rolling_on_update();
