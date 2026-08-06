-- ============================================================================
-- TRAVA + AUDITORIA DAS COLUNAS DE COBRANÇA (establishments)
-- ----------------------------------------------------------------------------
-- PROBLEMA (confirmado em 2026-08-06):
-- A policy "Establishment owners can update their own establishment" (2024-03-07)
-- é FOR UPDATE USING (auth.uid() = owner_id) SEM restrição de coluna. Ou seja, o
-- dono logado pode dar PATCH direto no PostgREST (a chave anon é pública, por
-- design) e alterar o PRÓPRIO vencimento, status de pagamento e bloqueio —
-- ganhando acesso grátis. Caso real: estabelecimento com 3 pagamentos mensais
-- (último em 18/06) apareceu com vencimento em 18/12, data que NENHUM fluxo do
-- sistema é capaz de gerar (webhook, "marcar pago" e checkout fazem hoje+1 mês).
--
-- COMO ESTA TRAVA FUNCIONA:
-- Trigger BEFORE UPDATE que, quando quem edita é o PRÓPRIO DONO da linha
-- (auth.uid() = OLD.owner_id), congela as colunas de cobrança: registra a
-- tentativa na auditoria e devolve o valor antigo (NEW.col := OLD.col).
--
-- POR QUE "DEVOLVER O VALOR" E NÃO DAR ERRO:
-- RAISE EXCEPTION faria rollback da transação — e levaria junto o registro de
-- auditoria, além de poder quebrar telas em produção com erro inesperado. Assim
-- o update segue normal (os outros campos salvam), a cobrança fica intacta e a
-- tentativa fica gravada com autor, data e valores.
--
-- POR QUE NÃO DEPENDE DO E-MAIL DO ADMIN:
-- A regra é "é o dono mexendo na própria linha?". O admin nunca é dono dos
-- estabelecimentos que administra, então o painel admin passa direto. O servidor
-- (service_role, nas netlify functions) e o SQL Editor (postgres) também passam.
-- is_admin_user() fica como exceção extra, caso o admin tenha conta própria.
--
-- SEGURANÇA CONFERIDA — o painel do estabelecimento NÃO escreve nenhuma destas
-- colunas (ele salva professionals, services_with_prices, business_hours,
-- onboarding_step, fila_espera_*, client_afcoins_enabled, bank_*, name, e os
-- campos do Mercado Pago). Nada de agenda, booking, financeiro, WhatsApp ou MP
-- é afetado. A comparação é por VALOR (IS DISTINCT FROM): um update que reenvia
-- a mesma data não dispara nada.
--
-- Aditivo e reversível (rollback no fim do arquivo).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Helper de admin (mesmo corpo já usado em outras migrations — idempotente).
--    Garante que a migration não falhe caso ele ainda não exista nesta base.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'suporteagendeifacil@gmail.com'
$$;

-- ---------------------------------------------------------------------------
-- 1) Tabela de auditoria (nova, isolada — não toca em nada existente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.establishment_billing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid,
  establishment_code text,
  column_name text NOT NULL,
  old_value text,
  new_value text,
  actor_uid uuid,
  actor_email text,
  actor_role text,
  was_blocked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_establishment_billing_audit_est
  ON public.establishment_billing_audit (establishment_id, created_at DESC);

COMMENT ON TABLE public.establishment_billing_audit IS
  'Tentativas de alteração das colunas de cobrança de establishments feitas pelo próprio dono (bloqueadas pelo trigger protect_establishment_billing).';

ALTER TABLE public.establishment_billing_audit ENABLE ROW LEVEL SECURITY;

-- Só o admin lê pelo site. service_role e postgres ignoram RLS (servidor/SQL Editor).
-- Sem policy de INSERT/UPDATE/DELETE: ninguém do lado cliente escreve nem apaga
-- (o trigger grava como SECURITY DEFINER).
DROP POLICY IF EXISTS "Admin can read establishment billing audit" ON public.establishment_billing_audit;
CREATE POLICY "Admin can read establishment billing audit"
  ON public.establishment_billing_audit
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- Leitura só para logados (a policy acima ainda filtra: só o admin enxerga).
-- O anônimo do booking não recebe nada.
GRANT SELECT ON public.establishment_billing_audit TO authenticated;
REVOKE ALL ON public.establishment_billing_audit FROM anon;

-- ---------------------------------------------------------------------------
-- 2) Função do trigger — gerada dinamicamente para incluir SOMENTE as colunas
--    que existem de fato nesta base (evita erro em runtime por coluna ausente,
--    que derrubaria TODO update de establishments).
-- ---------------------------------------------------------------------------
DO $outer$
DECLARE
  v_wanted text[] := ARRAY[
    'payment_due_date',            -- vencimento (o caso real)
    'payment_status',              -- pago / não pago / vencido
    'payment_paid_at',             -- data do pagamento
    'payment_alert_enabled',       -- alerta de cobrança
    'plan_type',                   -- mensal / anual / trial
    'is_blocked',                  -- bloqueio da conta
    'booking_blocked',             -- bloqueio da página de agendamento
    'is_deleted',                  -- exclusão lógica
    'plan_prata_active',           -- plano Prata (limites de recursos)
    'admin_profit_value',          -- lucro manual lançado pelo admin
    'mercadopago_billing_amount'   -- valor da mensalidade cobrada
  ];
  v_existing text[];
  v_col text;
  v_checks text := '';
