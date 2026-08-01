-- =============================================================================
-- SOMENTE LEITURA — rode ANTES da migration do histórico da Meta Mensal.
-- Nada é criado ou alterado aqui.
-- Resultado esperado: uma linha com todos os valores conforme indicado.
-- =============================================================================

SELECT
  -- Dependências obrigatórias (precisam ser > 0)
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='admin_mp_commissions')                       AS dep_ledger_1,
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='establishments')                             AS dep_establishments_1,
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='admin_billing_links')                        AS dep_billing_links_1,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='is_admin_user')                               AS dep_is_admin_1,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='set_updated_at')                              AS dep_set_updated_at_1,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='monthly_goal_sp_month_date')                  AS dep_etapa4_aplicada_1,
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='establishment_billing_payments')             AS dep_billing_payments_1,

  -- Opcional: benefício de indicação (usado para detectar conflito).
  -- Pode ser 0 — a migration trata a ausência sem erro.
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='partner_free_monthly_history')               AS opcional_indicacao_0ou1,

  -- Objeto criado por esta migration (esperado 0 na primeira vez)
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='establishment_monthly_goals')                AS novo_esperado_0;

-- -----------------------------------------------------------------------------
-- Prévia do que SERIA gravado se você fechasse o mês atual agora.
-- Somente leitura — nada é gravado. Serve para conferir antes de fechar.
-- -----------------------------------------------------------------------------
WITH mes AS (
  SELECT date_trunc('month', timezone('America/Sao_Paulo', now()))::date AS ref
),
contagem AS (
  SELECT c.establishment_id, count(*)::int AS pagamentos
  FROM public.admin_mp_commissions c, mes m
  WHERE c.status = 'paid'
    AND c.paid_at >= m.ref::timestamptz
    AND c.paid_at <  (m.ref + interval '1 month')::timestamptz
  GROUP BY c.establishment_id
)
SELECT
  e.name,
  e.code,
  ct.pagamentos,
  -- Faixas fechadas: 40=25%, 80=50%, 120=75%, 160=100% (sem intermediário)
  CASE
    WHEN ct.pagamentos >= 160 THEN 100
    WHEN ct.pagamentos >= 120 THEN 75
    WHEN ct.pagamentos >=  80 THEN 50
    WHEN ct.pagamentos >=  40 THEN 25
    ELSE 0
  END AS percentual,
  round(coalesce(NULLIF(e.mercadopago_billing_amount, 0), 0) * 100)::int  AS mensalidade_centavos
FROM contagem ct
JOIN public.establishments e ON e.id = ct.establishment_id
ORDER BY ct.pagamentos DESC
LIMIT 20;
