-- Versão simplificada e corrigida da função get_professional_goal_progress
-- Esta versão funciona corretamente com os serviços selecionados

CREATE OR REPLACE FUNCTION get_professional_goal_progress(
  p_establishment_id UUID,
  p_professional_id TEXT,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  goal_amount INTEGER,
  completed_services INTEGER,
  progress_percentage NUMERIC,
  remaining_services INTEGER,
  selected_services JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH goal_data AS (
    SELECT 
      COALESCE(pg.goal_amount, 0) as goal_amount,
      COALESCE(pg.selected_services, '[]'::jsonb) as selected_services
    FROM professional_goals pg
    WHERE pg.establishment_id = p_establishment_id
      AND pg.professional_id = p_professional_id
      AND pg.year = p_year
      AND pg.month = p_month
  ),
  completed_data AS (
    SELECT COUNT(*)::INTEGER as completed_services
    FROM appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.professional_name = (
        SELECT name FROM establishments e, jsonb_array_elements(e.professionals) p
        WHERE e.id = p_establishment_id AND p->>'id' = p_professional_id
      )
      AND EXTRACT(YEAR FROM a.appointment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM a.appointment_date::DATE) = p_month
      AND a.status = 'completed'
      -- Filtrar por serviços selecionados se houver
      AND (
        -- Se não há serviços selecionados (array vazio), contar todos
        (SELECT jsonb_array_length(selected_services) FROM goal_data) = 0
        OR
        -- Se há serviços selecionados, verificar se o serviço do agendamento está na lista
        (SELECT selected_services FROM goal_data) @> to_jsonb(a.service)
        OR
        -- Verificar se o serviço está nas subcategorias selecionadas
        EXISTS (
          SELECT 1 
          FROM service_subcategories ss
          WHERE ss.name = a.service
          AND ss.id::text = ANY(
            SELECT jsonb_array_elements_text((SELECT selected_services FROM goal_data))
          )
        )
        OR
        -- Verificar se o serviço está nos serviços normais selecionados
        EXISTS (
          SELECT 1 
          FROM establishments e, jsonb_array_elements(e.services_with_prices) s
          WHERE e.id = p_establishment_id
          AND s->>'name' = a.service
          AND s->>'id' = ANY(
            SELECT jsonb_array_elements_text((SELECT selected_services FROM goal_data))
          )
        )
      )
  )
  SELECT 
    gd.goal_amount,
    cd.completed_services,
    CASE 
      WHEN gd.goal_amount > 0 THEN 
        ROUND((cd.completed_services::NUMERIC / gd.goal_amount::NUMERIC) * 100, 2)
      ELSE 0
    END as progress_percentage,
    GREATEST(gd.goal_amount - cd.completed_services, 0) as remaining_services,
    gd.selected_services
  FROM goal_data gd
  CROSS JOIN completed_data cd;
END;
$$ LANGUAGE plpgsql;
