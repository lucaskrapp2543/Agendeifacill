-- Remocao da estrutura de abertura de caixa antiga
-- Seguro para rodar mesmo se a estrutura nao existir.

DROP TABLE IF EXISTS daily_cash_openings CASCADE;

ALTER TABLE IF EXISTS establishments
  DROP COLUMN IF EXISTS caixa_completo;
