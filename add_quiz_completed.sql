-- Adicionar coluna quiz_completed na tabela establishments
-- Esta coluna controla se o quiz passo-a-passo foi completado

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS quiz_completed BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.quiz_completed IS 'Se true, indica que o quiz passo-a-passo foi completado e não deve mais aparecer';


