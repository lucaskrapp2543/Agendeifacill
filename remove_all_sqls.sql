-- REMOVER TODOS OS SQLS ANTERIORES
DROP FUNCTION IF EXISTS ultimate_master_access(UUID);
DROP FUNCTION IF EXISTS master_direct_access(UUID);
DROP FUNCTION IF EXISTS bypass_support_access(UUID);
DROP FUNCTION IF EXISTS support_direct_access(UUID);
DROP FUNCTION IF EXISTS create_admin_access(UUID);
DROP FUNCTION IF EXISTS get_establishment_owner_info(UUID);
DROP FUNCTION IF EXISTS get_establishment_for_admin(UUID);
DROP FUNCTION IF EXISTS admin_access_establishment_safe(UUID);
DROP FUNCTION IF EXISTS admin_access_establishment(UUID);
DROP FUNCTION IF EXISTS set_admin_password_temp(TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_admin_user(UUID);
DROP FUNCTION IF EXISTS remove_admin_user(UUID);
DROP FUNCTION IF EXISTS get_establishment_data(UUID);
