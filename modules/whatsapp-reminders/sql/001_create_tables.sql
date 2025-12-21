-- Módulo isolado: WhatsApp Reminders (WaSenderAPI)
-- 001 - Criar novas tabelas (NÃO altera tabelas existentes)
-- Observação: ajuste o schema/permissions conforme seu padrão de projeto.

BEGIN;

-- Enum de status (isolado)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_instance_status') THEN
    CREATE TYPE public.whatsapp_instance_status AS ENUM ('pending', 'connected', 'active', 'error');
  END IF;
END$$;

-- 1) Instância por estabelecimento
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'wasender',
  phone_number TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  status public.whatsapp_instance_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_instances_establishment_id_idx
  ON public.whatsapp_instances (establishment_id);

-- 2) Configurações por estabelecimento (1 row por establishment)
CREATE TABLE IF NOT EXISTS public.whatsapp_reminder_settings (
  establishment_id UUID PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  remind_before_minutes INT NOT NULL DEFAULT 60,
  message_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Logs de envio (anti-duplicidade via appointment_id)
CREATE TABLE IF NOT EXISTS public.whatsapp_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  phone_to TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_reminder_logs_establishment_id_idx
  ON public.whatsapp_reminder_logs (establishment_id);

CREATE INDEX IF NOT EXISTS whatsapp_reminder_logs_created_at_idx
  ON public.whatsapp_reminder_logs (created_at DESC);

COMMIT;


