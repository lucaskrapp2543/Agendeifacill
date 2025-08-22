-- Executar migração para adicionar campo de foto aos profissionais
-- Execute este arquivo no seu banco de dados Supabase

-- Adicionar campo de foto aos profissionais
ALTER TABLE professionals 
ADD COLUMN photo_url TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN professionals.photo_url IS 'URL da foto do profissional. Se NULL, usa foto padrão (fotopessoa.png)';

-- Verificar se a migração foi aplicada
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'professionals' AND column_name = 'photo_url';
