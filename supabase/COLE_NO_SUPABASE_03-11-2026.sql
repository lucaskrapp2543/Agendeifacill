-- Agendei Fácil, 03/11/2026. Cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.
-- Não apaga nem altera nenhum dado e não mexe em RLS. Cria uma função e acrescenta um campo opcional na tabela de serviços.

-- ===== 1) Limite de assinante no link público (6008) =====
-- Limite de assinante no link público (cliente sem login).
--
-- Motivo: a RLS de client_subscriptions só libera a conta da barbearia. Sem login, a conta do
-- limite não achava a assinatura e contava o mês inteiro, ignorando início, renovação, assinatura
-- contínua e bônus. Caso real: assinante da 6008 barrado com "limite atingido" e o painel mostrando
-- 2 restantes.
--
-- O que muda: só cria esta função. Não altera tabela, policy nem dado. Devolve apenas os campos da
-- contagem (sem nome e sem telefone) para quem já informou telefone + barbearia, o mesmo nível de
-- exposição de check_subscriber_by_whatsapp, que já é pública.
--
-- Sem esta função, o código segue exatamente como antes (src/utils/monthlyLimitValidation.ts).
CREATE OR REPLACE FUNCTION public.get_subscriber_limit_context_by_whatsapp(
  p_whatsapp_candidates TEXT[],
  p_establishment_id TEXT,
  p_target_date DATE
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'start_date', cs.start_date,
    'end_date', cs.end_date,
    'payment_status', cs.payment_status,
    'last_payment_date', cs.last_payment_date,
    'usage_reset_at', cs.usage_reset_at,
    'monthly_limit', cs.monthly_limit,
    'bonus_credits', cs.bonus_credits,
    'subscriptions', jsonb_build_object(
      'name', s.name,
      'divide_services_enabled', s.divide_services_enabled,
      'divided_services', s.divided_services
    )
  )
  FROM public.client_subscriptions cs
  JOIN public.subscriptions s ON s.id = cs.subscription_id
  WHERE cs.establishment_id::TEXT = p_establishment_id
    AND (
      cs.client_whatsapp = ANY (p_whatsapp_candidates)
      OR cs.subscriber_whatsapp = ANY (p_whatsapp_candidates)
    )
    AND cs.end_date >= p_target_date
    AND cs.start_date <= p_target_date
  -- Mesma prioridade da leitura direta do painel: primeiro client_whatsapp, depois subscriber_whatsapp.
  ORDER BY COALESCE(cs.client_whatsapp = ANY (p_whatsapp_candidates), FALSE) DESC, cs.created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_subscriber_limit_context_by_whatsapp(TEXT[], TEXT, DATE)
  IS 'Campos da contagem do limite do assinante para o booking sem login. Não devolve nome nem telefone.';

REVOKE ALL ON FUNCTION public.get_subscriber_limit_context_by_whatsapp(TEXT[], TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscriber_limit_context_by_whatsapp(TEXT[], TEXT, DATE) TO anon, authenticated, service_role;

-- ===== 2) Dias por serviço (7584) =====
-- Dias em que o cliente pode agendar um serviço pelo link (pedido da 7584: corte infantil só nos
-- dias mais tranquilos).
--
-- O que muda: só acrescenta um campo opcional. Não remove nem altera dado existente, e não mexe em
-- RLS. Vazio = todos os dias, então nenhuma barbearia muda sem marcar a opção.
-- Sem este campo, o sistema funciona como antes (src/utils/serviceBookingDays.ts).
ALTER TABLE public.service_subcategories
  ADD COLUMN IF NOT EXISTS booking_weekdays TEXT[] NULL;

COMMENT ON COLUMN public.service_subcategories.booking_weekdays
  IS 'Dias em que o cliente pode agendar pelo link (monday..sunday). NULL = todos os dias. Não vale para o painel.';
