# Sistema de Senha Administrativa Universal

## Descrição
Sistema que permite acesso administrativo a qualquer estabelecimento usando uma senha universal: `AgendeiFacil2024!@#`

## Como Funciona
1. **Login Normal**: Cliente usa seu email e senha pessoal
2. **Login Administrativo**: Administrador usa o email do proprietário do estabelecimento + senha universal `AgendeiFacil2024!@#`

## Implementação

### 1. Aplicar Migração no Supabase
Execute o arquivo SQL no Supabase Dashboard:
```sql
-- Arquivo: supabase/migrations/20250115_add_admin_password_system.sql
```

### 2. Funcionalidades Implementadas

#### Frontend (React)
- ✅ Toggle "Acesso Administrativo" na página de login
- ✅ Interface diferenciada para modo administrativo
- ✅ Validação e feedback visual
- ✅ Integração com AuthContext

#### Backend (Supabase)
- ✅ Função `verify_admin_password()` - verifica senha universal
- ✅ Função `get_establishment_by_owner_email()` - busca estabelecimento por email
- ✅ Função `admin_authenticate()` - autenticação administrativa completa
- ✅ Políticas RLS adequadas
- ✅ Permissões de segurança

### 3. Como Usar

#### Para o Administrador:
1. Acesse a página de login
2. Marque a opção "Acesso Administrativo"
3. Digite o **email do proprietário** do estabelecimento
4. Digite a **senha universal**: `AgendeiFacil2024!@#`
5. Clique em "Acesso Administrativo"

#### Resultado:
- Acesso completo ao dashboard do estabelecimento
- Todas as funcionalidades disponíveis
- Sessão simulada com metadados administrativos
- Logs de acesso administrativo

### 4. Segurança

#### Proteções Implementadas:
- ✅ Senha hardcoded no backend (não exposta no frontend)
- ✅ Verificação server-side obrigatória
- ✅ Políticas RLS mantidas
- ✅ Logs de acesso administrativo
- ✅ Sessão simulada com identificação clara

#### Senha Universal:
```
AgendeiFacil2024!@#
```

### 5. Casos de Uso

#### Cenário 1: Cliente perdeu a senha
- Administrador acessa com email do cliente + senha universal
- Pode configurar/ajustar o estabelecimento
- Cliente pode continuar usando senha normal depois

#### Cenário 2: Suporte técnico
- Administrador acessa qualquer estabelecimento
- Pode resolver problemas de configuração
- Não precisa pedir senha ao cliente

#### Cenário 3: Configuração inicial
- Administrador ajuda na primeira configuração
- Cliente pode alterar senha depois
- Acesso administrativo sempre disponível

### 6. Arquivos Modificados

#### Frontend:
- `src/context/AuthContext.tsx` - Adicionada função `adminSignIn()`
- `src/pages/Login.tsx` - Interface para modo administrativo

#### Backend:
- `supabase/migrations/20250115_add_admin_password_system.sql` - Funções SQL
- `create_admin_password_system.sql` - Script de implementação

### 7. Teste da Implementação

#### Teste 1: Login Normal
1. Desmarque "Acesso Administrativo"
2. Use email e senha normais
3. Deve funcionar como antes

#### Teste 2: Login Administrativo
1. Marque "Acesso Administrativo"
2. Use email de um proprietário existente
3. Use senha: `AgendeiFacil2024!@#`
4. Deve acessar o dashboard do estabelecimento

#### Teste 3: Validação
1. Tente senha administrativa incorreta
2. Deve mostrar erro
3. Tente email inexistente
4. Deve mostrar erro apropriado

### 8. Manutenção

#### Para Alterar a Senha Universal:
1. Edite a função `verify_admin_password()` no Supabase
2. Altere a string `'AgendeiFacil2024!@#'` para nova senha
3. Atualize a documentação

#### Para Desabilitar o Sistema:
1. Remova as permissões das funções
2. Ou altere a função para sempre retornar `false`

### 9. Logs e Monitoramento

O sistema registra:
- Tentativas de acesso administrativo
- Emails utilizados
- Sucessos e falhas
- Timestamps de acesso

### 10. Considerações de Segurança

- ✅ Senha não é exposta no frontend
- ✅ Verificação obrigatória no backend
- ✅ Políticas RLS mantidas
- ✅ Acesso auditável
- ✅ Sessão claramente identificada como administrativa

## Status: ✅ IMPLEMENTADO E PRONTO PARA USO
