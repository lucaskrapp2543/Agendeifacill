-- =============================================================================
-- SOMENTE LEITURA — rode ANTES da migration de cobrança PIX no balcão.
-- Nada é criado ou alterado aqui.
-- =============================================================================

SELECT 'appointments'                     AS dependencia,
       count(*) AS existe FROM pg_tables WHERE schemaname='public' AND tablename='appointments'
UNION ALL SELECT 'establishments',
       count(*) FROM pg_tables WHERE schemaname='public' AND tablename='establishments'
UNION ALL SELECT 'admin_mp_commissions',
       count(*) FROM pg_tables WHERE schemaname='public' AND tablename='admin_mp_commissions'
UNION ALL SELECT 'is_admin_user()',
       count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='is_admin_user'
UNION ALL SELECT 'set_updated_at()',
       count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='set_updated_at'
UNION ALL SELECT 'establishments.owner_id',
       count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='establishments' AND column_name='owner_id'
UNION ALL SELECT '>>> appointment_local_charges (tem que ser 0)',
       count(*) FROM pg_tables WHERE schemaname='public' AND tablename='appointment_local_charges';

-- -----------------------------------------------------------------------------
-- Conferência de escopo: quantos agendamentos do mês PODERIAM usar o botão.
-- Só entram os que NÃO têm pagamento online — mesma regra do badge no card.
-- Somente leitura.
-- -----------------------------------------------------------------------------
SELECT
  e.name,
  e.code,
  count(*) FILTER (
    WHERE coalesce(a.payment_status, '') <> 'paid'
      AND coalesce(a.payment_transaction_id, '') = ''
      AND lower(coalesce(a.pix_payment_status, '')) NOT IN ('aprovado','approved','confirmado')
  ) AS podem_ser_cobrados,
  count(*) AS total_agendamentos
FROM public.appointments a
JOIN public.establishments e ON e.id = a.establishment_id
WHERE a.appointment_date >= date_trunc('month', timezone('America/Sao_Paulo', now()))::date
GROUP BY e.name, e.code
ORDER BY podem_ser_cobrados DESC
LIMIT 15;
