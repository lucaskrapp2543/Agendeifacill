-- ============================================================================
-- "Bloquear cliente" (Meus Clientes → Ver mais).
-- ----------------------------------------------------------------------------
-- MOTIVO: o dono quer impedir um cliente de agendar sem ele perceber. Com o
-- bloqueio ligado, em qualquer página de agendamento (completa, chat ou
-- simples) esse cliente vê todos os dias como LOTADOS.
--
-- O QUE FAZ:
--   1) Uma coluna nova em manual_clients (desligada para todo mundo).
--   2) Uma função que responde SÓ "sim/não" para "esse telefone está bloqueado
--      nesta barbearia?" — não devolve nome, número nem nada do cliente.
--
-- RISCO: nenhum para os dados existentes (ADD COLUMN com padrão false; não
-- mexe em policies, triggers nem outras colunas). Se a função falhar por
-- qualquer motivo, o agendamento segue normal (o cliente NÃO é bloqueado).
-- ============================================================================
ALTER TABLE public.manual_clients
  ADD COLUMN IF NOT EXISTS booking_blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.public_is_client_booking_blocked(p_establishment_id uuid, p_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manual_clients m
    WHERE m.establishment_id = p_establishment_id
      AND m.booking_blocked = true
      AND length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 8
      AND right(regexp_replace(coalesce(m.whatsapp, ''), '\D', '', 'g'), 9)
        = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.public_is_client_booking_blocked(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_is_client_booking_blocked(uuid, text) TO anon, authenticated, service_role;

-- Conferência (rodar depois): deve devolver false
-- SELECT public.public_is_client_booking_blocked('00000000-0000-0000-0000-000000000000', '11999999999');
