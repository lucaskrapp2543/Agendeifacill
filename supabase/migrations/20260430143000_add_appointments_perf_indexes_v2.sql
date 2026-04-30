-- Etapa 5 (banco-first): índices adicionais para reduzir gargalo de appointments
-- Compatibilidade: só adiciona índices, sem alterar dados/colunas/fluxos.

BEGIN;

-- Acelera leituras por estabelecimento + status + período (muito comum no dashboard/financeiro)
CREATE INDEX IF NOT EXISTS idx_appointments_establishment_status_date
  ON public.appointments (establishment_id, status, appointment_date);

-- Acelera leituras por profissional dentro do estabelecimento por período
CREATE INDEX IF NOT EXISTS idx_appointments_establishment_professional_date
  ON public.appointments (establishment_id, professional, appointment_date);

-- Acelera agenda diária com ordenação por horário após filtrar por estabelecimento+data
CREATE INDEX IF NOT EXISTS idx_appointments_establishment_date_time
  ON public.appointments (establishment_id, appointment_date, appointment_time);

COMMIT;

NOTIFY pgrst, 'reload schema';
