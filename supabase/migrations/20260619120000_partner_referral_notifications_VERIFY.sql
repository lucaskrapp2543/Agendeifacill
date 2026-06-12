-- =============================================================================
-- SOMENTE LEITURA — rode no SQL Editor ANTES da migration Fase 9.
-- =============================================================================

SELECT check_item, status,
  CASE
    WHEN status = 'OK' THEN '✓ pode continuar'
    WHEN check_item = 'set_updated_at()' AND status LIKE 'FALTANDO%' THEN '✓ migration cria idempotente'
    WHEN check_item = 'count_partner_active_referrals()' AND status LIKE 'FALTANDO%' THEN '✓ migration cria idempotente'
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
  SELECT 'establishments.id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         3
  UNION ALL
  SELECT 'establishments.owner_id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         4
  UNION ALL
  SELECT 'establishments.payment_status',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_status'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         5
  UNION ALL
  SELECT 'establishments.payment_due_date',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_due_date'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         6
  UNION ALL
  SELECT 'establishments.payment_paid_at',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_paid_at'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         7
  UNION ALL
  SELECT 'establishments.is_blocked',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_blocked'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         8
  UNION ALL
  SELECT 'establishments.is_deleted',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_deleted'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         9
  UNION ALL
  SELECT 'is_admin_user()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         10
  UNION ALL
  SELECT 'set_updated_at()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
         ) THEN 'OK' ELSE 'FALTANDO (migration criará)' END,
         11
  UNION ALL
  SELECT 'count_partner_active_referrals()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'count_partner_active_referrals'
         ) THEN 'OK' ELSE 'FALTANDO (migration criará)' END,
         12
  UNION ALL
  SELECT 'partner_referral_notifications (tabela)',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'partner_referral_notifications'
         ) THEN 'JÁ EXISTE (re-executar migration é seguro)' ELSE 'Ainda não existe (esperado)' END,
         30
  UNION ALL
  SELECT 'sync_partner_referral_notifications()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'sync_partner_referral_notifications'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         31
  UNION ALL
  SELECT 'list_partner_referral_notifications()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'list_partner_referral_notifications'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         32
  UNION ALL
  SELECT 'mark_partner_referral_notifications_read()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'mark_partner_referral_notifications_read'
         ) THEN 'JÁ EXISTE (CREATE OR REPLACE)' ELSE 'Ainda não existe (esperado)' END,
         33
) checks
ORDER BY sort_order;
