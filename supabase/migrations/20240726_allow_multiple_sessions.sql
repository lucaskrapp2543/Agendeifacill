-- Permitir Múltiplas Sessões Simultâneas
-- Data: 2024-07-26
-- Descrição: Permite até 10 pessoas logadas simultaneamente na mesma conta

-- 1. Configurar Supabase para permitir múltiplas sessões
-- Isso é feito através de configurações do Supabase Auth

-- 2. Remover limitações de sessão única (se existirem)
-- O Supabase por padrão já permite múltiplas sessões, mas vamos garantir

-- 3. Configurar JWT para não invalidar sessões anteriores
-- O Supabase já faz isso automaticamente

-- 4. Verificar se há políticas que limitam sessões múltiplas
-- Vamos garantir que as políticas RLS não interfiram com múltiplos logins

-- Política para permitir múltiplas sessões ativas
-- (O Supabase já permite isso por padrão, mas vamos documentar)

-- Comentário: O Supabase Auth já suporta múltiplas sessões simultâneas por padrão
-- Não é necessário SQL adicional para esta funcionalidade
-- As configurações são feitas no painel do Supabase

-- Para garantir que não há limitações, vamos verificar as políticas existentes
-- e garantir que elas não interfiram com múltiplos logins

-- Política para estabelecimentos (já existe e está correta)
-- CREATE POLICY "Owners can manage their establishments"
--   ON establishments
--   FOR ALL
--   USING (auth.uid() = owner_id);

-- Esta política permite que qualquer sessão do usuário acesse
-- desde que seja o mesmo auth.uid(), independente de quantas sessões existam

-- CONCLUSÃO: O sistema já suporta múltiplas sessões por padrão
-- Não é necessário SQL adicional para esta funcionalidade específica 