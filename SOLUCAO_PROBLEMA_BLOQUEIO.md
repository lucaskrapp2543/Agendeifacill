# Solução para Problema de Bloqueio Não Persistir

## Problema
O bloqueio não persiste após F5 (refresh da página) no localhost.

## Causas Possíveis

### 1. Coluna `is_blocked` não existe no banco
**Solução:** Execute o SQL no Supabase

```sql
-- Verificar se a coluna existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'is_blocked';

-- Se não existir, criar a coluna
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_establishments_is_blocked ON establishments(is_blocked);
```

### 2. Problemas de RLS (Row Level Security)
**Solução:** Verificar políticas RLS

```sql
-- Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'establishments';

-- Se necessário, criar política para is_blocked
CREATE POLICY "Users can update their own establishment blocked status" ON establishments
FOR UPDATE USING (auth.uid() = owner_id);
```

### 3. Problemas de Cache
**Solução:** Limpar cache e recarregar dados

## Passos para Resolver

### Passo 1: Executar SQL no Supabase
1. Acesse o painel do Supabase
2. Vá para SQL Editor
3. Execute o arquivo `add_blocked_column.sql`

### Passo 2: Testar no Console do Navegador
1. Abra o admin dashboard (`/dashboard/admin`)
2. Abra o console do navegador (F12)
3. Cole e execute o script `test_blocked_functionality.js`

### Passo 3: Verificar Logs
1. No console do navegador, procure por logs de erro
2. Verifique se há erros de permissão ou coluna não encontrada

### Passo 4: Testar Funcionalidade
1. Tente bloquear um estabelecimento
2. Verifique se aparece a mensagem de sucesso
3. Dê F5 e verifique se o status persiste

## Debug Adicionado

Adicionei logs de debug na função `toggleBlockEstablishment`:

```javascript
console.log('Tentando alterar bloqueio:', { establishmentId, isBlocked, newValue: !isBlocked });
console.log('Resposta do Supabase:', data);
```

## Verificações Importantes

### 1. Verificar se a coluna existe:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'is_blocked';
```

### 2. Verificar dados atuais:
```sql
SELECT id, name, is_blocked 
FROM establishments 
LIMIT 5;
```

### 3. Testar atualização manual:
```sql
UPDATE establishments 
SET is_blocked = true 
WHERE id = 'seu-establishment-id';
```

## Se o Problema Persistir

1. **Verifique as permissões RLS** no Supabase
2. **Teste diretamente no SQL Editor** do Supabase
3. **Verifique se há erros no console** do navegador
4. **Confirme se está logado** com a conta de suporte

## Contato para Suporte

Se o problema persistir, forneça:
- Screenshot dos logs do console
- Resultado da execução do script de teste
- Erro específico que aparece
