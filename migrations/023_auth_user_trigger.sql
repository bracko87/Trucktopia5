-- migrations/023_auth_user_trigger.sql
-- 
-- Create a SECURITY DEFINER trigger that ensures a public.users row is created or linked
-- whenever a new auth.users row is inserted. This version:
--  - Detects whether auth.users contains user_metadata or raw_user_meta_data
--  - Safely extracts a candidate name only when the metadata column exists (via dynamic SQL)
--  - Idempotently updates an existing users row matched by email (case-insensitive)
--  - Falls back to inserting a new public.users row with id = auth.uid()
--  - Uses exception handling to tolerate concurrent inserts/updates
BEGIN;

CREATE OR REPLACE FUNCTION auth.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
/**
 * Trigger function run AFTER INSERT on auth.users to ensure a linked public.users row exists.
 *
 * Behavior:
 * - If a public.users row already has auth_user_id = NEW.id -> do nothing.
 * - Else try to find a public.users row by email (case-insensitive) and PATCH auth_user_id.
 * - Else insert a new public.users row with id = NEW.id so public.users.id == auth.uid().
 * - Attempt to extract username/name from auth.users metadata only when the corresponding
 *   column exists to avoid compile-time errors on installations with different schemas.
 */
DECLARE
  v_uid uuid := NEW.id;
  v_email text := NEW.email;
  v_candidate_name text := NULL;
  has_user_metadata boolean := false;
  has_raw_meta boolean := false;
  dyn_sql text;
BEGIN
  -- If there's already a public.users row linked to this auth user, nothing to do.
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = v_uid LIMIT 1) THEN
    RETURN NULL;
  END IF;

  -- Detect which metadata column exists on auth.users
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'user_metadata'
  ) INTO has_user_metadata;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'raw_user_meta_data'
  ) INTO has_raw_meta;

  -- Safely extract a candidate name from the metadata column when present using dynamic SQL.
  IF has_user_metadata THEN
    dyn_sql := format(
      'SELECT COALESCE(user_metadata->>%L, user_metadata->>%L) FROM auth.users WHERE id = %L',
      'username', 'name', v_uid::text
    );
    BEGIN
      EXECUTE dyn_sql INTO v_candidate_name;
    EXCEPTION WHEN OTHERS THEN
      v_candidate_name := NULL;
    END;
  ELSIF has_raw_meta THEN
    dyn_sql := format(
      'SELECT COALESCE(raw_user_meta_data->>%L, raw_user_meta_data->>%L) FROM auth.users WHERE id = %L',
      'username', 'name', v_uid::text
    );
    BEGIN
      EXECUTE dyn_sql INTO v_candidate_name;
    EXCEPTION WHEN OTHERS THEN
      v_candidate_name := NULL;
    END;
  END IF;

  -- Try to find existing public.users by email (case-insensitive). If found, PATCH auth_user_id.
  IF EXISTS (SELECT 1 FROM public.users pu WHERE lower(pu.email) = lower(v_email) LIMIT 1) THEN
    BEGIN
      UPDATE public.users
      SET
        auth_user_id = v_uid,
        name = COALESCE(public.users.name, v_candidate_name)
      WHERE lower(email) = lower(v_email) AND auth_user_id IS NULL;
    EXCEPTION WHEN unique_violation THEN
      -- Concurrent update/insert happened; safe to ignore.
      NULL;
    WHEN OTHERS THEN
      -- Non-fatal: don't block user creation on unexpected errors.
      NULL;
    END;
    RETURN NULL;
  END IF;

  -- No existing user found: insert a new public.users row with id = auth uid so ids align.
  BEGIN
    INSERT INTO public.users (id, email, auth_user_id, name, created_at)
    VALUES (v_uid, v_email, v_uid, v_candidate_name, now());
  EXCEPTION WHEN unique_violation THEN
    -- If a concurrent insert created the row, ignore.
    NULL;
  WHEN OTHERS THEN
    -- Non-fatal fallback: ignore other insert errors to avoid blocking auth user creation.
    NULL;
  END;

  RETURN NULL;
END;
$func$;

-- Create or replace trigger to run the function after insert on auth.users
DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.handle_auth_user_created();

COMMIT;