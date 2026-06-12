-- =============================================================================
-- SOMENTE LEITURA — rode no SQL Editor do Supabase ANTES da migration Fase 5.
-- Um único resultado: TODOS os status devem ser OK (ou set_updated_at opcional).
-- =============================================================================

SELECT check_item, status,
  CASE
    WHEN status = 'OK' THEN '✓ pode continuar'
    WHEN check_item = 'set_updated_at()' AND status LIKE 'FALTANDO%' THEN '✓ migration cria idempotente'
    WHEN check_item = 'partner_withdrawal_requests' AND status = 'Ainda não existe (esperado)' THEN '✓ pode continuar'
    ELSE '✗ NÃO rode a migration principal'
  END AS acao
FROM (
  SELECT 'partner_referrals' AS check_item,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'partner_referrals'
         ) THEN 'OK' ELSE 'FALTANDO' END AS status,
         1 AS sort_order
  UNION ALL
  SELECT 'is_admin_user()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         2
  UNION ALL
  SELECT 'set_updated_at()',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
         ) THEN 'OK' ELSE 'FALTANDO (migration criará)' END,
         3
  UNION ALL
  SELECT 'establishments.owner_id',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         10
  UNION ALL
  SELECT 'establishments.payment_status',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_status'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         11
  UNION ALL
  SELECT 'establishments.payment_due_date',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_due_date'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         12
  UNION ALL
  SELECT 'establishments.payment_paid_at',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_paid_at'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         13
  UNION ALL
  SELECT 'establishments.is_blocked',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_blocked'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         14
  UNION ALL
  SELECT 'establishments.is_deleted',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_deleted'
         ) THEN 'OK' ELSE 'FALTANDO' END,
         15
  UNION ALL
  SELECT 'partner_withdrawal_requests',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_tables
           WHERE schemaname = 'public' AND tablename = 'partner_withdrawal_requests'
         ) THEN 'JÁ EXISTE (re-executar migration é seguro)' ELSE 'Ainda não existe (esperado)' END,
         20
) checks
ORDER BY sort_order;
