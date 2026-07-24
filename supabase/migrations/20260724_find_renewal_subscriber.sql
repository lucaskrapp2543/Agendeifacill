-- ============================================================================
-- Renovação de assinatura no booking (anônimo) — busca SEGURA de assinante
-- ----------------------------------------------------------------------------
-- PROBLEMA: o botão "Renovar" do booking busca o assinante direto na tabela
-- client_subscriptions, que é (corretamente) protegida contra leitura anônima.
-- A busca volta sempre vazia -> "Não encontramos assinante" para TODO mundo.
--
-- SOLUÇÃO: função SECURITY DEFINER estreita (mesmo padrão das funções de
-- agendamento da migração 20260722):
--   * exige o par plano + telefone (não permite listar/enumerar assinantes)
--   * compara pelos ÚLTIMOS 8 dígitos (tolerante a 55/9º dígito/máscara)
--   * devolve APENAS: found + nome MASCARADO (ex.: "K******") — nenhum dado
--     pessoal completo sai para o navegador (melhor que o fluxo antigo, que
--     expunha o nome completo)
--
-- IMPACTO: aditivo. Não altera tabela, policy, grant ou dado existente.
-- RISCO: baixíssimo. ROLLBACK: DROP FUNCTION no fim do arquivo.
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
BEGIN
  IF length(v_digits) < 8 THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  v_tail := right(v_digits, 8);

  SELECT cs.subscriber_name
    INTO v_name
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
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_renewal_subscriber(uuid, text, text) TO anon, authenticated;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.find_renewal_subscriber(uuid, text, text);
