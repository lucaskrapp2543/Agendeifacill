-- Controle de faltas por cliente (interno, invisível para o cliente)
-- - Armazena faltas por estabelecimento + telefone
-- - Usado no Dashboard "Meus Clientes"

BEGIN;

-- Helper: dono do estabelecimento (recria caso não exista)
CREATE OR REPLACE FUNCTION public.is_owner_of_establishment(p_establishment_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.owner_id = auth.uid()
  )
$$;

CREATE TABLE IF NOT EXISTS public.client_no_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_whatsapp TEXT NOT NULL,
  misses INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, client_whatsapp)
);

CREATE INDEX IF NOT EXISTS client_no_shows_establishment_whatsapp_idx
  ON public.client_no_shows (establishment_id, client_whatsapp);

-- updated_at trigger (reusa set_updated_at se existir; senão cria)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_client_no_shows_updated_at') THEN
    CREATE TRIGGER trg_client_no_shows_updated_at
    BEFORE UPDATE ON public.client_no_shows
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

ALTER TABLE public.client_no_shows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view client no-shows" ON public.client_no_shows;
CREATE POLICY "Owner can view client no-shows"
  ON public.client_no_shows
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can insert client no-shows" ON public.client_no_shows;
CREATE POLICY "Owner can insert client no-shows"
  ON public.client_no_shows
  FOR INSERT
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can update client no-shows" ON public.client_no_shows;
CREATE POLICY "Owner can update client no-shows"
  ON public.client_no_shows
  FOR UPDATE
  USING (public.is_owner_of_establishment(establishment_id))
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

-- RPC: ajustar faltas (+1 ou -1), sem deixar ficar negativo
CREATE OR REPLACE FUNCTION public.adjust_client_no_show(
  p_establishment_id uuid,
  p_client_whatsapp text,
  p_delta int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_misses int;
BEGIN
  -- Segurança: somente dono do estabelecimento
  IF NOT public.is_owner_of_establishment(p_establishment_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  INSERT INTO public.client_no_shows (establishment_id, client_whatsapp, misses)
  VALUES (p_establishment_id, regexp_replace(coalesce(p_client_whatsapp,''), '\D', '', 'g'), GREATEST(p_delta, 0))
  ON CONFLICT (establishment_id, client_whatsapp)
  DO UPDATE SET misses = GREATEST(public.client_no_shows.misses + p_delta, 0)
  RETURNING misses INTO new_misses;

  RETURN COALESCE(new_misses, 0);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

