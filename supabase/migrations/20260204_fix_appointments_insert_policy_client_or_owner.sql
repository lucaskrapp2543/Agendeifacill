-- Ajusta policy de INSERT em appointments para:
-- - permitir o CLIENTE logado criar (Booking público): auth.uid() = client_id
-- - permitir o DONO do estabelecimento criar reservas internas (Reservar Cliente),
--   mesmo quando client_id é o UUID do cliente escolhido.

BEGIN;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Remover policy permissiva (se existir)
DROP POLICY IF EXISTS "Create appointments if authenticated" ON public.appointments;

-- Criar policy correta (cliente OU dono do estabelecimento)
CREATE POLICY "Create appointments (client or owner)"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    OR public.is_owner_of_establishment(establishment_id)
  );

COMMIT;

