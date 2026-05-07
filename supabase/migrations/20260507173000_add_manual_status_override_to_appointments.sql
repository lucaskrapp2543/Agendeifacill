-- Permite override manual de status para impedir auto-conclusão forçada.
-- Compatível e idempotente.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS manual_status_override boolean NOT NULL DEFAULT false;

-- Índice opcional para acelerar auto-conclusão e filtros por status.
CREATE INDEX IF NOT EXISTS idx_appointments_est_status_manual_override
  ON public.appointments (establishment_id, appointment_date, status, manual_status_override);

COMMIT;

NOTIFY pgrst, 'reload schema';
