-- Criar bucket para comprovantes PIX
INSERT INTO storage.buckets (id, name, public)
VALUES ('pix_proofs', 'pix_proofs', true);

-- Criar política para permitir upload de comprovantes
CREATE POLICY "Authenticated users can upload pix proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pix_proofs' AND
  (LOWER(storage.filename(name)) LIKE '%.jpg' OR
   LOWER(storage.filename(name)) LIKE '%.jpeg' OR
   LOWER(storage.filename(name)) LIKE '%.png')
);

-- Criar política para permitir visualização pública dos comprovantes
CREATE POLICY "Public can view pix proofs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'pix_proofs');

-- Criar política para permitir que o estabelecimento exclua comprovantes
CREATE POLICY "Establishment owners can delete their pix proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pix_proofs' AND
  auth.uid() IN (
    SELECT e.owner_id
    FROM appointments a
    JOIN establishments e ON e.id = a.establishment_id
    WHERE a.pix_proof_url LIKE '%' || storage.filename(name) || '%'
  )
); 