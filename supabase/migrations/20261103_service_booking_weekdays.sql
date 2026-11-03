-- Dias em que o cliente pode agendar um serviço pelo link (pedido da 7584: corte infantil só nos
-- dias mais tranquilos).
--
-- O que muda: só acrescenta um campo opcional. Não remove nem altera dado existente, e não mexe em
-- RLS. Vazio = todos os dias, então nenhuma barbearia muda sem marcar a opção.
-- Sem este campo, o sistema funciona como antes (src/utils/serviceBookingDays.ts).
ALTER TABLE public.service_subcategories
  ADD COLUMN IF NOT EXISTS booking_weekdays TEXT[] NULL;

COMMENT ON COLUMN public.service_subcategories.booking_weekdays
  IS 'Dias em que o cliente pode agendar pelo link (monday..sunday). NULL = todos os dias. Não vale para o painel.';
