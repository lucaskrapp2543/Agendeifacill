-- =============================================================================
-- CORREÇÃO: Suporte 0/5 não mostrava as sessões (RLS bloqueava o SELECT)
-- Cole no Supabase SQL Editor e execute. Depois atualize a página do painel (F5).
-- =============================================================================

-- Função que retorna o e-mail do usuário logado (o RLS não consegue ler auth.users direto)
CREATE OR REPLACE FUNCTION public.current_user_email_support_sessions()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "support_sessions_only_support_email" ON public.support_sessions;

CREATE POLICY "support_sessions_only_support_email"
  ON public.support_sessions
  FOR ALL
  USING (public.current_user_email_support_sessions() = 'suporteagendeifacil@gmail.com')
  WITH CHECK (public.current_user_email_support_sessions() = 'suporteagendeifacil@gmail.com');
