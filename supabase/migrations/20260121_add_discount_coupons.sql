-- Cupons de desconto (por estabelecimento)
-- - Até 20 cupons por estabelecimento (server-side)
-- - Validação no booking via RPC (não expõe lista publicamente)
-- - Registro de uso: incrementa usage_count ao criar agendamento com cupom

BEGIN;

-- =========================
-- 1) TABELA
-- =========================
CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Código único por estabelecimento (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'discount_coupons_establishment_code_unique'
  ) THEN
    CREATE UNIQUE INDEX discount_coupons_establishment_code_unique
      ON public.discount_coupons (establishment_id, lower(code));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS discount_coupons_establishment_active_idx
  ON public.discount_coupons (establishment_id, is_active);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discount_coupons_updated_at ON public.discount_coupons;
CREATE TRIGGER trg_discount_coupons_updated_at
BEFORE UPDATE ON public.discount_coupons
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Limite de 20 cupons por estabelecimento (server-side)
CREATE OR REPLACE FUNCTION public.enforce_discount_coupon_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.discount_coupons
  WHERE establishment_id = NEW.establishment_id;

  IF cnt >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 cupons atingido para este estabelecimento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_discount_coupon_limit ON public.discount_coupons;
CREATE TRIGGER trg_enforce_discount_coupon_limit
BEFORE INSERT ON public.discount_coupons
FOR EACH ROW
EXECUTE FUNCTION public.enforce_discount_coupon_limit();

-- =========================
-- 2) CAMPOS NO AGENDAMENTO
-- =========================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS coupon_code TEXT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS coupon_discount_percent NUMERIC(5,2) NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS coupon_discount_amount NUMERIC(10,2) NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS price_original NUMERIC(10,2) NULL;

-- Ao inserir agendamento com cupom, incrementar usage_count
CREATE OR REPLACE FUNCTION public.increment_coupon_usage_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.coupon_code IS NULL OR btrim(NEW.coupon_code) = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.discount_coupons
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE establishment_id = NEW.establishment_id
    AND lower(code) = lower(btrim(NEW.coupon_code));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_coupon_usage_from_appointment ON public.appointments;
CREATE TRIGGER trg_increment_coupon_usage_from_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.increment_coupon_usage_from_appointment();

-- =========================
-- 3) RPC PARA VALIDAR CUPOM (público)
-- =========================
CREATE OR REPLACE FUNCTION public.validate_discount_coupon(
  p_establishment_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  valid BOOLEAN,
  discount_percent NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT true, dc.discount_percent
  FROM public.discount_coupons dc
  WHERE dc.establishment_id = p_establishment_id
    AND dc.is_active = true
    AND lower(dc.code) = lower(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::NUMERIC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_coupon(UUID, TEXT) TO anon, authenticated;

-- =========================
-- 4) RLS (donos gerenciam)
-- =========================
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage discount coupons" ON public.discount_coupons;
CREATE POLICY "Owners can manage discount coupons"
ON public.discount_coupons
FOR ALL
USING (
  establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_id = auth.uid()
  )
);

COMMIT;

