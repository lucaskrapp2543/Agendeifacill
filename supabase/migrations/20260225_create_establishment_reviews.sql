-- Avaliações públicas do booking com moderação pelo estabelecimento.
-- Compatível com bases antigas e com RLS habilitado.

CREATE TABLE IF NOT EXISTS public.establishment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_name text NOT NULL CHECK (char_length(btrim(client_name)) > 0),
  client_phone text NOT NULL CHECK (char_length(regexp_replace(client_phone, '\D', '', 'g')) >= 10),
  review_text text NOT NULL CHECK (
    char_length(btrim(review_text)) > 0
    AND char_length(review_text) <= 200
  ),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  is_approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_establishment_reviews_establishment_id
  ON public.establishment_reviews (establishment_id);

CREATE INDEX IF NOT EXISTS idx_establishment_reviews_public
  ON public.establishment_reviews (establishment_id, is_approved, moderation_status, created_at DESC);

ALTER TABLE public.establishment_reviews ENABLE ROW LEVEL SECURITY;

-- Inserção pública (cliente no booking).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_reviews'
      AND policyname = 'reviews_insert_public'
  ) THEN
    CREATE POLICY reviews_insert_public
      ON public.establishment_reviews
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Leitura pública: somente avaliações aprovadas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_reviews'
      AND policyname = 'reviews_select_public_approved'
  ) THEN
    CREATE POLICY reviews_select_public_approved
      ON public.establishment_reviews
      FOR SELECT
      TO anon, authenticated
      USING (
        is_approved = true
        AND moderation_status = 'approved'
      );
  END IF;
END $$;

-- Dono do estabelecimento pode ver todas as avaliações do próprio estabelecimento.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_reviews'
      AND policyname = 'reviews_select_owner_all'
  ) THEN
    CREATE POLICY reviews_select_owner_all
      ON public.establishment_reviews
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.establishments e
          WHERE e.id = establishment_reviews.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Dono do estabelecimento pode moderar (aprovar/reprovar) avaliações do próprio estabelecimento.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_reviews'
      AND policyname = 'reviews_update_owner_moderation'
  ) THEN
    CREATE POLICY reviews_update_owner_moderation
      ON public.establishment_reviews
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.establishments e
          WHERE e.id = establishment_reviews.establishment_id
            AND e.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.establishments e
          WHERE e.id = establishment_reviews.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;
