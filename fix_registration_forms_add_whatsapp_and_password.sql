-- ADICIONAR campo WhatsApp e mostrar senha em texto claro
-- Primeiro, adicionar coluna WhatsApp
ALTER TABLE registration_forms ADD COLUMN IF NOT EXISTS client_whatsapp VARCHAR(20);

-- Renomear password_hash para password (sem hash, texto claro)
ALTER TABLE registration_forms RENAME COLUMN password_hash TO password;

-- Adicionar comentário explicativo
COMMENT ON COLUMN registration_forms.client_whatsapp IS 'WhatsApp do cliente';
COMMENT ON COLUMN registration_forms.password IS 'Senha em texto claro (visível para admin)';

-- Atualizar políticas se necessário (manter as existentes)
-- As políticas já estão corretas
