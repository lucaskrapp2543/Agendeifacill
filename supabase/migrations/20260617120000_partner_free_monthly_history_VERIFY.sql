-- =============================================================================
-- SOMENTE LEITURA — rode no SQL Editor ANTES da migration Fase 7.
-- Todos os itens de dependência: OK. Objetos Fase 7: "Ainda não existe" ou re-exec segura.
-- =============================================================================

SELECT check_item, status,
  CASE
    WHEN status = 'OK' THEN '✓ pode continuar'
    WHEN check_item = 'set_updated_at()' AND status LIKE 'FALTANDO%' THEN '✓ migration cria idempotente'
    WHEN status LIKE 'JÁ EXISTE%' OR status = 'Ainda não existe (esperado)' THEN '✓ pode continuar'
    ELSE '✗ NÃO rode a migration principal'
  END AS acao
FROM (
  SELECT 'partner_referrals (tabela)' AS check_item,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'partner_referrals'
         ) THEN 'OK' ELSE 'FALTANDO' END AS status,
         1 AS sort_order
  UNION ALL
  SELECT 'establishments (tabela)',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'establishments'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         2
  UNION ALL
  SELECT 'is_admin_user()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         3
  UNION ALL
  SELECT 'set_updated_at()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
         ) THEN 'OK' ELSE 'FALTANDO (migration criará)' END,
         4
  UNION ALL
  SELECT 'establishments.id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         10
  UNION ALL
  SELECT 'establishments.owner_id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         11
  UNION ALL
  SELECT 'establishments.payment_status',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_status'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         12
  UNION ALL
  SELECT 'establishments.payment_due_date',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_due_date'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         13
  UNION ALL
  SELECT 'establishments.payment_paid_at',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_paid_at'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         14
  UNION ALL
  SELECT 'establishments.is_blocked',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_blocked'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         15
  UNION ALL
  SELECT 'establishments.is_deleted',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_deleted'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         16
  UNION ALL
  SELECT 'partner_referrals.status',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'partner_referrals' AND column_name = 'status'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         17
  UNION ALL
  SELECT 'partner_referrals.selected_plan',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'partner_referrals' AND column_name = 'selected_plan'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         18
  UNION ALL
  SELECT 'partner_free_monthly_history (tabela)',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'partner_free_monthly_history'
         ) THEN 'JÁ EXISTE (re-executar migration é seguro)' ELSE 'Ainda não existe (esperado)' END,
         30
  UNION ALL
  SELECT 'count_partner_active_referrals()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'count_partner_active_referrals'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         31
  UNION ALL
  SELECT 'list_partner_free_monthly_history()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'list_partner_free_monthly_history'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         32
  UNION ALL
  SELECT 'admin_upsert_partner_free_monthly()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_partner_free_monthly'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         33
) checks
ORDER BY sort_order;
