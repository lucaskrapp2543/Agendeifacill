-- Atualizar todos os estabelecimentos para ter carousel_position = 'below' como padrão
-- Isso garante que todos os estabelecimentos existentes tenham a configuração "Embaixo do perfil"

UPDATE establishments 
SET carousel_position = 'below' 
WHERE carousel_position IS NULL 
   OR carousel_position = 'behind' 
   OR carousel_position = '';

-- Verificar quantos estabelecimentos foram atualizados
SELECT 
  COUNT(*) as total_updated,
  carousel_position,
  COUNT(*) as count_by_position
FROM establishments 
GROUP BY carousel_position;
