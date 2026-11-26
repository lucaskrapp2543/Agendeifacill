-- ============================================================================
-- Venda do Plano Diamante pela Cakto (novos clientes) — tabelas novas.
-- Agendei Fácil, 25/11/2026. Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem problema.
-- ----------------------------------------------------------------------------
-- MOTIVO: o cliente novo paga o Diamante (R$ 67,90/mês) na Cakto. A Cakto avisa o
-- sistema, e só quem tem pagamento confirmado consegue criar a conta em /cadastrar.
-- Para isso o sistema precisa guardar "esse e-mail pagou".
--
-- O QUE FAZ:
--   1) cakto_orders  → um registro por pagamento da Cakto (compra, renovação),
--      com e-mail, nome, telefone, valor, se já virou conta e de qual barbearia.
--   2) cakto_events  → cópia de cada aviso recebido da Cakto, para conferência.
--
-- NÃO MEXE em nenhuma tabela existente. Não apaga nem altera nenhum dado.
--
-- QUEM ENXERGA: só o servidor e a conta do suporte (mesma regra da tela
-- "Clientes Site" do admin). Barbearia e visitante não leem nada daqui.
--
-- RISCO: nenhum para o que já funciona. São duas tabelas novas e vazias.
--
-- Para desfazer: drop table public.cakto_events; drop table public.cakto_orders;
-- ============================================================================

create table if not exists public.cakto_orders (
  id uuid primary key default gen_random_uuid(),
  cakto_order_id text not null unique,
  ref_id text,
  kind text not null default 'signup' check (kind in ('signup', 'renewal')),
  status text not null default 'paid' check (status in ('paid', 'refunded', 'chargeback')),
  email text not null check (email = lower(email)),
  customer_name text,
  customer_phone text,
  customer_doc text,
  amount_cents integer not null default 0,
  payment_method text,
  product_id text,
  offer_id text,
  subscription_id text,
  subscription_period integer,
  subscription_status text,
  paid_at timestamptz,
  refunded_at timestamptz,
  used_at timestamptz,
  owner_id uuid,
  establishment_id uuid references public.establishments(id) on delete set null,
  needs_attention boolean not null default false,
  attention_reason text,
  last_event text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cakto_orders_email on public.cakto_orders (email);
create index if not exists idx_cakto_orders_subscription
  on public.cakto_orders (subscription_id) where subscription_id is not null;
create index if not exists idx_cakto_orders_establishment
  on public.cakto_orders (establishment_id) where establishment_id is not null;

create table if not exists public.cakto_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  event text not null,
  cakto_order_id text,
  order_status text,
  validated_by text,
  payload jsonb not null default '{}'::jsonb,
  result text,
  processed_at timestamptz
);

create index if not exists idx_cakto_events_order on public.cakto_events (cakto_order_id);

-- Porta trancada: com a trava ligada e sem regra, ninguém de fora lê.
alter table public.cakto_orders enable row level security;
alter table public.cakto_events enable row level security;

revoke all on public.cakto_orders from anon;
revoke all on public.cakto_events from anon, authenticated;

-- Só a conta do suporte vê e corrige as vendas pelo painel admin.
drop policy if exists "Support admin can read cakto orders" on public.cakto_orders;
create policy "Support admin can read cakto orders"
  on public.cakto_orders
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');

drop policy if exists "Support admin can update cakto orders" on public.cakto_orders;
create policy "Support admin can update cakto orders"
  on public.cakto_orders
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');

notify pgrst, 'reload schema';

-- Conferência (opcional, só leitura): deve mostrar as 2 tabelas, vazias.
-- select 'cakto_orders' as tabela, count(*) from public.cakto_orders
-- union all select 'cakto_events', count(*) from public.cakto_events;
