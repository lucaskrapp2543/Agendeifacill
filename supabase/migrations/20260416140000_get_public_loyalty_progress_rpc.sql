-- Permite ao fluxo de reserva pública (BookingChatFlow) exibir progresso de fidelidade
-- sem abrir SELECT na tabela para anon (RLS continua restrito ao dono).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_progress(
  p_establishment_id uuid,
  p_client_whatsapp text
)
RETURNS TABLE (
  cycle_goal integer,
  cycle_progress integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ecl.cycle_goal, ecl.cycle_progress
  FROM public.establishment_client_loyalty ecl
  WHERE ecl.establishment_id = p_establishment_id
    AND ecl.client_whatsapp = public.loyalty_whatsapp_storage_key(p_client_whatsapp)
    AND ecl.cycle_goal IS NOT NULL
    AND ecl.cycle_goal >= 2
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_public_loyalty_progress(uuid, text) IS
  'Leitura segura do progresso de fidelidade para o resumo do agendamento público (sem expor a tabela via RLS).';

REVOKE ALL ON FUNCTION public.get_public_loyalty_progress(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_progress(uuid, text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
