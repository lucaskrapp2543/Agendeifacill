-- FIX — cria vínculo partner_referrals que faltou após pagamento (teste BITELO10 / testebitelo10).
-- Cole no Supabase SQL Editor do MESMO projeto que o localhost usa (.env VITE_SUPABASE_URL).
-- NÃO é o arquivo *_DEBUG.sql (aquele só consulta, não altera nada).
--
-- PASSO 0 — rode só isto primeiro (SELECT). Se retornar 0 linhas, você está no projeto Supabase ERRADO.
-- SELECT id, status, establishment_name, partner_referral_code, created_establishment_id, created_at
-- FROM public.site_registration_checkouts
-- WHERE lower(establishment_name) LIKE '%testebitelo10%'
--    OR partner_referral_code = 'BITELO10'
-- ORDER BY created_at DESC LIMIT 5;

BEGIN;

DO $$
DECLARE
  v_checkout record;
  v_inserted_id uuid;
BEGIN
  -- Busca pelo nome/cupom (não depende de UUID fixo)
  SELECT *
  INTO v_checkout
  FROM public.site_registration_checkouts c
  WHERE lower(coalesce(c.establishment_name, '')) LIKE '%testebitelo10%'
     OR lower(coalesce(c.email, '')) LIKE '%testebitelo10%'
     OR (
       upper(trim(coalesce(c.partner_referral_code, ''))) = 'BITELO10'
       AND c.status = 'converted'
       AND c.created_at > now() - interval '30 days'
     )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION E'Nenhum checkout testebitelo10/BITELO10 neste projeto Supabase.\n'
      'O pagamento do localhost provavelmente foi para OUTRO projeto (confira VITE_SUPABASE_URL no .env).\n'
      'No dashboard Supabase: Settings → General → Reference ID deve bater com o .env.';
  END IF;

  IF lower(coalesce(v_checkout.status, '')) <> 'converted' THEN
    RAISE EXCEPTION 'Checkout % encontrado mas status=% (precisa converted).',
      v_checkout.id, v_checkout.status;
  END IF;

  IF v_checkout.created_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Checkout % sem created_establishment_id.', v_checkout.id;
  END IF;

  IF coalesce(v_checkout.partner_referral_code, '') = '' OR v_checkout.partner_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Checkout % sem cupom/parceiro (code=%, partner=%).',
      v_checkout.id, v_checkout.partner_referral_code, v_checkout.partner_establishment_id;
  END IF;

  IF v_checkout.partner_establishment_id = v_checkout.created_establishment_id THEN
    RAISE EXCEPTION 'Auto-indicação bloqueada (mesmo establishment).';
  END IF;

  RAISE NOTICE 'Usando checkout_id=% establishment=%', v_checkout.id, v_checkout.establishment_name;

  INSERT INTO public.partner_referrals (
    partner_establishment_id,
    referred_establishment_id,
    referral_code,
    selected_plan,
    status,
    linked_at,
    first_payment_id,
    site_registration_checkout_id,
    updated_at
  )
  VALUES (
    v_checkout.partner_establishment_id,
    v_checkout.created_establishment_id,
    upper(trim(v_checkout.partner_referral_code)),
    'diamante',
    'active',
    coalesce(v_checkout.converted_at, now()),
    nullif(trim(v_checkout.payment_id::text), ''),
    v_checkout.id,
    now()
  )
  ON CONFLICT (referred_establishment_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RAISE NOTICE 'Vínculo já existia (ON CONFLICT). Nada inserido.';
  ELSE
    RAISE NOTICE 'Vínculo criado: partner_referrals.id=%', v_inserted_id;
  END IF;

  UPDATE public.site_registration_checkouts
  SET
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'partner_referral_linked', true,
      'partner_referral_reason', 'manual_backfill_fix',
      'partner_referral_retry_at', now()
    ),
    updated_at = now()
  WHERE id = v_checkout.id;
END $$;

-- Confirmação (deve retornar 1 linha)
SELECT
  pr.id AS referral_id,
  pr.referral_code,
  pr.status,
  pr.linked_at,
  partner.name AS parceiro,
  referred.name AS indicado,
  public.count_partner_active_referrals(pr.partner_establishment_id) AS ativos_parceiro
FROM public.partner_referrals pr
JOIN public.establishments partner ON partner.id = pr.partner_establishment_id
JOIN public.establishments referred ON referred.id = pr.referred_establishment_id
WHERE lower(referred.name) LIKE '%testebitelo10%'
   OR pr.referral_code = 'BITELO10'
ORDER BY pr.created_at DESC
LIMIT 5;

COMMIT;
