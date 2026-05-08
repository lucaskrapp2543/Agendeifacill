-- Permite ligar/desligar auto conclusao de atendimentos por estabelecimento.
-- true  = comportamento atual (conclui automaticamente ao terminar horario).
-- false = barbeiro conclui manualmente.

BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS auto_complete_services_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.establishments.auto_complete_services_enabled IS
  'Se true, conclui automaticamente atendimentos pendentes/confirmados quando o horario termina.';

COMMIT;

NOTIFY pgrst, 'reload schema';
