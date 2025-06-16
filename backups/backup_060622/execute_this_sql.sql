-- Execute este SQL no painel do Supabase (SQL Editor)
-- Adiciona campos para fotos personalizadas dos estabelecimentos

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS custom_photo_1_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_2_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_3_url TEXT;

-- Adiciona campo payment_method na tabela appointments (se ainda não foi feito)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pendente';

-- Verificar se as colunas foram criadas
SELECT 'establishments' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('custom_photo_1_url', 'custom_photo_2_url', 'custom_photo_3_url')

UNION ALL

SELECT 'appointments' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'payment_method'; 