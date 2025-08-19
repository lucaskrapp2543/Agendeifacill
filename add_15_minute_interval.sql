-- Adicionar coluna para configuração de intervalo de 15 minutos
ALTER TABLE establishments 
ADD COLUMN use_15_minute_interval BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN establishments.use_15_minute_interval IS 'Quando true, os horários aparecem de 30 em 30 min com intervalo de 15 min entre serviços';
