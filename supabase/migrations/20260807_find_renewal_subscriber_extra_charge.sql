-- ============================================================================
-- Renovação no booking passa a cobrar o VALOR EXTRA do assinante
-- ----------------------------------------------------------------------------
-- PROBLEMA: o barbeiro coloca um valor extra no assinante (plano R$ 16 + extra
-- R$ 50 = R$ 66). O painel mostra R$ 66 certinho, mas o booking, na hora do
-- cliente renovar, continuava cobrando R$ 16 — o extra não chegava na cobrança,
-- que é justamente o objetivo da funcionalidade.
--
-- CAUSA: client_subscriptions é (corretamente) protegida contra leitura anônima,
-- então o booking não enxerga extra_charge_value. Ele só sabe o valor do PLANO.
-- A única porta que o booking tem para esse dado é esta função SECURITY DEFINER.
--
-- SOLUÇÃO: devolver também o extra na resposta. Continua sem expor dado pessoal:
-- só o nome mascarado, o valor do extra e o rótulo que o próprio barbeiro
-- escreveu (ex.: "serviço x a mais") — o cliente vê isso na tela de pagamento
-- de qualquer forma, para saber o que está pagando.
--
-- Aditivo: só ADICIONA campos na resposta. Versões antigas do site ignoram os
-- campos novos e seguem funcionando. Reversível (rollback no fim).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_renewal_subscriber(
  p_establishment_id uuid,
  p_subscription_id text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_tail   text;
  v_name   text;
  v_extra_value numeric(10,2);
  v_extra_label text;
BEGIN
  IF length(v_digits) < 8 THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  v_tail := right(v_digits, 8);

  SELECT cs.subscriber_name, cs.extra_charge_value, cs.extra_charge_label
    INTO v_name, v_extra_value, v_extra_label
  FROM public.client_subscriptions cs
  WHERE cs.establishment_id = p_establishment_id
    AND cs.subscription_id::text = p_subscription_id
    AND (
      right(regexp_replace(coalesce(cs.subscriber_whatsapp, ''), '\D', '', 'g'), 8) = v_tail
      OR right(regexp_replace(coalesce(cs.client_whatsapp, ''), '\D', '', 'g'), 8) = v_tail
    )
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'masked_name',
    CASE
      WHEN coalesce(btrim(v_name), '') = '' THEN 'Assinante'
      ELSE left(btrim(v_name), 1) || '******'
    END,
    -- Extra fixo deste assinante (0 quando não houver)
    'extra_charge_value', coalesce(v_extra_value, 0),
    'extra_charge_label', coalesce(nullif(btrim(coalesce(v_extra_label, '')), ''), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_renewal_subscriber(uuid, text, text) TO anon, authenticated;

-- ============================================================================
-- ROLLBACK: reaplicar a versão anterior (20260724_find_renewal_subscriber.sql),
-- que devolve apenas found + masked_name.
-- ============================================================================
