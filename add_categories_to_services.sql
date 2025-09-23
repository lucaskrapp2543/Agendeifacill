-- Adiciona categorias aos serviços existentes
-- Execute este SQL para categorizar seus serviços

-- Exemplo: Adicionar categoria "Pacotes" ao serviço "Corte + Barba"
-- Substitua 'SEU_ESTABELECIMENTO_ID' pelo ID real do seu estabelecimento

UPDATE establishments 
SET services_with_prices = (
  SELECT jsonb_agg(
    CASE 
      WHEN service->>'name' = 'Corte + Barba' THEN 
        service || '{"category": "Pacotes"}'::jsonb
      WHEN service->>'name' = 'Hidratação' THEN 
        service || '{"category": "Tratamentos"}'::jsonb
      WHEN service->>'name' = 'Escova' THEN 
        service || '{"category": "Tratamentos"}'::jsonb
      WHEN service->>'name' = 'Tintura' THEN 
        service || '{"category": "Tratamentos"}'::jsonb
      WHEN service->>'name' = 'Alisamento' THEN 
        service || '{"category": "Tratamentos"}'::jsonb
      WHEN service->>'name' = 'Sobrancelha' THEN 
        service || '{"category": "Estética"}'::jsonb
      WHEN service->>'name' = 'Manicure' THEN 
        service || '{"category": "Estética"}'::jsonb
      WHEN service->>'name' = 'Pedicure' THEN 
        service || '{"category": "Estética"}'::jsonb
      ELSE 
        service -- Mantém serviços sem categoria (aparecerão em "Serviços Normais")
    END
  )
  FROM jsonb_array_elements(services_with_prices) AS service
)
WHERE id = 'SEU_ESTABELECIMENTO_ID'; -- SUBSTITUA PELO ID REAL

-- Para verificar o resultado, execute:
-- SELECT services_with_prices FROM establishments WHERE id = 'SEU_ESTABELECIMENTO_ID';
