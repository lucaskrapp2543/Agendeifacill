-- Criar bucket para assets dos estabelecimentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'establishment-assets',
  'establishment-assets',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Criar política RLS para permitir upload de arquivos
CREATE POLICY "Estabelecimentos podem fazer upload de assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'establishment-assets' AND
  auth.uid() IN (
    SELECT owner_id FROM establishments WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Criar política RLS para permitir visualização pública
CREATE POLICY "Assets dos estabelecimentos são públicos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'establishment-assets');

-- Criar política RLS para permitir atualização de arquivos
CREATE POLICY "Estabelecimentos podem atualizar seus assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'establishment-assets' AND
  auth.uid() IN (
    SELECT owner_id FROM establishments WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Criar política RLS para permitir exclusão de arquivos
CREATE POLICY "Estabelecimentos podem excluir seus assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'establishment-assets' AND
  auth.uid() IN (
    SELECT owner_id FROM establishments WHERE id::text = (storage.foldername(name))[1]
  )
);
