-- DEBUG read-only — diagnóstico pós-pagamento Indique e Ganhe (localhost/produção).
-- ⚠️ ATENÇÃO: este arquivo NÃO INSERE NADA. Só SELECT.
-- Para corrigir vínculo faltante, use: 20260620130000_partner_referral_backfill_testebitelo10_FIX.sql
-- NÃO altera dados. Cole no Supabase SQL Editor após um teste de cadastro.

-- 1) Último checkout convertido (ajuste o filtro se quiser)
SELECT
  id,
  status,
  selected_plan,
  establishment_name,
  email,
  amount_cents,
  original_amount_cents,
  discount_percent,
  final_amount_cents,
  partner_referral_code,
  partner_establishment_id,
  payment_id,
  preapproval_id,
  created_establishment_id,
  converted_at,
  metadata->>'partner_referral_linked' AS partner_referral_linked,
  metadata->>'conversion_error' AS conversion_error,
  metadata->>'converted_by' AS converted_by,
  created_at
FROM public.site_registration_checkouts
WHERE lower(establishment_name) LIKE '%testebitelo10%'
   OR lower(email) LIKE '%testebitelo10%'
   OR partner_referral_code = 'BITELO10'
ORDER BY created_at DESC
LIMIT 5;

-- 2) Estabelecimento indicado (referred)
SELECT
  e.id,
  e.name,
  e.code,
  e.payment_status,
  e.payment_due_date,
  e.payment_paid_at,
  e.plan_prata_active,
  e.is_blocked,
  e.is_deleted,
  e.created_at
FROM public.establishments e
WHERE lower(e.name) LIKE '%testebitelo10%'
ORDER BY e.created_at DESC
LIMIT 5;

-- 3) Vínculo partner_referrals
SELECT
  pr.id,
  pr.referral_code,
  pr.status,
  pr.selected_plan,
  pr.linked_at,
  pr.site_registration_checkout_id,
  pr.first_payment_id,
  partner.name AS parceiro,
  referred.name AS indicado
FROM public.partner_referrals pr
LEFT JOIN public.establishments partner ON partner.id = pr.partner_establishment_id
LEFT JOIN public.establishments referred ON referred.id = pr.referred_establishment_id
WHERE pr.referral_code = 'BITELO10'
   OR lower(referred.name) LIKE '%testebitelo10%'
ORDER BY pr.created_at DESC
LIMIT 10;

-- 4) Dono do cupom BITELO10
SELECT
  prc.code,
  prc.is_active,
  e.id AS partner_establishment_id,
  e.name AS partner_name,
  e.owner_id
FROM public.partner_referral_codes prc
JOIN public.establishments e ON e.id = prc.establishment_id
WHERE prc.code = 'BITELO10';

-- 5) Colunas da Fase 2 existem?
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'site_registration_checkouts'
  AND column_name IN (
    'partner_referral_code',
    'partner_establishment_id',
    'original_amount_cents',
    'discount_percent',
    'final_amount_cents'
  )
ORDER BY column_name;

-- 6) Tabela partner_referrals existe?
SELECT to_regclass('public.partner_referrals') AS partner_referrals_table;
