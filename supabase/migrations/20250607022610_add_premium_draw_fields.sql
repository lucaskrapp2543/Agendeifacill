-- Adiciona campos para o sorteio na tabela premium_subscriptions
ALTER TABLE premium_subscriptions
ADD COLUMN IF NOT EXISTS is_winner boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS winner_position smallint,
ADD COLUMN IF NOT EXISTS last_draw_date timestamp with time zone;
