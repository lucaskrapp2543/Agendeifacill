-- Adiciona coluna pin_password na tabela establishments
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS pin_password VARCHAR(4);

-- Adiciona política de segurança para o campo pin_password
CREATE POLICY "Usuários podem atualizar seu próprio pin_password"
ON establishments
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Garante que o pin_password só aceita números
ALTER TABLE establishments 
ADD CONSTRAINT pin_password_format 
CHECK (pin_password ~ '^[0-9]{4}$' OR pin_password IS NULL); 