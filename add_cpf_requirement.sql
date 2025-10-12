-- Adicionar funcionalidade de solicitar CPF no agendamento
-- Permite que estabelecimentos solicitem CPF dos clientes para emissão de nota fiscal

-- 1. Adicionar coluna para configurar se o estabelecimento solicita CPF
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS require_cpf BOOLEAN DEFAULT false;

COMMENT ON COLUMN establishments.require_cpf IS 'Define se o estabelecimento solicita CPF dos clientes no agendamento';

-- 2. Adicionar coluna para armazenar o CPF do cliente no agendamento
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS client_cpf TEXT DEFAULT NULL;

COMMENT ON COLUMN appointments.client_cpf IS 'CPF do cliente informado no agendamento (para emissão de nota fiscal)';

-- 3. Verificar se funcionou
SELECT 
  id,
  name,
  require_cpf
FROM establishments
LIMIT 5;

SELECT 
  id,
  client_name,
  client_cpf,
  appointment_date
FROM appointments
ORDER BY created_at DESC
LIMIT 5;

