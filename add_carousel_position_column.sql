-- Adicionar coluna carousel_position na tabela establishments
-- Esta coluna controla onde o carrossel de fotos aparece na página de agendamentos

ALTER TABLE establishments 
ADD COLUMN carousel_position TEXT DEFAULT 'behind' CHECK (carousel_position IN ('behind', 'below'));

-- Comentário explicativo
COMMENT ON COLUMN establishments.carousel_position IS 'Posição do carrossel de fotos: behind (atrás do perfil) ou below (embaixo do perfil)';

-- Atualizar registros existentes para usar o valor padrão 'behind'
UPDATE establishments 
SET carousel_position = 'behind' 
WHERE carousel_position IS NULL;

