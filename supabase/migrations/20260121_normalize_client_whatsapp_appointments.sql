-- Normalizar appointments.client_whatsapp para padrão BR (55 + DDD + número), só dígitos
-- Objetivo: evitar falhas de provedor (422) por formato inconsistente.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_digits(v text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(coalesce(v, ''), '\D', '', 'g');
  IF digits IS NULL OR length(digits) = 0 THEN
    RETURN NULL;
  END IF;

  -- Se já começa com 55 e tem tamanho esperado (12/13), mantém
  IF left(digits, 2) = '55' AND (length(digits) = 12 OR length(digits) = 13) THEN
    RETURN digits;
  END IF;

  -- Se tem 10/11 dígitos, assume BR e prefixa 55
  IF length(digits) = 10 OR length(digits) = 11 THEN
    RETURN '55' || digits;
  END IF;

  -- Caso geral: mantém apenas dígitos
  RETURN digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_appointments_normalize_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.client_whatsapp := public.normalize_whatsapp_digits(NEW.client_whatsapp);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_normalize_whatsapp ON public.appointments;
CREATE TRIGGER trg_appointments_normalize_whatsapp
BEFORE INSERT OR UPDATE OF client_whatsapp
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trg_appointments_normalize_whatsapp();

-- Backfill (não altera null/vazio)
UPDATE public.appointments
SET client_whatsapp = public.normalize_whatsapp_digits(client_whatsapp)
WHERE client_whatsapp IS NOT NULL
  AND btrim(client_whatsapp) <> ''
  AND client_whatsapp <> public.normalize_whatsapp_digits(client_whatsapp);

COMMIT;

NOTIFY pgrst, 'reload schema';

