-- Migração: Adicionar coluna affiliate_link para estabelecimentos
-- Data: 07/06/2025
-- Funcionalidade: Link afiliado do estabelecimento (site, Instagram, loja, etc.)

-- Adicionar coluna affiliate_link à tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS affiliate_link TEXT;

-- Comentário para documentar a coluna
COMMENT ON COLUMN establishments.affiliate_link IS 'Link afiliado do estabelecimento (site, Instagram, loja online, etc.)';

-- Índice para melhorar performance se necessário (opcional)
-- CREATE INDEX IF NOT EXISTS idx_establishments_affiliate_link ON establishments(affiliate_link) WHERE affiliate_link IS NOT NULL; 