-- =============================================================================
-- Suporte por NOME: Lucas, Erlon, Kinkas, usuario 1, usuario 2
-- Cada nome = 1 sessão. Recarregar (F5) não cria nova. Mostra quem está logado.
-- Rode no Supabase SQL Editor.
-- =============================================================================

-- Remover tabela antiga (session_uid) e recriar por nome
DROP TABLE IF EXISTS public.support_sessions;

CREATE TABLE public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_sessions_name_allowed CHECK (name IN ('Lucas', 'Erlon', 'Kinkas', 'usuario 1', 'usuario 2'))
);

CREATE INDEX idx_support_sessions_name ON public.support_sessions(name);
CREATE INDEX idx_support_sessions_last_heartbeat ON public.support_sessions(last_heartbeat_at);

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_sessions_only_support_email" ON public.support_sessions;
CREATE POLICY "support_sessions_only_support_email"
  ON public.support_sessions FOR ALL
  USING (public.current_user_email_support_sessions() = 'suporteagendeifacil@gmail.com')
  WITH CHECK (public.current_user_email_support_sessions() = 'suporteagendeifacil@gmail.com');

-- Função auxiliar (criar se não existir)
CREATE OR REPLACE FUNCTION public.current_user_email_support_sessions()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Senhas de 4 dígitos por nome (só validadas no primeiro login do nome; heartbeat não envia senha)
-- Lucas: 2543, Erlon: 2543, Kinkas: 1224, usuario 1: 1212, usuario 2: 1212
CREATE OR REPLACE FUNCTION public.support_pin_for_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_name
    WHEN 'Lucas' THEN '2543'
    WHEN 'Erlon' THEN '2543'
    WHEN 'Kinkas' THEN '1224'
    WHEN 'usuario 1' THEN '1212'
    WHEN 'usuario 2' THEN '1212'
    ELSE NULL
  END;
$$;

-- Registrar/heartbeat por nome. p_pin obrigatório só na primeira vez (nova sessão); heartbeat pode enviar qualquer coisa.
CREATE OR REPLACE FUNCTION public.register_support_session_by_name(p_name TEXT, p_pin TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_row RECORD;
  v_expected_pin TEXT;
BEGIN
  IF p_name IS NULL OR p_name NOT IN ('Lucas', 'Erlon', 'Kinkas', 'usuario 1', 'usuario 2') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_name');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL OR v_email <> 'suporteagendeifacil@gmail.com' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Limpar sessões sem heartbeat nos últimos 3 min
  DELETE FROM public.support_sessions
  WHERE last_heartbeat_at < now() - interval '3 minutes';

  SELECT * INTO v_row FROM public.support_sessions WHERE name = p_name LIMIT 1;
  IF FOUND THEN
    IF v_row.last_heartbeat_at > now() - interval '3 minutes' AND v_row.email <> v_email THEN
      RETURN jsonb_build_object('ok', false, 'error', 'name_in_use');
    END IF;
    UPDATE public.support_sessions SET email = v_email, last_heartbeat_at = now() WHERE name = p_name;
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Nova sessão: validar senha de 4 dígitos
  v_expected_pin := public.support_pin_for_name(p_name);
  IF v_expected_pin IS NULL OR TRIM(COALESCE(p_pin, '')) <> v_expected_pin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  INSERT INTO public.support_sessions (name, email) VALUES (p_name, v_email);
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.register_support_session_by_name(TEXT, TEXT) IS
  'Registra sessão suporte por nome + senha 4 dígitos. Lucas/Erlon 2543, Kinkas 1224, usuario 1/2 1212.';
