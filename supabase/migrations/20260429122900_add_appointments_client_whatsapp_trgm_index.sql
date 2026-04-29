-- Acelera buscas textuais por WhatsApp em appointments (ILIKE '%...%').
-- Nao altera dados nem regras de negocio.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_appointments_client_whatsapp_trgm
  ON public.appointments
  USING gin (client_whatsapp gin_trgm_ops);

COMMIT;

NOTIFY pgrst, 'reload schema';
