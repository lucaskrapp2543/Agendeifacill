-- Migração 1: Adicionar coluna para configuração de intervalo de 15 minutos
ALTER TABLE establishments 
ADD COLUMN use_15_minute_interval BOOLEAN DEFAULT FALSE;

-- Comentário explicativo para intervalo
COMMENT ON COLUMN establishments.use_15_minute_interval IS 'Quando true, os horários aparecem de 30 em 30 min com intervalo de 15 min entre serviços';

-- Migração 2: Adicionar coluna para controlar exibição da imagem "Melhor do Brasil"
ALTER TABLE establishments 
ADD COLUMN show_best_of_brazil_image BOOLEAN DEFAULT TRUE;

-- Comentário explicativo para imagem
COMMENT ON COLUMN establishments.show_best_of_brazil_image IS 'Quando true, exibe a imagem melhordobrasil.png acima do carrossel na página de agendamento';
