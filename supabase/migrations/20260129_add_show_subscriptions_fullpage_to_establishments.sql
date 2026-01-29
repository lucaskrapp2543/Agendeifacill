-- Permite que o estabelecimento escolha mostrar todas as assinaturas no Booking
-- (sem precisar clicar em "PLANOS MENSAIS")

alter table public.establishments
add column if not exists show_subscriptions_fullpage boolean not null default false;

