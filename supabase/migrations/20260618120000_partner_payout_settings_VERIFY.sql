-- =============================================================================
-- SOMENTE LEITURA — rode no SQL Editor ANTES da migration Fase 8.
-- =============================================================================

SELECT check_item, status,
  CASE
    WHEN status = 'OK' THEN '✓ pode continuar'
    WHEN check_item = 'set_updated_at()' AND status LIKE 'FALTANDO%' THEN '✓ migration cria idempotente'
    WHEN status LIKE 'JÁ EXISTE%' OR status = 'Ainda não existe (esperado)' THEN '✓ pode continuar'
    ELSE '✗ NÃO rode a migration principal'
  END AS acao
FROM (
  SELECT 'establishments (tabela)' AS check_item,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'establishments'
         ) THEN 'OK' ELSE 'FALTANDO' END AS status,
         1 AS sort_order
  UNION ALL
  SELECT 'establishments.id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         2
  UNION ALL
  SELECT 'establishments.owner_id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         3
  UNION ALL
  SELECT 'is_admin_user()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         4
  UNION ALL
  SELECT 'set_updated_at()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
         ) THEN 'OK' ELSE 'FALTANDO (migration criará)' END,
         5
  UNION ALL
  SELECT 'partner_payout_settings (tabela)',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'partner_payout_settings'
         ) THEN 'JÁ EXISTE (re-executar migration é seguro)' ELSE 'Ainda não existe (esperado)' END,
         20
  UNION ALL
  SELECT 'get_partner_payout_settings()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'get_partner_payout_settings'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         21
  UNION ALL
  SELECT 'upsert_partner_payout_settings()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'upsert_partner_payout_settings'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         22
) checks
ORDER BY sort_order;
