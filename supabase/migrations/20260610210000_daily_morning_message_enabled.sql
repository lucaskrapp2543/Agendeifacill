-- Mensagem de Bom Dia: toggle por estabelecimento (ativado por padrão)

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS daily_morning_message_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN establishments.daily_morning_message_enabled IS
'Se true, exibe mensagem bíblica/motivacional no primeiro acesso do dia (por navegador/dispositivo).';
