-- Controle de acessos simultâneos da conta Suporte (máx. 5)
-- Permite listar quantas sessões estão ativas e desconectar uma delas.

-- 1) Tabela de sessões ativas do suporte
CREATE TABLE IF NOT EXISTS public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_session_uid ON public.support_sessions(session_uid);
CREATE INDEX IF NOT EXISTS idx_support_sessions_last_heartbeat ON public.support_sessions(last_heartbeat_at);

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

-- Função que retorna o e-mail do usuário logado (SECURITY DEFINER = consegue ler auth.users no RLS)
CREATE OR REPLACE FUNCTION public.current_user_email_support_sessions()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Apenas a conta de suporte pode ver/inserir/atualizar/deletar
CREATE POLICY "support_sessions_only_support_email"
  ON public.support_sessions
  FOR ALL
  USING (public.current_user_email_support_sessions() = 'suporteagendeifacil@gmail.com')
  WITH CHECK (public.current_user_email_support_sessions() = 'suporteagendeifacil@gmail.com');

-- 2) RPC: registrar sessão ou dar heartbeat. Limite de 5 sessões.
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

  -- Limpar sessões sem heartbeat nos últimos 3 min (aba fechada/refresh)
  DELETE FROM public.support_sessions
  WHERE last_heartbeat_at < now() - interval '3 minutes';

  -- Já existe esta sessão: apenas atualizar heartbeat
  IF EXISTS (SELECT 1 FROM public.support_sessions WHERE session_uid = p_session_uid) THEN
    UPDATE public.support_sessions
    SET last_heartbeat_at = now()
    WHERE session_uid = p_session_uid;
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Nova sessão: verificar limite de 5
  SELECT count(*) INTO v_count FROM public.support_sessions;
  IF v_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_sessions');
  END IF;

  INSERT INTO public.support_sessions (session_uid, email)
  VALUES (p_session_uid, v_email);
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.register_support_session(TEXT) IS
  'Registra ou atualiza heartbeat da sessão do suporte. Máx. 5 sessões. Só conta suporteagendeifacil@gmail.com.';
