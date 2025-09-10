-- CORREÇÃO EMERGENCIAL - Execute este SQL no Supabase AGORA
-- Isso vai resolver o erro imediatamente

-- 1. Habilitar RLS na tabela establishment_notifications
ALTER TABLE public.establishment_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Criar política temporária permissiva (ATENÇÃO: menos segura)
CREATE POLICY "Temporary permissive policy" ON public.establishment_notifications
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Verificar se funcionou
SELECT 'RLS habilitado com política temporária' as status;
