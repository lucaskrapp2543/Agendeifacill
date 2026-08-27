-- =====================================================================
-- Vínculo da recorrência do Mercado Pago em coluna PRÓPRIA
-- =====================================================================
--
-- PROBLEMA QUE ISSO RESOLVE
--
-- Hoje a coluna `subscription_payment_order_id` guarda DUAS coisas diferentes:
--   * o id da recorrência (preapproval), quando o cliente ativou renovação automática
--   * o id do pagamento, quando o cliente pagou avulso (PIX ou cartão)
--
-- Quem paga avulso é localizado PELO TELEFONE e tem a linha atualizada por
-- inteiro. Resultado: um pagamento avulso apaga por cima o vínculo da
-- recorrência de quem já tinha renovação automática ativa.
--
-- Depois disso o Mercado Pago continua cobrando o cartão do cliente todo mês,
-- mas o sistema perde o rastro: não renova sozinho, o assinante fica preso na
-- lista de "ativação pendente" e o barbeiro precisa colocar em dia na mão.
-- Pior: como ele aparece como pendente, o barbeiro tende a mandar OUTRO link
-- de ativação — e o cliente pode acabar com duas recorrências cobrando.
--
-- Caso real: Antonio Azevedo (est. d6a6148c-d0f9-482a-ac73-42084930482f).
-- Recorrência cobrada em 23/08/2026; em 26/08 a linha dele foi sobrescrita e
-- ficou com subscription_payment_order_id = 165517898784 (id de pagamento).
--
-- O QUE ESTA MIGRATION FAZ
--
-- 1. Cria a coluna `recurring_preapproval_id`, que guarda SÓ o vínculo da
--    recorrência. Nenhum fluxo de pagamento avulso escreve nela.
-- 2. Copia para a coluna nova o vínculo das linhas que hoje ainda o têm
--    intacto (as que estão marcadas como recorrência).
--
-- IMPACTO / RISCO
--
-- Puramente ADITIVO: nenhuma coluna é removida ou renomeada, nenhum dado
-- existente é apagado, nenhuma policy é alterada. Código antigo continua
-- funcionando sem enxergar a coluna nova. Não desconecta nenhuma conta
-- Mercado Pago, não mexe em token, webhook nem em pagamento.
--
-- ORDEM: rodar ESTE SQL ANTES do deploy do código.
-- =====================================================================

alter table public.client_subscriptions
  add column if not exists recurring_preapproval_id text;

comment on column public.client_subscriptions.recurring_preapproval_id is
  'ID do preapproval (recorrência) no Mercado Pago. Escrito apenas pelo fluxo de recorrência. Nunca sobrescrever em pagamento avulso.';

-- Busca do assinante pelo id da recorrência quando o webhook chega.
create index if not exists idx_client_subscriptions_recurring_preapproval_id
  on public.client_subscriptions (recurring_preapproval_id)
  where recurring_preapproval_id is not null;

-- ---------------------------------------------------------------------
-- Backfill: nas linhas ainda marcadas como recorrência, o
-- subscription_payment_order_id É o preapproval id. Salva ele no lugar certo.
--
-- O filtro `!~ '^[0-9]+$'` é proteção: id de pagamento do Mercado Pago é só
-- número, id de recorrência não é. Assim uma linha já corrompida não copia
-- lixo para a coluna nova.
-- ---------------------------------------------------------------------
update public.client_subscriptions
set recurring_preapproval_id = subscription_payment_order_id
where recurring_preapproval_id is null
  and subscription_payment_provider in (
    'mercadopago_card_recurring',
    'mercadopago_card_recurring_pending'
  )
  and coalesce(btrim(subscription_payment_order_id), '') <> ''
  and subscription_payment_order_id !~ '^[0-9]+$';

-- Conferência: quantos ficaram com o vínculo salvo no lugar certo.
select
  count(*) filter (where recurring_preapproval_id is not null) as vinculos_salvos,
  count(*) filter (
    where subscription_payment_provider in (
      'mercadopago_card_recurring',
      'mercadopago_card_recurring_pending'
    )
  ) as linhas_de_recorrencia
from public.client_subscriptions;
