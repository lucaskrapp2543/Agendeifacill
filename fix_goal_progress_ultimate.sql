-- VERSÃO DEFINITIVA que vai funcionar 100%
-- Se esta não funcionar, eu desisto da programação

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
DECLARE
  v_goal_amount INTEGER := 0;
  v_selected_services JSONB := '[]'::jsonb;
  v_completed_services INTEGER := 0;
BEGIN
  -- Buscar a meta e serviços selecionados
  SELECT 
    COALESCE(pg.goal_amount, 0),
    COALESCE(pg.selected_services, '[]'::jsonb)
  INTO v_goal_amount, v_selected_services
  FROM professional_goals pg
  WHERE pg.establishment_id = p_establishment_id
    AND pg.professional_id = p_professional_id
    AND pg.year = p_year
    AND pg.month = p_month;

  -- Se não há serviços selecionados, contar todos
  IF jsonb_array_length(v_selected_services) = 0 THEN
    SELECT COUNT(*)::INTEGER
    INTO v_completed_services
    FROM appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.professional = (
        SELECT (p->>'name') FROM establishments e, unnest(e.professionals) p
        WHERE e.id = p_establishment_id AND (p->>'id') = p_professional_id
      )
      AND EXTRACT(YEAR FROM a.appointment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM a.appointment_date::DATE) = p_month
      AND a.status = 'completed';
  ELSE
    -- Se há serviços selecionados, contar APENAS esses
    SELECT COUNT(*)::INTEGER
    INTO v_completed_services
    FROM appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.professional = (
        SELECT (p->>'name') FROM establishments e, unnest(e.professionals) p
        WHERE e.id = p_establishment_id AND (p->>'id') = p_professional_id
      )
      AND EXTRACT(YEAR FROM a.appointment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM a.appointment_date::DATE) = p_month
      AND a.status = 'completed'
      -- AQUI É A PARTE CRÍTICA: só contar se o serviço está EXATAMENTE na lista
      AND EXISTS (
        SELECT 1 
        FROM service_subcategories ss
        WHERE ss.name = a.service
        AND ss.id::text = ANY(
          SELECT jsonb_array_elements_text(v_selected_services)
        )
      );
  END IF;

  -- Retornar o resultado
  RETURN QUERY
  SELECT 
    v_goal_amount,
    v_completed_services,
    CASE 
      WHEN v_goal_amount > 0 THEN 
        ROUND((v_completed_services::NUMERIC / v_goal_amount::NUMERIC) * 100, 2)
      ELSE 0
    END as progress_percentage,
    GREATEST(v_goal_amount - v_completed_services, 0) as remaining_services,
    v_selected_services;
END;
$$ LANGUAGE plpgsql;
