-- Create RPC: create_thread_with_participant_email
-- This function looks up a user in public.users by email (server-side),
-- then calls create_thread_with_participants RPC to create the thread.
-- SECURITY DEFINER so it can bypass RLS for the lookup. Grants EXECUTE to public.
--
-- Usage: POST /rpc/create_thread_with_participant_email
-- Body: { "p_subject": "...", "p_email": "user@example.com", "p_creator_user_id": "uuid" }

CREATE OR REPLACE FUNCTION public.create_thread_with_participant_email(
  p_subject text,
  p_email text,
  p_creator_user_id uuid
)
RETURNS SETOF threads
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  participant_id uuid;
  result RECORD;
BEGIN
  -- Find user by email in public.users. SECURITY DEFINER owner must be a privileged role.
  SELECT id INTO participant_id FROM public.users WHERE email = p_email LIMIT 1;

  IF participant_id IS NULL THEN
    -- Raise a clear error so frontend can show "User not found"
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Delegate to existing RPC create_thread_with_participants which should
  -- return the created thread row(s). If that RPC differs in name or signature,
  -- adapt this call accordingly.
  RETURN QUERY
    SELECT * FROM public.create_thread_with_participants(p_subject, ARRAY[participant_id]::uuid[], p_creator_user_id);
END;
$$;

-- Allow the anonymous/web client (public role) to call the RPC
GRANT EXECUTE ON FUNCTION public.create_thread_with_participant_email(text, text, uuid) TO public;
