-- 🔥 FUNÇÃO DEFINITIVA PARA CALCULAR PROGRESSO DA META
-- Esta função vai FUNCIONAR de verdade, sem contar serviços não selecionados

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
  v_professional_name TEXT;
BEGIN
  -- 1️⃣ BUSCAR NOME DO PROFISSIONAL
  SELECT (prof->>'name')
  INTO v_professional_name
  FROM establishments e, 
       unnest(e.professionals) AS prof
  WHERE e.id = p_establishment_id 
    AND (prof->>'id') = p_professional_id;

  RAISE NOTICE '🔍 DEBUG - Nome do profissional encontrado: %', v_professional_name;

  -- 2️⃣ BUSCAR META E SERVIÇOS SELECIONADOS
  SELECT 
    COALESCE(pg.goal_amount, 0),
    COALESCE(pg.selected_services, '[]'::jsonb)
  INTO v_goal_amount, v_selected_services
  FROM professional_goals pg
  WHERE pg.establishment_id = p_establishment_id
    AND pg.professional_id = p_professional_id
    AND pg.year = p_year
    AND pg.month = p_month;

  RAISE NOTICE '🔍 DEBUG - Meta encontrada: %, Serviços selecionados: %', v_goal_amount, v_selected_services;

  -- 3️⃣ CONTAR SERVIÇOS CONCLUÍDOS
  IF jsonb_array_length(v_selected_services) = 0 THEN
    -- Se não há serviços selecionados, contar TODOS os serviços
    SELECT COUNT(*)::INTEGER 
    INTO v_completed_services
    FROM appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.professional = v_professional_name
      AND EXTRACT(YEAR FROM a.appointment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM a.appointment_date::DATE) = p_month
      AND a.status = 'completed';
      
    RAISE NOTICE '🔍 DEBUG - Contando TODOS os serviços: %', v_completed_services;
  ELSE
    -- Se há serviços selecionados, contar APENAS ESSES
    -- Buscar pelos IDs das subcategorias que estão selecionadas
    SELECT COUNT(*)::INTEGER 
    INTO v_completed_services
    FROM appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.professional = v_professional_name
      AND EXTRACT(YEAR FROM a.appointment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM a.appointment_date::DATE) = p_month
      AND a.status = 'completed'
      AND EXISTS (
        -- Verificar se o serviço do agendamento corresponde a uma subcategoria selecionada
        SELECT 1 
        FROM service_subcategories ss
        WHERE ss.name = a.service
          AND ss.id::text = ANY(SELECT jsonb_array_elements_text(v_selected_services))
      );
      
    RAISE NOTICE '🔍 DEBUG - Contando APENAS serviços selecionados: %', v_completed_services;
  END IF;

  -- 4️⃣ RETORNAR RESULTADO
  RETURN QUERY SELECT 
    v_goal_amount,
    v_completed_services,
    CASE WHEN v_goal_amount > 0 THEN 
      ROUND((v_completed_services::NUMERIC / v_goal_amount::NUMERIC) * 100, 2)
    ELSE 0 END,
    GREATEST(v_goal_amount - v_completed_services, 0),
    v_selected_services;

  RAISE NOTICE '🔍 DEBUG - Resultado final: Meta=%, Concluídos=%, Percentual=%', 
    v_goal_amount, v_completed_services, 
    CASE WHEN v_goal_amount > 0 THEN ROUND((v_completed_services::NUMERIC / v_goal_amount::NUMERIC) * 100, 2) ELSE 0 END;

END;
$$ LANGUAGE plpgsql;

-- 🔥 TESTAR A FUNÇÃO
-- Descomente as linhas abaixo para testar:
-- SELECT * FROM get_professional_goal_progress(
--   'SEU_ESTABLISHMENT_ID'::uuid,
--   'SEU_PROFESSIONAL_ID',
--   2024,
--   12
-- );
