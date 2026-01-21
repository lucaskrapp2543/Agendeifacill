-- Fila de espera: permitir 1 ou mais serviços por entrada
-- Mantém compatibilidade com colunas atuais:
-- - service_name (texto): passa a ser o nome combinado (ex: "Corte + Sobrancelha")
-- - service_price (num): passa a ser o total
-- - service_duration_minutes (int): passa a ser o total
-- Novas colunas armazenam detalhes do(s) serviço(s) selecionado(s)

BEGIN;

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS service_ids TEXT[] NULL;

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS services_json JSONB NULL;

COMMIT;

