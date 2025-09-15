-- Criar tabela de logs de auditoria para assinantes
-- Execute este script no SQL Editor do Supabase se desejar logs persistentes no banco

CREATE TABLE IF NOT EXISTS subscriber_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscriber_id UUID NOT NULL,
    subscriber_name TEXT NOT NULL,
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'end_date_update', 'status_change', etc.
    old_end_date DATE,
    new_end_date DATE,
    old_status TEXT,
    new_status TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB -- Para dados adicionais
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_subscriber_id ON subscriber_audit_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_establishment_id ON subscriber_audit_logs(establishment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON subscriber_audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON subscriber_audit_logs(action);

-- Habilitar RLS
ALTER TABLE subscriber_audit_logs ENABLE ROW LEVEL SECURITY;

-- Criar política para que estabelecimentos possam ver seus próprios logs
CREATE POLICY "Establishments can view their audit logs" ON subscriber_audit_logs
    FOR SELECT
    USING (establishment_id IN (
        SELECT id FROM establishments WHERE owner_id = auth.uid()
    ));

-- Criar política para inserir logs (apenas para usuários autenticados)
CREATE POLICY "Authenticated users can insert audit logs" ON subscriber_audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE subscriber_audit_logs IS 'Logs de auditoria para alterações em assinantes';
COMMENT ON COLUMN subscriber_audit_logs.action IS 'Tipo de ação: end_date_update, status_change, etc.';
COMMENT ON COLUMN subscriber_audit_logs.metadata IS 'Dados adicionais em formato JSON';

-- Função para limpar logs antigos (manter apenas últimos 6 meses)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM subscriber_audit_logs 
    WHERE changed_at < NOW() - INTERVAL '6 months';
    
    RAISE NOTICE 'Logs de auditoria antigos removidos';
END;
$$;

-- Criar trigger para limpeza automática (opcional)
-- CREATE OR REPLACE FUNCTION trigger_cleanup_audit_logs()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     -- Limpar logs antigos a cada 100 inserções
--     IF (SELECT COUNT(*) FROM subscriber_audit_logs) % 100 = 0 THEN
--         PERFORM cleanup_old_audit_logs();
--     END IF;
--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER cleanup_audit_logs_trigger
--     AFTER INSERT ON subscriber_audit_logs
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_cleanup_audit_logs();
