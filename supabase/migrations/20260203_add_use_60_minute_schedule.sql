-- Adiciona opção de horários de 1 em 1 hora no booking
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS use_60_minute_schedule boolean DEFAULT false;

