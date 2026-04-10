-- Gorjeta do profissional: 100% para o barbeiro, fora da % sobre o serviço.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS professional_tip_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.appointments.professional_tip_amount IS 'Gorjeta registrada no card do agendamento; soma ao líquido do profissional sem aplicar o percentual de comissão sobre o serviço.';
