-- Migration: create messaging tables (threads, thread_participants, messages)
-- Adds basic indexes and row-level security policies suitable for an authenticated inbox.

-- Table: threads
CREATE TABLE IF NOT EXISTS public.threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NULL,
  CONSTRAINT threads_pkey PRIMARY KEY (id)
);

-- Table: thread_participants
CREATE TABLE IF NOT EXISTS public.thread_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thread_participants_pkey PRIMARY KEY (id),
  CONSTRAINT thread_participants_thread_fk FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE,
  CONSTRAINT thread_participants_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT thread_participants_unique_pair UNIQUE (thread_id, user_id)
);

-- Table: messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_draft boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_thread_fk FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE,
  CONSTRAINT messages_sender_fk FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thread_participants_thread_user ON public.thread_participants (thread_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at ON public.messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_last_message_at ON public.threads (last_message_at);

-- Enable Row Level Security
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies: threads
-- SELECT: only participants may see a thread (checks users.auth_user_id -> auth.uid())
CREATE POLICY threads_select_participant ON public.threads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread_participants tp
      JOIN public.users u ON u.id = tp.user_id
      WHERE tp.thread_id = public.threads.id
        AND u.auth_user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user may create threads (validate in WITH CHECK)
CREATE POLICY threads_insert_auth ON public.threads
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- UPDATE: only participants may update
CREATE POLICY threads_update_participant ON public.threads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread_participants tp
      JOIN public.users u ON u.id = tp.user_id
      WHERE tp.thread_id = public.threads.id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread_participants tp
      JOIN public.users u ON u.id = tp.user_id
      WHERE tp.thread_id = public.threads.id
        AND u.auth_user_id = auth.uid()
    )
  );

-- DELETE: only participants may delete
CREATE POLICY threads_delete_participant ON public.threads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread_participants tp
      JOIN public.users u ON u.id = tp.user_id
      WHERE tp.thread_id = public.threads.id
        AND u.auth_user_id = auth.uid()
    )
  );

-- Policies: thread_participants
-- SELECT: users may only read participant rows that belong to them
CREATE POLICY thread_participants_select ON public.thread_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.thread_participants.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- INSERT: allow creating a participant record only for yourself (WITH CHECK)
CREATE POLICY thread_participants_insert_self ON public.thread_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.thread_participants.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- UPDATE: allow participant to update their own participant row (e.g. last_read_at)
CREATE POLICY thread_participants_update_self ON public.thread_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.thread_participants.user_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.thread_participants.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- DELETE: allow participant to remove themselves from a thread
CREATE POLICY thread_participants_delete_self ON public.thread_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.thread_participants.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- Policies: messages
-- SELECT: only participants of the thread may read messages
CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread_participants tp
      JOIN public.users u ON u.id = tp.user_id
      WHERE tp.thread_id = public.messages.thread_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- INSERT: sender_user_id must match authenticated user
CREATE POLICY messages_insert_sender_is_self ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.messages.sender_user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- UPDATE: allow sender to update their message (useful to edit drafts)
CREATE POLICY messages_update_sender_is_self ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.messages.sender_user_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.messages.sender_user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- DELETE: allow sender to delete their message
CREATE POLICY messages_delete_sender_is_self ON public.messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.messages.sender_user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- NOTE:
-- - INSERT policies must use WITH CHECK (not USING) to validate inserted rows.
-- - The examples above rely on public.users.auth_user_id linking to the auth uid.
-- - Review and tighten policies for any service/system roles you need to permit (admin, background jobs, server functions).
