-- =====================================================================
-- WHATSAPP: MENSAGEM DE APRESENTAÇÃO (resposta automática com o link de agendamento)
-- =====================================================================
--
-- O QUE FAZ
--   1. Duas colunas novas em whatsapp_automation_settings (configuração por dono):
--        presentation_enabled  -> interruptor (nasce LIGADO para todo mundo)
--        presentation_link     -> qual link vai na mensagem: 'completa' | 'af' | 'chat' (padrão 'chat')
--   2. Tabela whatsapp_presentation_log: marca "já apresentei para este número" por dono.
--      É ela que garante a trava de 12 horas (mesmo cliente não recebe a mesma
--      apresentação de novo antes de 12h). Só o servidor (service_role) escreve.
--
-- RISCO: baixo. Não mexe em sessão, token nem em nenhuma coluna existente.
--   Reversível:
--     ALTER TABLE public.whatsapp_automation_settings DROP COLUMN presentation_enabled, DROP COLUMN presentation_link;
--     DROP TABLE public.whatsapp_presentation_log;
-- =====================================================================

BEGIN;

ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS presentation_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS presentation_link text NOT NULL DEFAULT 'chat';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_automation_settings_presentation_link_check'
  ) THEN
    ALTER TABLE public.whatsapp_automation_settings
      ADD CONSTRAINT whatsapp_automation_settings_presentation_link_check
      CHECK (presentation_link IN ('completa', 'af', 'chat'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_presentation_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_presentation_log_sent_at
  ON public.whatsapp_presentation_log (sent_at DESC);

-- Só o servidor escreve/lê (service_role ignora RLS). Ninguém logado no site precisa disso.
ALTER TABLE public.whatsapp_presentation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_presentation_log FROM anon, authenticated;
GRANT ALL ON public.whatsapp_presentation_log TO service_role;

-- Conferência: as duas colunas com default e a tabela criada
SELECT
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_automation_settings' AND column_name = 'presentation_enabled') AS default_apresentacao,
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_automation_settings' AND column_name = 'presentation_link') AS default_link,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_presentation_log') AS tabela_log_criada;

COMMIT;
