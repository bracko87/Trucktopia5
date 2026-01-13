-- 074_create_invites.sql
--
-- Create invites table used by the serverless invite endpoint.
-- Stores a token so invite links can be validated and expired.
--
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inviter_user_id uuid NULL,
  email text NOT NULL,
  message text NULL,
  token text NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  expires_at timestamptz NULL,
  CONSTRAINT invites_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites USING btree (email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites USING btree (token);