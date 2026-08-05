-- ============================================================================
-- SAÚDE DO MERCADO PAGO — o painel não pode mais "mentir" que está conectado
-- ----------------------------------------------------------------------------
-- Problema real: a plaquinha has_mercadopago só diz "existe um token salvo".
-- Quando o Mercado Pago invalida a credencial (senha trocada, app revogado,
-- refresh_token queimado), o token velho fica no banco e o painel segue verde,
-- enquanto todo pagamento do cliente final falha ("Reconecte a conta...").
--
-- Este arquivo cria APENAS 3 colunas de status (nenhum token é tocado):
--   mercadopago_health       -> 'ok' | 'reconnect_required' | NULL (nunca avaliado)
--   mercadopago_health_error -> último erro permanente do OAuth (texto p/ diagnóstico)
--   mercadopago_health_at    -> quando o status foi gravado
--
-- Quem escreve: só o servidor (service_role), nos fluxos de pagamento, quando o
-- refresh falha com erro PERMANENTE (invalid_grant) — e limpa ao reconectar.
-- Quem lê: painéis do dono e do admin (authenticated; o grant de tabela já
-- cobre colunas novas). Para o anon as colunas nascem OCULTAS por padrão
-- (whitelist da FASE 3 parte B) — visitante do booking não vê nada disso.
--
-- Compatibilidade: todas as linhas existentes ficam NULL = comportamento de
-- hoje (nenhum alerta). Aditivo e reversível com DROP COLUMN (rollback abaixo).
-- ============================================================================

BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS mercadopago_health text,
  ADD COLUMN IF NOT EXISTS mercadopago_health_error text,
  ADD COLUMN IF NOT EXISTS mercadopago_health_at timestamptz;

COMMIT;

-- Faz o PostgREST (a API) enxergar as colunas novas na hora.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (se algo quebrar, cole e rode ISTO pra voltar ao de antes):
--
-- ALTER TABLE public.establishments
--   DROP COLUMN IF EXISTS mercadopago_health,
--   DROP COLUMN IF EXISTS mercadopago_health_error,
--   DROP COLUMN IF EXISTS mercadopago_health_at;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================
