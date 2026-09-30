-- =====================================================================
-- CHAT/BOOKING: "você será lembrado no seu WhatsApp X antes"
-- =====================================================================
--
-- O QUE FAZ
--   Função pública (pode ser chamada pelo cliente final, sem login) que responde
--   apenas: o WhatsApp do estabelecimento está conectado? a confirmação automática
--   está ligada? o lembrete está ligado e com quantos minutos de antecedência?
--   Nada de telefone, nome ou template: só booleanos e um número.
--
-- ONDE LÊ
--   establishments.owner_id -> whatsapp_sessions (status = 'connected')
--                           -> whatsapp_automation_settings (lembrete/confirmação)
--   Sem linha em whatsapp_automation_settings = padrão do servidor (ligado, 60 min).
--
-- RISCO: nenhum. Só leitura, sem dados pessoais. Reversível: DROP FUNCTION no fim.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.public_booking_whatsapp_info(p_establishment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_connected boolean;
  v_greeting boolean;
  v_reminder_enabled boolean;
  v_reminder_minutes integer;
BEGIN
  SELECT owner_id INTO v_owner
  FROM public.establishments
  WHERE id = p_establishment_id AND coalesce(is_deleted, false) = false;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'connected', false);
  END IF;

  SELECT (lower(coalesce(status, '')) = 'connected') INTO v_connected
  FROM public.whatsapp_sessions
  WHERE user_id = v_owner
  ORDER BY last_seen DESC NULLS LAST
  LIMIT 1;

  SELECT coalesce(greeting_enabled, true), coalesce(reminder_enabled, true), coalesce(reminder_offset_minutes, 60)
    INTO v_greeting, v_reminder_enabled, v_reminder_minutes
  FROM public.whatsapp_automation_settings
  WHERE user_id = v_owner
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'connected', coalesce(v_connected, false),
    'greeting_enabled', coalesce(v_greeting, true),
    'reminder_enabled', coalesce(v_reminder_enabled, true),
    'reminder_offset_minutes', coalesce(v_reminder_minutes, 60)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.public_booking_whatsapp_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_booking_whatsapp_info(uuid) TO anon, authenticated, service_role;

-- Conferência: troque o código se quiser testar outra barbearia
SELECT public.public_booking_whatsapp_info((SELECT id FROM public.establishments WHERE code = '3034' LIMIT 1)) AS teste_3034;

COMMIT;

-- Reverter: DROP FUNCTION IF EXISTS public.public_booking_whatsapp_info(uuid);
