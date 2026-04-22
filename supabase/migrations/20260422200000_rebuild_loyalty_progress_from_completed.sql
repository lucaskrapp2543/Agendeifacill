-- Recalcula o progresso de fidelidade com base nos agendamentos concluídos históricos.
-- Objetivo: corrigir clientes antigos (ex.: 3 concluídos de 3 pts = 9 pontos),
-- evitando distorções por contagem duplicada antiga.

BEGIN;

DO $$
DECLARE
  loyalty_row RECORD;
  apt RECORD;
  v_progress integer;
  v_goal integer;
  v_pts integer;
BEGIN
  FOR loyalty_row IN
    SELECT
      ecl.id,
      ecl.establishment_id,
      ecl.client_whatsapp,
      ecl.cycle_goal
    FROM public.establishment_client_loyalty ecl
    WHERE ecl.cycle_goal IS NOT NULL
      AND ecl.cycle_goal >= 2
  LOOP
    v_progress := 0;
    v_goal := GREATEST(2, coalesce(loyalty_row.cycle_goal, 2));

    FOR apt IN
      SELECT
        a.id,
        a.is_loyalty_reward,
        a.loyalty_points_awarded,
        a.appointment_date,
        a.appointment_time,
        a.created_at
      FROM public.appointments a
      WHERE a.establishment_id = loyalty_row.establishment_id
        AND coalesce(a.is_subscriber, false) = false
        AND a.status = 'completed'
        AND public.loyalty_whatsapp_storage_key(a.client_whatsapp) = loyalty_row.client_whatsapp
      ORDER BY
        a.appointment_date NULLS LAST,
        a.appointment_time NULLS LAST,
        a.created_at NULLS LAST,
        a.id
    LOOP
      -- Benefício só zera quando realmente já atingiu a meta.
      IF coalesce(apt.is_loyalty_reward, false) = true AND v_progress >= v_goal THEN
        v_progress := 0;
      ELSE
        -- Regra de pontos:
        -- NULL = legado (1 ponto), valor explícito = max(0, valor).
        IF apt.loyalty_points_awarded IS NULL THEN
          v_pts := 1;
        ELSE
          v_pts := GREATEST(0, coalesce(apt.loyalty_points_awarded, 0));
        END IF;

        -- Guarda extra para histórico antigo:
        -- Se veio reward marcado indevidamente com 0 ponto, trata como 1 ponto normal.
        IF coalesce(apt.is_loyalty_reward, false) = true
           AND v_progress < v_goal
           AND coalesce(apt.loyalty_points_awarded, 0) <= 0 THEN
          v_pts := 1;
        END IF;

        v_progress := LEAST(v_goal, v_progress + v_pts);
      END IF;
    END LOOP;

    UPDATE public.establishment_client_loyalty
    SET cycle_progress = v_progress,
        updated_at = now()
    WHERE id = loyalty_row.id;
  END LOOP;

  -- Marca concluídos históricos como já aplicados para impedir recontagem futura
  -- em toggles manuais de status.
  UPDATE public.appointments a
  SET
    loyalty_applied_at = coalesce(a.loyalty_applied_at, now()),
    loyalty_applied_points = coalesce(
      a.loyalty_applied_points,
      CASE
        WHEN coalesce(a.is_loyalty_reward, false) = true THEN 0
        WHEN a.loyalty_points_awarded IS NULL THEN 1
        ELSE GREATEST(0, coalesce(a.loyalty_points_awarded, 0))
      END
    ),
    loyalty_applied_action = coalesce(a.loyalty_applied_action, 'backfill')
  FROM public.establishment_client_loyalty ecl
  WHERE a.establishment_id = ecl.establishment_id
    AND ecl.cycle_goal IS NOT NULL
    AND ecl.cycle_goal >= 2
    AND coalesce(a.is_subscriber, false) = false
    AND a.status = 'completed'
    AND public.loyalty_whatsapp_storage_key(a.client_whatsapp) = ecl.client_whatsapp
    AND a.loyalty_applied_at IS NULL;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
