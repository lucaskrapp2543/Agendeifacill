-- ============================================================================
-- Lembretes para Clientes → "Lembrete de retorno" (cliente sumido).
-- ----------------------------------------------------------------------------
-- MOTIVO: pedido do Black Gold Barber (1637, 22/10/2026). O barbeiro quer que o
-- sistema mande sozinho uma mensagem pro cliente que fez o último atendimento
-- há X dias e não voltou ("e aí, bora cortar o cabelo?").
--
-- O QUE FAZ: acrescenta 3 campos nas configurações do WhatsApp de cada barbearia:
--   return_reminder_enabled  → ligado/desligado (DESLIGADO para todo mundo)
--   return_reminder_days     → 15, 20 ou 30 dias depois do último atendimento
--   return_reminder_template → a mensagem, com {{cliente_nome}} obrigatório
--
-- RISCO: nenhum. Nada muda até a barbearia ligar a opção. Não mexe em lembretes,
-- saudação, apresentação, sessões nem em nenhuma configuração existente.
-- O servidor funciona com ou sem estes campos (tem fallback).
--
-- Controle de envio: usa a tabela whatsapp_message_logs que já existe
-- (message_type = 'return_reminder', um por agendamento), então cada cliente
-- recebe no máximo UMA mensagem por "último atendimento". Sem tabela nova.
-- ============================================================================
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS return_reminder_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS return_reminder_days integer NOT NULL DEFAULT 20;

ALTER TABLE public.whatsapp_automation_settings
  DROP CONSTRAINT IF EXISTS whatsapp_automation_settings_return_reminder_days_check;

ALTER TABLE public.whatsapp_automation_settings
  ADD CONSTRAINT whatsapp_automation_settings_return_reminder_days_check
  CHECK (return_reminder_days IN (15, 20, 30));

ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS return_reminder_template text NOT NULL DEFAULT
    'Opa, {{cliente_nome}}! 👋' || E'\n' ||
    'Já faz {{dias_sem_vir}} dias desde seu último corte na {{barbearia_nome}}. Bora dar um trato no visual? 💈' || E'\n\n' ||
    'É só agendar aqui: {{link_agendamento}}';

NOTIFY pgrst, 'reload schema';
