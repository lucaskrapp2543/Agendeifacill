-- ============================================================================
-- Lembretes para Clientes → "Mensagem de aniversário" (automática).
-- Agendei Fácil, 25/11/2026. Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem problema.
-- ----------------------------------------------------------------------------
-- MOTIVO: pedido da Barbearia Reference (8916, 25/11/2026). O barbeiro quer que
-- o sistema mande sozinho uma mensagem de parabéns no WhatsApp do cliente no
-- dia do aniversário, com um texto que ele possa editar.
--
-- O QUE FAZ:
--   1) Acrescenta 2 campos nas configurações de WhatsApp de cada barbearia:
--        birthday_enabled  → ligado/desligado (DESLIGADO para todo mundo)
--        birthday_template → a mensagem, com {{cliente_nome}} obrigatório
--   2) Cria uma trava na tabela de registro de mensagens: o mesmo cliente da
--      mesma barbearia só pode ter UMA mensagem de aniversário por ano.
--      (A trava só olha registros do tipo "birthday_ANO". Hoje não existe
--      nenhum, então não toca em nada do que já está gravado.)
--
-- NÃO APAGA NEM ALTERA NENHUM DADO. Não mexe em lembrete, saudação, retorno,
-- apresentação, sessões de WhatsApp nem em nenhuma configuração existente.
--
-- RISCO: nenhum. Nada muda até a barbearia ligar a opção em "Lembretes para
-- Clientes". O servidor funciona com ou sem estes campos (tem fallback).
--
-- De onde vêm os aniversários: das datas que a barbearia já cadastrou
-- (client_birthdays, em "Meus Clientes", e manual_clients.birthday). Sem tabela nova.
-- ============================================================================
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS birthday_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS birthday_template text NOT NULL DEFAULT
    'Parabéns, {{cliente_nome}}! 🎉' || E'\n' ||
    'Hoje é o seu dia! Nós da {{barbearia_nome}} desejamos muita saúde e felicidade. 🥳' || E'\n\n' ||
    'Quando quiser dar um trato no visual, é só agendar aqui: {{link_agendamento}}';

-- Trava: uma mensagem de aniversário por cliente, por barbearia, por ano.
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_message_logs_birthday
  ON public.whatsapp_message_logs (establishment_id, recipient_phone, message_type)
  WHERE appointment_id IS NULL AND left(message_type, 9) = 'birthday_';

NOTIFY pgrst, 'reload schema';

-- Conferência (opcional, só leitura): deve mostrar os 2 campos novos.
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'whatsapp_automation_settings'
--   AND column_name LIKE 'birthday%';
