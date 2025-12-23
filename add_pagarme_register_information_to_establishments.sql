-- Adiciona um campo JSONB para armazenar dados adicionais exigidos pela Pagar.me
-- (ex.: para criação de recebedor com CPF/pessoa física: nome, nascimento, renda, profissão e endereço)
-- ✅ Seguro: apenas adiciona coluna nova, não altera dados existentes.

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS pagarme_register_information jsonb;









