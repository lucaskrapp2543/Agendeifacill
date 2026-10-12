-- ============================================================================
-- "Não mostrar número dos clientes para profissionais" (Configurações →
-- Preferências e Aplicações → Privacidade).
-- ----------------------------------------------------------------------------
-- MOTIVO: o dono quer que os profissionais não vejam (nem copiem) o WhatsApp dos
-- clientes em "Meus agendamentos". Não existia lugar para guardar essa escolha.
--
-- O QUE FAZ: só cria UMA coluna nova, desligada para todo mundo.
--   · Ninguém muda de comportamento até o dono marcar a caixinha.
--   · O número continua salvo normalmente (lembretes e confirmações do WhatsApp,
--     financeiro e "Meus Clientes" não mudam) — só a tela da agenda esconde.
--
-- RISCO: nenhum para os dados existentes (ADD COLUMN com padrão false, sem
-- mexer em policy, trigger ou outra coluna).
-- ============================================================================
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS hide_client_phone_for_professionals boolean NOT NULL DEFAULT false;

-- Conferência (rodar depois): deve mostrar a coluna com padrão false
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'establishments'
--   AND column_name = 'hide_client_phone_for_professionals';
