-- Garante que qualquer usuário autenticado consiga INSERIR em appointments.
-- Isso evita erro intermitente no "Reservar Cliente" quando a policy antiga está restritiva.

BEGIN;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Create appointments if authenticated"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;

