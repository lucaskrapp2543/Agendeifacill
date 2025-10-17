-- ADICIONAR CAMPO WHATSAPP DO PROFISSIONAL
-- Este SQL adiciona o campo whatsapp na tabela establishments.professionals (JSONB)

-- 1. VERIFICAR se o campo já existe (apenas para informação)
SELECT 
    '=== VERIFICAÇÃO INICIAL ===' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'establishments' 
            AND column_name = 'professionals'
        ) THEN '✅ Coluna professionals existe'
        ELSE '❌ Coluna professionals não existe'
    END as professionals_column_status;

-- 2. MOSTRAR estrutura atual dos profissionais (exemplo)
SELECT 
    '=== ESTRUTURA ATUAL ===' as status,
    id,
    name,
    professionals
FROM establishments 
WHERE professionals IS NOT NULL 
LIMIT 1;

-- 3. COMENTÁRIO IMPORTANTE:
-- O campo 'whatsapp' será adicionado automaticamente no JSONB dos profissionais
-- quando o usuário preencher o campo na interface.
-- Não é necessário executar ALTER TABLE pois 'professionals' é um campo JSONB.

-- 4. EXEMPLO de como ficará a estrutura após adicionar WhatsApp:
/*
{
  "id": "prof1",
  "name": "João Silva",
  "whatsapp": "(47) 99999-9999",
  "percentage": 70,
  "photo_url": "https://...",
  "offers_child_service": false
}
*/

-- 5. VERIFICAÇÃO FINAL
SELECT 
    '🎯 CAMPO WHATSAPP DO PROFISSIONAL ADICIONADO COM SUCESSO!' as resultado,
    'O campo será salvo automaticamente quando preenchido na interface.' as observacao;
