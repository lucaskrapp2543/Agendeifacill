-- Adicionar campo payment_method na tabela appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pendente';

-- Criar tipo enum para métodos de pagamento (opcional, mas mais organizado)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
        CREATE TYPE payment_method_type AS ENUM ('pix', 'credito', 'debito', 'dinheiro', 'pendente');
    END IF;
END $$;

-- Atualizar a coluna para usar o enum (opcional)
-- ALTER TABLE appointments ALTER COLUMN payment_method TYPE payment_method_type USING payment_method::payment_method_type; 