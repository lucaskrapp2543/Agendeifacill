-- Verificar uso de dados do establishment código 2020 - Versão Simplificada
-- Primeiro vamos ver quais tabelas existem e depois calcular o uso

-- 1. Buscar o establishment
SELECT 
  id, 
  name, 
  code,
  created_at
FROM establishments 
WHERE code = '2020';

-- 2. Contar registros por tabela (substitua 'SEU_ESTABLISHMENT_ID' pelo ID encontrado acima)
/*
-- Contar agendamentos
SELECT 
  'appointments' as tabela,
  COUNT(*) as registros
FROM appointments 
WHERE establishment_id = 'SEU_ESTABLISHMENT_ID';

-- Contar assinantes
SELECT 
  'client_subscriptions' as tabela,
  COUNT(*) as registros
FROM client_subscriptions 
WHERE establishment_id = 'SEU_ESTABLISHMENT_ID';

-- Contar planos de assinatura
SELECT 
  'subscriptions' as tabela,
  COUNT(*) as registros
FROM subscriptions 
WHERE establishment_id = 'SEU_ESTABLISHMENT_ID';

-- Calcular tamanho aproximado (cada registro tem ~1KB em média)
SELECT 
  'TOTAL APROXIMADO' as tipo,
  (
    (SELECT COUNT(*) FROM appointments WHERE establishment_id = 'SEU_ESTABLISHMENT_ID') +
    (SELECT COUNT(*) FROM client_subscriptions WHERE establishment_id = 'SEU_ESTABLISHMENT_ID') +
    (SELECT COUNT(*) FROM subscriptions WHERE establishment_id = 'SEU_ESTABLISHMENT_ID')
  ) as total_registros,
  (
    (SELECT COUNT(*) FROM appointments WHERE establishment_id = 'SEU_ESTABLISHMENT_ID') +
    (SELECT COUNT(*) FROM client_subscriptions WHERE establishment_id = 'SEU_ESTABLISHMENT_ID') +
    (SELECT COUNT(*) FROM subscriptions WHERE establishment_id = 'SEU_ESTABLISHMENT_ID')
  ) * 1024 as tamanho_bytes_aproximado,
  ROUND(
    (
      (SELECT COUNT(*) FROM appointments WHERE establishment_id = 'SEU_ESTABLISHMENT_ID') +
      (SELECT COUNT(*) FROM client_subscriptions WHERE establishment_id = 'SEU_ESTABLISHMENT_ID') +
      (SELECT COUNT(*) FROM subscriptions WHERE establishment_id = 'SEU_ESTABLISHMENT_ID')
    ) * 1024 / 1024.0 / 1024.0, 2
  ) as tamanho_mb_aproximado;
*/








