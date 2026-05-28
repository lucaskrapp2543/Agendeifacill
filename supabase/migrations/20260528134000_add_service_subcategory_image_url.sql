-- Foto opcional para serviços no Booking.
-- Mantém compatibilidade: sem foto, o fluxo antigo segue exatamente igual.

ALTER TABLE public.service_subcategories
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.service_subcategories.image_url IS
'URL/caminho público da foto otimizada do serviço. Opcional; não salva base64 no banco.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'establishment-assets',
  'establishment-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Observação:
-- Não alteramos storage.objects aqui porque alguns projetos Supabase não permitem
-- ALTER/CREATE POLICY nessa tabela interna pelo SQL Editor comum ("must be owner").
-- O bucket establishment-assets já é usado pelo sistema para fotos de produtos/profissionais.
