BEGIN;

-- Rastreio de entrega da Meta por lembrete (sem quebrar fluxo antigo)
ALTER TABLE public.whatsapp_reminder_logs
  ADD COLUMN IF NOT EXISTS meta_message_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_status TEXT,
  ADD COLUMN IF NOT EXISTS meta_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_recipient_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_pricing_category TEXT;

CREATE INDEX IF NOT EXISTS whatsapp_reminder_logs_meta_message_id_idx
  ON public.whatsapp_reminder_logs (meta_message_id)
  WHERE meta_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_reminder_logs_meta_status_idx
  ON public.whatsapp_reminder_logs (meta_status)
  WHERE meta_status IS NOT NULL;

COMMIT;

