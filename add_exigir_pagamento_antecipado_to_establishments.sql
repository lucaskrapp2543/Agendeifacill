-- Migração: Adicionar campo exigir_pagamento_antecipado na tabela establishments
-- Este script adiciona o campo exigir_pagamento_antecipado (padrão: false) 
-- na tabela establishments para configuração geral do estabelecimento

-- Adicionar coluna se não existir
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS exigir_pagamento_antecipado BOOLEAN DEFAULT false;

-- Atualizar todos os estabelecimentos existentes para false (padrão)
UPDATE establishments
SET exigir_pagamento_antecipado = false
WHERE exigir_pagamento_antecipado IS NULL;

-- Verificar se a atualização foi bem-sucedida
SELECT 
  id,
  name,
  exigir_pagamento_antecipado
FROM establishments
LIMIT 10;




