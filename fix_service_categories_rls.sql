-- Corrigir RLS para permitir que clientes vejam categorias de serviços
-- Mas só o dono pode criar/editar/excluir

-- Remover políticas antigas
DROP POLICY IF EXISTS "Establishments can manage their service categories" ON service_categories;
DROP POLICY IF EXISTS "Establishments can manage their service subcategories" ON service_subcategories;

-- Nova política para service_categories:
-- SELECT: Qualquer usuário pode ver (para agendamentos)
-- INSERT/UPDATE/DELETE: Só o dono pode modificar
CREATE POLICY "Anyone can view service categories" ON service_categories
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage service categories" ON service_categories
  FOR ALL USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
  ));

-- Nova política para service_subcategories:
-- SELECT: Qualquer usuário pode ver (para agendamentos)
-- INSERT/UPDATE/DELETE: Só o dono pode modificar
CREATE POLICY "Anyone can view service subcategories" ON service_subcategories
  FOR SELECT USING (true);

CREATE POLICY "Only owner can manage service subcategories" ON service_subcategories
  FOR ALL USING (category_id IN (
    SELECT sc.id FROM service_categories sc
    JOIN establishments e ON sc.establishment_id = e.id
    WHERE e.owner_id = auth.uid()
  ));

-- Comentário explicativo
COMMENT ON POLICY "Anyone can view service categories" ON service_categories IS 'Permite que qualquer usuário veja categorias para fazer agendamentos';
COMMENT ON POLICY "Anyone can view service subcategories" ON service_subcategories IS 'Permite que qualquer usuário veja subcategorias para fazer agendamentos';
