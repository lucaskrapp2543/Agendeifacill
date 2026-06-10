-- Vincula atendimento de assinatura ao agendamento (cancelamento reverte financeiro com precisão).
ALTER TABLE public.subscriber_attendances
  ADD COLUMN IF NOT EXISTS appointment_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriber_attendances_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.subscriber_attendances
      ADD CONSTRAINT subscriber_attendances_appointment_id_fkey
      FOREIGN KEY (appointment_id)
      REFERENCES public.appointments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriber_attendances_appointment_id
  ON public.subscriber_attendances(appointment_id)
  WHERE appointment_id IS NOT NULL;

COMMENT ON COLUMN public.subscriber_attendances.appointment_id IS
  'Agendamento que originou o atendimento de assinatura (permite reverter financeiro ao cancelar).';
