-- migrations/072_create_thread_with_participants_rpc.sql
-- 
-- Create an RPC to atomically create a thread and its participants.
-- Uses public.users.id (game user id) for participants.
-- Returns the created thread id.
-- 
-- Note: The threads, thread_participants and messages tables should already exist.
-- Ensure you run this migration with a DB user that can create functions.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_thread_with_participants(
  p_subject text,
  p_participant_user_ids uuid[],
  p_creator_user_id uuid
) RETURNS TABLE(thread_id uuid) AS
$$
DECLARE
  v_thread_id uuid;
  v_uid uuid;
  v_arr uuid[];
BEGIN
  IF p_participant_user_ids IS NULL OR array_length(p_participant_user_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'participant list must not be empty';
  END IF;

  -- Ensure creator is included in participants
  IF NOT (p_creator_user_id = ANY (p_participant_user_ids)) THEN
    v_arr := array_append(p_participant_user_ids, p_creator_user_id);
  ELSE
    v_arr := p_participant_user_ids;
  END IF;

  -- Insert thread
  INSERT INTO public.threads(subject, created_at)
  VALUES (p_subject, now())
  RETURNING id INTO v_thread_id;

  -- Insert participants
  PERFORM
    (SELECT 1 FROM (
      SELECT unnest(v_arr) AS uid
    ) AS u
    );

  FOR v_uid IN SELECT unnest(v_arr) LOOP
    INSERT INTO public.thread_participants(thread_id, user_id, created_at, last_read_at)
    VALUES (v_thread_id, v_uid, now(), NULL);
  END LOOP;

  RETURN QUERY SELECT v_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;