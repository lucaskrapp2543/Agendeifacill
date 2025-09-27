-- Adicionar campo para punir cliente ao cancelar agendamento
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS punish_client_on_cancel BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.punish_client_on_cancel IS 'Se true, cliente que cancela só pode reagendar no próprio dia com disponibilidade na mesma semana.';




