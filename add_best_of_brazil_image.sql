-- Adicionar coluna para controlar exibição da imagem "Melhor do Brasil"
ALTER TABLE establishments 
ADD COLUMN show_best_of_brazil_image BOOLEAN DEFAULT TRUE;

-- Comentário explicativo
COMMENT ON COLUMN establishments.show_best_of_brazil_image IS 'Quando true, exibe a imagem melhordobrasil.png acima do carrossel na página de agendamento';
