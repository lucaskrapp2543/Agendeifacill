BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone TEXT NULL,
  session_path TEXT NOT NULL,
  connected_at TIMESTAMPTZ NULL,
  last_seen TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status
  ON public.whatsapp_sessions (status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_last_seen
  ON public.whatsapp_sessions (last_seen DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  establishment_id UUID NULL REFERENCES public.establishments(id) ON DELETE SET NULL,
  sender_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'manual',
  provider TEXT NOT NULL DEFAULT 'baileys',
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_message_logs_appointment_type_provider
  ON public.whatsapp_message_logs (appointment_id, message_type, provider)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_created_at
  ON public.whatsapp_message_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_sender
  ON public.whatsapp_message_logs (sender_user_id, created_at DESC);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_sessions_select_own" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_select_own"
  ON public.whatsapp_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_sessions_insert_own" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_insert_own"
  ON public.whatsapp_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_sessions_update_own" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_update_own"
  ON public.whatsapp_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_sessions_delete_own" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_delete_own"
  ON public.whatsapp_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_message_logs_select_owner" ON public.whatsapp_message_logs;
CREATE POLICY "whatsapp_message_logs_select_owner"
  ON public.whatsapp_message_logs
  FOR SELECT
  USING (
    sender_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = whatsapp_message_logs.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "whatsapp_message_logs_insert_sender" ON public.whatsapp_message_logs;
CREATE POLICY "whatsapp_message_logs_insert_sender"
  ON public.whatsapp_message_logs
  FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    OR sender_user_id IS NULL
  );

COMMIT;
