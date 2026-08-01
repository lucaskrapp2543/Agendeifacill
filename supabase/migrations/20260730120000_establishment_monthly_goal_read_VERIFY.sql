-- =============================================================================
-- SOMENTE LEITURA — rode no SQL Editor ANTES da migration da Meta Mensal.
-- Nada é criado ou alterado por este arquivo.
--
-- Todos os itens devem sair como "OK" (ou "Ainda não existe (esperado)").
-- Se algo sair como FALTANDO, NÃO rode a migration principal.
-- =============================================================================

SELECT check_item, status,
  CASE
    WHEN status = 'OK' THEN '✓ pode continuar'
    WHEN status = 'Ainda não existe (esperado)' THEN '✓ pode continuar'
    WHEN status LIKE 'JÁ EXISTE%' THEN '✓ re-execução segura (CREATE OR REPLACE)'
    ELSE '✗ NÃO rode a migration principal'
  END AS acao
FROM (
  -- Dependências obrigatórias
  SELECT 'admin_mp_commissions (tabela do ledger)' AS check_item,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_mp_commissions'
         ) THEN 'OK' ELSE 'FALTANDO' END AS status,
         1 AS sort_order
  UNION ALL
  SELECT 'admin_mp_commissions.establishment_id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='admin_mp_commissions' AND column_name='establishment_id'
         ) THEN 'OK' ELSE 'FALTANDO' END, 2
  UNION ALL
  SELECT 'admin_mp_commissions.status',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='admin_mp_commissions' AND column_name='status'
         ) THEN 'OK' ELSE 'FALTANDO' END, 3
  UNION ALL
  SELECT 'admin_mp_commissions.paid_at',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='admin_mp_commissions' AND column_name='paid_at'
         ) THEN 'OK' ELSE 'FALTANDO' END, 4
  UNION ALL
  SELECT 'admin_mp_commissions.commission_cents',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='admin_mp_commissions' AND column_name='commission_cents'
         ) THEN 'OK' ELSE 'FALTANDO' END, 5
  UNION ALL
  SELECT 'admin_mp_commissions.payment_method',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='admin_mp_commissions' AND column_name='payment_method'
         ) THEN 'OK' ELSE 'FALTANDO' END, 6
  UNION ALL
  SELECT 'admin_mp_commissions.source_type',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='admin_mp_commissions' AND column_name='source_type'
         ) THEN 'OK' ELSE 'FALTANDO' END, 7
  UNION ALL
  SELECT 'establishments.owner_id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='establishments' AND column_name='owner_id'
         ) THEN 'OK' ELSE 'FALTANDO' END, 8
  UNION ALL
  SELECT 'establishments.mercadopago_billing_amount',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='establishments' AND column_name='mercadopago_billing_amount'
         ) THEN 'OK' ELSE 'FALTANDO' END, 9
  UNION ALL
  SELECT 'is_admin_user()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' AND p.proname='is_admin_user'
         ) THEN 'OK' ELSE 'FALTANDO' END, 10
  UNION ALL
  SELECT 'admin_billing_links (fallback global)',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_billing_links'
         ) THEN 'OK' ELSE 'FALTANDO' END, 11
  UNION ALL
  -- Objetos criados por esta migration (esperado: ainda não existem)
  SELECT 'count_establishment_valid_payments()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' AND p.proname='count_establishment_valid_payments'
         ) THEN 'JÁ EXISTE (será substituída)' ELSE 'Ainda não existe (esperado)' END, 12
  UNION ALL
  SELECT 'get_establishment_monthly_goal()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' AND p.proname='get_establishment_monthly_goal'
         ) THEN 'JÁ EXISTE (será substituída)' ELSE 'Ainda não existe (esperado)' END, 13
) t
ORDER BY sort_order;

-- -----------------------------------------------------------------------------
-- Conferência de volume: quantos pagamentos válidos existem no mês corrente.
-- Serve para comparar com o card "Meus R$1" do admin depois de aplicar.
-- -----------------------------------------------------------------------------
SELECT
  count(*)                                   AS pagamentos_validos_mes_atual,
  count(DISTINCT establishment_id)            AS estabelecimentos_com_pagamento,
  coalesce(sum(commission_cents), 0) / 100.0  AS receita_reais_mes_atual
FROM public.admin_mp_commissions
WHERE status = 'paid'
  AND paid_at >= date_trunc('month', timezone('America/Sao_Paulo', now()))
  AND paid_at <  date_trunc('month', timezone('America/Sao_Paulo', now())) + interval '1 month';