BEGIN
  SELECT array_agg(c.column_name::text ORDER BY c.column_name)
    INTO v_existing
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'establishments'
    AND c.column_name = ANY(v_wanted);

  IF v_existing IS NULL OR array_length(v_existing, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma coluna de cobrança encontrada em establishments — migration abortada por segurança';
  END IF;

  RAISE NOTICE 'Colunas de cobrança protegidas: %', array_to_string(v_existing, ', ');

  FOREACH v_col IN ARRAY v_existing LOOP
    v_checks := v_checks || format($chk$
      IF NEW.%1$I IS DISTINCT FROM OLD.%1$I THEN
        BEGIN
          INSERT INTO public.establishment_billing_audit(
            establishment_id, establishment_code, column_name,
            old_value, new_value, actor_uid, actor_email, actor_role, was_blocked
          ) VALUES (
            OLD.id, v_code, %2$L,
            to_jsonb(OLD.%1$I) #>> '{}', to_jsonb(NEW.%1$I) #>> '{}',
            v_uid, v_email, v_actor, true
          );
        EXCEPTION WHEN OTHERS THEN
          NULL; -- auditoria nunca pode derrubar o update
        END;
        NEW.%1$I := OLD.%1$I;  -- devolve o valor original: cobrança intocada
      END IF;
    $chk$, v_col, v_col);
  END LOOP;

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.protect_establishment_billing()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_uid   uuid;
      v_email text;
      v_actor text;
      v_code  text;
    BEGIN
      -- ATENÇÃO: NÃO usar current_user aqui. Esta função é SECURITY DEFINER
      -- (precisa ser, para gravar na auditoria), e nesse modo o Postgres troca a
      -- identidade: current_user vira o dono da função (postgres) para QUALQUER
      -- chamador. Uma checagem "if current_user = postgres then return" liberava
      -- todo mundo, inclusive o dono — foi o bug da primeira versão.
      -- A identidade confiável aqui é auth.uid(), que vem do JWT do chamador.
      BEGIN
        v_uid := auth.uid();
      EXCEPTION WHEN OTHERS THEN
        v_uid := NULL;
      END;

      -- Sem usuário logado = servidor (service_role), SQL Editor, cron, migration.
      -- Esses precisam poder cobrar/regularizar. O anônimo não chega aqui: a RLS
      -- de UPDATE exige auth.uid() = owner_id.
      IF v_uid IS NULL THEN
        RETURN NEW;
      END IF;

      BEGIN
        v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
        v_actor := coalesce(nullif(auth.jwt() ->> 'role', ''), 'authenticated');
      EXCEPTION WHEN OTHERS THEN
        v_email := NULL;
        v_actor := NULL;
      END;

      -- Painel admin: única conta logada que pode mexer em cobrança.
      IF public.is_admin_user() THEN
        RETURN NEW;
      END IF;

      -- A REGRA: qualquer OUTRO usuário logado tem a cobrança congelada.
      --
      -- A primeira versão checava só "é o dono desta linha?" (auth.uid() =
      -- OLD.owner_id). Isso seria suficiente se a RLS só deixasse o dono editar
      -- — mas existe em establishments uma policy "Enable update for all users"
      -- com USING (true), e no Postgres basta UMA policy permissiva liberar.
      -- Ou seja, um barbeiro consegue alterar a linha de OUTRA barbearia, onde
      -- não é dono, e escaparia da checagem por owner_id.
      -- Congelar para todo logado que não seja admin cobre os dois casos e
      -- continua sem afetar o servidor (auth.uid() IS NULL, já liberado acima).

      BEGIN
        v_code := OLD.code::text;
      EXCEPTION WHEN OTHERS THEN
        v_code := NULL;
      END;

      %s

      RETURN NEW;
    END;
    $body$;
  $fn$, v_checks);
END
$outer$;

COMMENT ON FUNCTION public.protect_establishment_billing() IS
  'Congela as colunas de cobrança de establishments quando o UPDATE parte do próprio dono (auth.uid() = owner_id). Registra a tentativa em establishment_billing_audit e devolve o valor antigo, sem lançar erro.';

-- ---------------------------------------------------------------------------
-- 3) Liga o trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_protect_establishment_billing ON public.establishments;
CREATE TRIGGER trg_protect_establishment_billing
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_establishment_billing();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (se algo quebrar, cole e rode ISTO pra voltar ao de antes):
--
-- DROP TRIGGER IF EXISTS trg_protect_establishment_billing ON public.establishments;
-- DROP FUNCTION IF EXISTS public.protect_establishment_billing();
-- -- (a tabela de auditoria pode ficar; para remover também:)
-- -- DROP TABLE IF EXISTS public.establishment_billing_audit;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================
