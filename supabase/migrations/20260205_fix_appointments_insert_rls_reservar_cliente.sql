-- Corrige RLS na tabela appointments para "Reservar Cliente" não falhar com 42501.
-- O dono do estabelecimento precisa poder INSERT mesmo quando client_id é de outro (cliente avulso/manual).
-- Garante a função is_owner_of_establishment e uma policy de INSERT que permita:
-- 1) Cliente criando seu próprio agendamento (auth.uid() = client_id)
-- 2) Dono do estabelecimento criando qualquer agendamento (is_owner_of_establishment(establishment_id))

BEGIN;

-- Garantir que a função exista (pode ter sido criada em migrations anteriores)
CREATE OR REPLACE FUNCTION public.is_owner_of_establishment(p_establishment_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.owner_id = auth.uid()
  )
$$;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Remover todas as políticas de INSERT conhecidas (evita conflito ou policy antiga restritiva)
DROP POLICY IF EXISTS "Create appointments if authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Create appointments (client or owner)" ON public.appointments;
DROP POLICY IF EXISTS "Create appointments" ON public.appointments;

-- Uma única policy de INSERT: cliente OU dono do estabelecimento
CREATE POLICY "Create appointments (client or owner)"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    OR public.is_owner_of_establishment(establishment_id)
  );

COMMIT;
