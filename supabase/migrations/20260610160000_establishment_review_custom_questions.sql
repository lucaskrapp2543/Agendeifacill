-- Perguntas personalizadas na avaliação do booking + respostas snapshot na review.

CREATE TABLE IF NOT EXISTS public.establishment_review_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  question_text text NOT NULL CHECK (
    char_length(btrim(question_text)) > 0
    AND char_length(question_text) <= 200
  ),
  answer_type text NOT NULL CHECK (answer_type IN ('yes_no', 'rating_1_5', 'short_text')),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_establishment_review_questions_establishment
  ON public.establishment_review_questions (establishment_id, is_active, display_order, created_at);

ALTER TABLE public.establishment_review_questions ENABLE ROW LEVEL SECURITY;

-- Leitura pública: apenas perguntas ativas (fluxo do cliente no booking).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_review_questions'
      AND policyname = 'review_questions_select_public_active'
  ) THEN
    CREATE POLICY review_questions_select_public_active
      ON public.establishment_review_questions
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Dono vê todas as perguntas do estabelecimento.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_review_questions'
      AND policyname = 'review_questions_select_owner_all'
  ) THEN
    CREATE POLICY review_questions_select_owner_all
      ON public.establishment_review_questions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.establishments e
          WHERE e.id = establishment_review_questions.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_review_questions'
      AND policyname = 'review_questions_insert_owner'
  ) THEN
    CREATE POLICY review_questions_insert_owner
      ON public.establishment_review_questions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.establishments e
          WHERE e.id = establishment_review_questions.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_review_questions'
      AND policyname = 'review_questions_update_owner'
  ) THEN
    CREATE POLICY review_questions_update_owner
      ON public.establishment_review_questions
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.establishments e
          WHERE e.id = establishment_review_questions.establishment_id
            AND e.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.establishments e
          WHERE e.id = establishment_review_questions.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_review_questions'
      AND policyname = 'review_questions_delete_owner'
  ) THEN
    CREATE POLICY review_questions_delete_owner
      ON public.establishment_review_questions
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.establishments e
          WHERE e.id = establishment_review_questions.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Respostas snapshot na avaliação (compatível com reviews antigas = null/[]).
ALTER TABLE public.establishment_reviews
  ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Profissional atendente (snapshot no envio; profissionais ficam no JSON do estabelecimento).
ALTER TABLE public.establishment_reviews
  ADD COLUMN IF NOT EXISTS professional_id text,
  ADD COLUMN IF NOT EXISTS professional_name text,
  ADD COLUMN IF NOT EXISTS professional_photo_url text;

COMMENT ON TABLE public.establishment_review_questions IS
  'Perguntas personalizadas exibidas no fluxo de avaliação do booking (até 5 por estabelecimento).';

COMMENT ON COLUMN public.establishment_reviews.custom_answers IS
  'Snapshot das respostas às perguntas personalizadas no envio da avaliação.';

COMMENT ON COLUMN public.establishment_reviews.professional_id IS
  'ID do profissional selecionado pelo cliente na avaliação (snapshot).';

COMMENT ON COLUMN public.establishment_reviews.professional_name IS
  'Nome do profissional no momento da avaliação (snapshot para exibição após aprovação).';

COMMENT ON COLUMN public.establishment_reviews.professional_photo_url IS
  'Foto do profissional no momento da avaliação (snapshot para exibição após aprovação).';
