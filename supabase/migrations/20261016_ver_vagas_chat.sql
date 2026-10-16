-- ============================================================================
-- Agendamento por chat → botão "👀 Ver vagas" (opcional por estabelecimento).
-- ----------------------------------------------------------------------------
-- MOTIVO: pedido da Dom Mark (7266). O cliente vê os horários livres de hoje e
-- amanhã logo no menu do chat, toca no horário e depois escolhe serviço e
-- profissional.
--
-- O QUE FAZ: 1 campo ligado/desligado no estabelecimento, DESLIGADO para todos.
-- Liga em Configurações → "💬 Agendamento por chat" → "Mostrar botão Ver vagas".
--
-- RISCO: nenhum. Não mexe em agendamentos, horários, pagamentos nem em nenhuma
-- configuração existente. A função pública do estabelecimento (get_establishment_public)
-- já devolve todas as colunas não secretas, então o chat enxerga o campo sozinho.
-- ============================================================================
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS booking_chat_show_slots boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
