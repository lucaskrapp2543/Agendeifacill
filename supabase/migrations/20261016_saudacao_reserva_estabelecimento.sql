-- ============================================================================
-- Lembretes para Clientes → "Mandar também quando EU agendo o cliente (Reservar Cliente)".
-- ----------------------------------------------------------------------------
-- MOTIVO: desde 11/06/2026 a mensagem de saudação (confirmação com o resumo)
-- NÃO sai quando o próprio estabelecimento agenda pelo cliente. Algumas
-- barbearias querem que saia. Vira uma opção de cada barbearia.
--
-- O QUE FAZ: acrescenta 1 campo ligado/desligado nas configurações do WhatsApp,
-- DESLIGADO para todo mundo (nada muda até a barbearia marcar a caixinha).
--
-- RISCO: nenhum. Não mexe nos textos, nos lembretes, nas sessões do WhatsApp
-- nem em nenhuma configuração existente. O servidor funciona com ou sem este campo.
-- ============================================================================
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS greeting_internal_enabled boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
