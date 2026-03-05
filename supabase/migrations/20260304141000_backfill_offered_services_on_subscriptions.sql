-- Backfill seguro para padronizar assinaturas antigas no formato
-- "Servicos oferecidos na assinatura" (sem duplicar servicos existentes).
--
-- Regras:
-- - So atualiza quando NAO houver servicos preenchidos (null/array vazia/invalida)
--   OU quando divide_services_enabled estiver desativado.
-- - Cria exatamente 1 servico legado por assinatura:
--   nome = nome da assinatura
--   duracao = service_duration (fallback 30, minimo 5)
--   limite = divide_total_attendances (fallback 999)

WITH target_subscriptions AS (
  SELECT
    s.id,
    COALESCE(NULLIF(TRIM(s.name), ''), 'Servico da assinatura') AS service_name,
    GREATEST(5, COALESCE(NULLIF(s.service_duration, 0), 30)) AS service_duration_minutes,
    CASE
      WHEN COALESCE(s.divide_total_attendances, 0) > 0
        THEN FLOOR(s.divide_total_attendances)::int
      ELSE 999
    END AS service_limit
  FROM public.subscriptions s
  WHERE
    COALESCE(s.divide_services_enabled, false) = false
    OR s.divided_services IS NULL
    OR jsonb_typeof(s.divided_services) <> 'array'
    OR jsonb_array_length(s.divided_services) = 0
)
UPDATE public.subscriptions s
SET
  divide_services_enabled = true,
  divided_services = jsonb_build_array(
    jsonb_build_object(
      'id', 'svc_legacy_' || s.id::text,
      'name', t.service_name,
      'duration', t.service_duration_minutes,
      'limit', t.service_limit
    )
  )
FROM target_subscriptions t
WHERE s.id = t.id;
