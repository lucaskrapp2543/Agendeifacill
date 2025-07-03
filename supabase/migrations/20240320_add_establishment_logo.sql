-- Adiciona o campo logo_url à tabela establishments
ALTER TABLE establishments ADD COLUMN logo_url TEXT;

-- Cria o bucket para armazenar as logos dos estabelecimentos
INSERT INTO storage.buckets (id, name)
VALUES ('establishment-photos', 'establishment-photos')
ON CONFLICT (id) DO NOTHING;

-- Atualiza as políticas de storage para permitir upload da logo
CREATE POLICY "Permitir upload de logo pelo dono do estabelecimento"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'establishment-photos' AND
  EXISTS (
    SELECT 1 FROM establishments
    WHERE id = auth.uid() AND owner_id = auth.uid()
  )
);

-- Atualiza as políticas de storage para permitir visualização pública da logo
CREATE POLICY "Permitir visualização pública da logo"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'establishment-photos'); 