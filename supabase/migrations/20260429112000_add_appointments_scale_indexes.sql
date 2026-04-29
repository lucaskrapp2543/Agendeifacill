-- Escalabilidade de consultas de agenda por estabelecimento.
-- Seguro para compatibilidade: apenas adiciona índices (não altera dados/colunas/fluxos).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_appointments_establishment_date
  ON public.appointments (establishment_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_establishment_date_status
  ON public.appointments (establishment_id, appointment_date, status);

COMMIT;

NOTIFY pgrst, 'reload schema';
