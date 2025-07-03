-- Habilita RLS nas tabelas
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas existentes para começar do zero
DROP POLICY IF EXISTS "Permitir upload de logo pelo dono do estabelecimento" ON storage.objects;
DROP POLICY IF EXISTS "Permitir visualização pública da logo" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualização de logo pelo dono" ON storage.objects;
DROP POLICY IF EXISTS "Permitir deleção de logo pelo dono" ON storage.objects;

-- Política básica para permitir operações no bucket
CREATE POLICY "Permitir gerenciamento de bucket"
ON storage.buckets FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Política para permitir visualização pública dos buckets
CREATE POLICY "Permitir visualização pública de buckets"
ON storage.buckets FOR SELECT TO public
USING (true);

-- Política para permitir upload de arquivos
CREATE POLICY "Permitir upload de logo pelo dono do estabelecimento"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'establishment-photos'
);

-- Política para permitir atualização de arquivos
CREATE POLICY "Permitir atualização de logo pelo dono"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'establishment-photos'
);

-- Política para permitir deleção de arquivos
CREATE POLICY "Permitir deleção de logo pelo dono"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'establishment-photos'
);

-- Política para permitir visualização pública
CREATE POLICY "Permitir visualização pública da logo"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'establishment-photos'); 