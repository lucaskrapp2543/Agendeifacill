-- REMOVER TODAS AS FUNÇÕES DE SENHA ADMINISTRATIVA
-- Execute este SQL no Supabase Dashboard para limpar tudo

-- 1. Remover TODAS as funções criadas
DROP FUNCTION IF EXISTS verify_admin_password(TEXT);
DROP FUNCTION IF EXISTS get_establishment_by_owner_email(TEXT);
DROP FUNCTION IF EXISTS admin_authenticate(TEXT, TEXT);
DROP FUNCTION IF EXISTS check_admin_access(TEXT, TEXT);
DROP FUNCTION IF EXISTS check_admin_access_only(TEXT, TEXT);
DROP FUNCTION IF EXISTS set_admin_password(TEXT);
DROP FUNCTION IF EXISTS set_admin_password_temp(TEXT);
DROP FUNCTION IF EXISTS admin_login_real(TEXT, TEXT);
DROP FUNCTION IF EXISTS restore_user_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);

-- 2. Comentário
-- Todas as funções de senha administrativa foram removidas
-- O sistema volta ao estado original
