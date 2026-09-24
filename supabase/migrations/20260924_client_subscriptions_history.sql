-- =====================================================================
-- HISTÓRICO DE ASSINANTES — cada mudança vira um registro que NUNCA some
-- =====================================================================
--
-- PROBLEMA QUE ISTO RESOLVE
--
-- A assinatura de cada cliente é UMA linha em client_subscriptions, com o estado
-- de agora: payment_status, last_payment_date, end_date... Quando o cliente
-- renova, a linha é sobrescrita. Não existe registro do que aconteceu antes.
--
-- A tela "Meus Assinantes" monta o mês passado a partir dessa linha de hoje:
--   · renovou em setembro → last_payment_date virou setembro → a renovação de
--     agosto "some" de agosto e "aparece" em setembro;
--   · está 'não pago' hoje → a tela considera que ele não pagou em agosto,
--     mesmo tendo pago.
-- Resultado: no dia 1 o dono volta ao mês anterior para fechar com o contador
-- e os números já são outros. Caso real: Costa Barbearia & Tatuagem (9223).
--
-- O QUE ESTA MIGRATION FAZ
--
-- 1. Cria client_subscription_history: a cada INSERT/UPDATE/DELETE em
--    client_subscriptions, guarda a linha ANTES e DEPOIS (jsonb), quem fez e
--    quando. Só grava UPDATE quando algum campo que importa mudou — refresh de
--    tela não gera lixo.
-- 2. Grava um SNAPSHOT inicial de todas as assinaturas atuais: a partir de
--    hoje, qualquer mês fica reconstruível.
-- 3. Cria a view client_subscription_renewals: "quem pagou, quando, quanto" —
--    é ela que alimenta o fechamento do mês.
--
-- É o MESMO padrão que o projeto já usa em subscription_plan_audit_logs.
--
-- IMPACTO / RISCO
--
-- Puramente ADITIVO: não altera, remove nem renomeia nada em client_subscriptions.
-- Nenhum fluxo existente muda de comportamento. O trigger é AFTER: se um dia
-- falhar, o Postgres desfaz junto a alteração original — nunca deixa meio feito.
-- Não toca em Mercado Pago, WhatsApp, policies existentes nem tokens.
--
-- O QUE NÃO RESOLVE
--
-- O passado que já foi sobrescrito (ex.: agosto de quem renovou em setembro)
-- não volta — o dado não existe mais. O histórico começa no momento em que
-- este SQL roda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela de histórico
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Sem NOT NULL de propósito: se uma linha antiga estiver sem estabelecimento,
  -- o histórico não pode ser o motivo de a renovação do barbeiro falhar.
  establishment_id uuid NULL,
  client_subscription_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('SNAPSHOT', 'INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid NULL,
  changed_fields text[] NULL,
  old_row jsonb NULL,
  new_row jsonb NULL
);

COMMENT ON TABLE public.client_subscription_history IS
  'Histórico imutável de client_subscriptions: cada renovação, mudança de status, plano ou validade fica registrada com a linha antes/depois. Base do fechamento mensal de assinantes.';

