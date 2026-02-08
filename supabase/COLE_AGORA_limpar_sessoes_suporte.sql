-- =============================================================================
-- Rode no Supabase SQL Editor AGORA para liberar o login de novo.
-- Apaga todas as sessões suporte (são “fantasmas” de refresh/aba fechada).
-- Depois rode isso, faça login de novo no painel admin.
-- =============================================================================

DELETE FROM public.support_sessions;

-- Função passa a limpar sessões "mortas" antes de contar (evita travar em 5)
CREATE OR REPLACE FUNCTION public.register_support_session(p_session_uid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_count INT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL OR v_email <> 'suporteagendeifacil@gmail.com' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.support_sessions
  WHERE last_heartbeat_at < now() - interval '3 minutes';

  IF EXISTS (SELECT 1 FROM public.support_sessions WHERE session_uid = p_session_uid) THEN
    UPDATE public.support_sessions SET last_heartbeat_at = now() WHERE session_uid = p_session_uid;
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT count(*) INTO v_count FROM public.support_sessions;
  IF v_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_sessions');
  END IF;

  INSERT INTO public.support_sessions (session_uid, email) VALUES (p_session_uid, v_email);
  RETURN jsonb_build_object('ok', true);
END;
$$;
