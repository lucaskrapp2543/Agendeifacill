-- Migração: Adicionar campo exigir_pagamento_antecipado aos profissionais existentes
-- Este script adiciona o campo exigir_pagamento_antecipado (padrão: false) 
-- a todos os profissionais já cadastrados no sistema

-- Atualizar todos os estabelecimentos que têm profissionais
UPDATE establishments
SET professionals = (
  SELECT array_agg(
    CASE 
      WHEN professional ? 'exigir_pagamento_antecipado' THEN professional
      ELSE professional || '{"exigir_pagamento_antecipado": false}'::jsonb
    END
  )
  FROM unnest(professionals) AS professional
)
WHERE professionals IS NOT NULL 
  AND array_length(professionals, 1) > 0;

-- Verificar se a atualização foi bem-sucedida
SELECT 
  id,
  name,
  array_length(professionals, 1) as total_professionals,
  (
    SELECT COUNT(*) 
    FROM unnest(professionals) AS professional
    WHERE professional ? 'exigir_pagamento_antecipado'
  ) as professionals_with_field
FROM establishments
WHERE professionals IS NOT NULL
  AND array_length(professionals, 1) > 0
LIMIT 10;