CREATE INDEX IF NOT EXISTS idx_cs_history_est_created
  ON public.client_subscription_history (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_history_sub_created
  ON public.client_subscription_history (client_subscription_id, created_at DESC);

ALTER TABLE public.client_subscription_history ENABLE ROW LEVEL SECURITY;

-- Dono lê só o histórico do próprio estabelecimento. Ninguém escreve pela API:
-- só o trigger (SECURITY DEFINER) e o service_role.
DROP POLICY IF EXISTS "Dono le historico dos proprios assinantes" ON public.client_subscription_history;
CREATE POLICY "Dono le historico dos proprios assinantes"
  ON public.client_subscription_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = client_subscription_history.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

GRANT SELECT ON public.client_subscription_history TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Trigger: grava antes/depois. UPDATE só quando algo relevante mudou.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_subscription_history_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  -- Campos que contam para o histórico. Mudança fora desta lista (ex.: um
  -- updated_at solto, observação) não gera registro.
  v_campos text[] := ARRAY[
    'payment_status', 'last_payment_date', 'start_date', 'end_date',
    'subscription_id', 'custom_subscription_value', 'extra_charge_value',
    'extra_charge_label', 'archived_at', 'subscriber_payment_method',
    'subscription_payment_provider', 'subscription_payment_order_id',
    'recurring_preapproval_id', 'subscriber_name', 'subscriber_whatsapp',
    'subscriber_email', 'monthly_limit', 'bonus_credits'
  ];
  v_campo text;
BEGIN
  -- auth.uid() e NUNCA current_user: dentro de SECURITY DEFINER, current_user
  -- é o dono da função, não quem clicou.
  v_actor := auth.uid();

  -- REGRA DE OURO: o histórico NUNCA pode impedir a operação original.
  -- Se gravar o histórico falhar por qualquer motivo, a renovação/edição do
  -- assinante segue normal e fica só um aviso no log do banco.
  BEGIN
    IF TG_OP = 'DELETE' THEN
      INSERT INTO public.client_subscription_history
        (establishment_id, client_subscription_id, operation, actor_user_id, old_row, new_row)
      VALUES (OLD.establishment_id, OLD.id, 'DELETE', v_actor, to_jsonb(OLD), NULL);
      RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.client_subscription_history
        (establishment_id, client_subscription_id, operation, actor_user_id, old_row, new_row)
      VALUES (NEW.establishment_id, NEW.id, 'INSERT', v_actor, NULL, to_jsonb(NEW));
      RETURN NEW;
    END IF;

    -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_changed := ARRAY[]::text[];
    FOREACH v_campo IN ARRAY v_campos LOOP
      IF (v_old -> v_campo) IS DISTINCT FROM (v_new -> v_campo) THEN
        v_changed := array_append(v_changed, v_campo);
      END IF;
    END LOOP;

    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW; -- nada relevante mudou: não grava
    END IF;

    INSERT INTO public.client_subscription_history
      (establishment_id, client_subscription_id, operation, actor_user_id, changed_fields, old_row, new_row)
    VALUES (NEW.establishment_id, NEW.id, 'UPDATE', v_actor, v_changed, v_old, v_new);
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'client_subscription_history: falha ao gravar historico (%): %', TG_OP, SQLERRM;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS client_subscription_history_trigger ON public.client_subscriptions;
CREATE TRIGGER client_subscription_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.client_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.client_subscription_history_trigger_fn();

-- ---------------------------------------------------------------------
-- 3) Snapshot inicial: o "ponto zero" de cada assinatura que existe hoje.
--    Sem isto, uma assinatura que nunca mudar depois de hoje não teria
--    nenhum registro para reconstruir o mês.
-- ---------------------------------------------------------------------
INSERT INTO public.client_subscription_history
  (establishment_id, client_subscription_id, operation, actor_user_id, old_row, new_row)
SELECT cs.establishment_id, cs.id, 'SNAPSHOT', NULL, NULL, to_jsonb(cs)
FROM public.client_subscriptions cs
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_subscription_history h
  WHERE h.client_subscription_id = cs.id AND h.operation = 'SNAPSHOT'
);

-- ---------------------------------------------------------------------
-- 4) View de RENOVAÇÕES: quem pagou, quando, quanto. Uma linha por pagamento
--    registrado a partir de agora. É o "extrato" que o fechamento do mês lê.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.client_subscription_renewals AS
SELECT
  h.id                                            AS history_id,
  h.establishment_id,
  h.client_subscription_id,
  h.created_at                                    AS registrado_em,
  (h.new_row ->> 'subscriber_name')               AS subscriber_name,
  (h.new_row ->> 'subscriber_whatsapp')           AS subscriber_whatsapp,
  -- NULLIF antes do cast: um '' em linha antiga não pode derrubar a view inteira.
  NULLIF(h.new_row ->> 'last_payment_date', '')::date AS pago_em,
  NULLIF(h.new_row ->> 'end_date', '')::date          AS valido_ate,
  NULLIF(h.new_row ->> 'subscription_id', '')::uuid   AS subscription_id,
  COALESCE(
    NULLIF(h.new_row ->> 'custom_subscription_value', '')::numeric,
    s.value
  ) + COALESCE(NULLIF(h.new_row ->> 'extra_charge_value', '')::numeric, 0) AS valor,
  (h.new_row ->> 'subscriber_payment_method')     AS forma_pagamento,
  (h.new_row ->> 'subscription_payment_provider') AS origem,
  h.actor_user_id
FROM public.client_subscription_history h
LEFT JOIN public.subscriptions s ON s.id = NULLIF(h.new_row ->> 'subscription_id', '')::uuid
WHERE h.operation IN ('INSERT', 'UPDATE')
  AND (h.new_row ->> 'payment_status') = 'paid'
  AND (h.new_row ->> 'last_payment_date') IS NOT NULL
  AND (
    h.operation = 'INSERT'
    OR (h.old_row ->> 'last_payment_date') IS DISTINCT FROM (h.new_row ->> 'last_payment_date')
    OR (h.old_row ->> 'payment_status') IS DISTINCT FROM 'paid'
  );

COMMENT ON VIEW public.client_subscription_renewals IS
  'Uma linha por pagamento de assinatura registrado no histórico (a partir da criação do histórico). Filtre por pago_em para fechar um mês.';

GRANT SELECT ON public.client_subscription_renewals TO authenticated;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.client_subscription_history WHERE operation = 'SNAPSHOT') AS snapshots_iniciais,
  (SELECT count(*) FROM public.client_subscriptions)                                     AS assinaturas_existentes,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'client_subscription_history_trigger')  AS trigger_instalado;
