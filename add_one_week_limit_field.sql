-- Adicionar campo para limitar assinantes a 1 agendamento por semana
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS limit_subscribers_one_week BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.limit_subscribers_one_week IS 'Se true, assinantes só podem ter 1 agendamento por semana. Podem cancelar e reagendar.';
