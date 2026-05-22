-- Checkout pendente dos cadastros vindos do site.
-- A conta/estabelecimento só é criado pelo webhook depois do pagamento aprovado.

create table if not exists public.site_registration_checkouts (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  establishment_name text not null,
  email text not null,
  password text not null,
  client_whatsapp text,
  selected_plan text not null check (selected_plan in ('prata', 'diamante')),
  amount_cents integer not null check (amount_cents > 0),
  payment_method text not null check (payment_method in ('pix', 'recurring_card')),
  payment_provider text not null default 'mercadopago',
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'expired', 'cancelled', 'failed', 'converted', 'conversion_failed')
  ),
  payment_id text unique,
  preapproval_id text unique,
  checkout_url text,
  qr_code text,
  qr_code_base64 text,
  created_user_id uuid,
  created_establishment_id uuid references public.establishments(id) on delete set null,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_registration_checkouts_created_at
  on public.site_registration_checkouts(created_at desc);

create index if not exists idx_site_registration_checkouts_status
  on public.site_registration_checkouts(status);

create index if not exists idx_site_registration_checkouts_plan
  on public.site_registration_checkouts(selected_plan);

create index if not exists idx_site_registration_checkouts_establishment
  on public.site_registration_checkouts(created_establishment_id);

alter table public.site_registration_checkouts enable row level security;

drop policy if exists "Support admin can read site registration checkouts" on public.site_registration_checkouts;
create policy "Support admin can read site registration checkouts"
  on public.site_registration_checkouts
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');

drop policy if exists "Support admin can update site registration checkouts" on public.site_registration_checkouts;
create policy "Support admin can update site registration checkouts"
  on public.site_registration_checkouts
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');

alter table public.establishments
  add column if not exists plan_prata_active boolean not null default false;

alter table public.establishments
  add column if not exists mercadopago_billing_amount numeric(10,2);

alter table public.establishments
  add column if not exists payment_alert_enabled boolean not null default false;

alter table public.establishment_billing_subscriptions
  add column if not exists preapproval_id text;

alter table public.establishment_billing_subscriptions
  add column if not exists payer_email text;

alter table public.establishment_billing_subscriptions
  add column if not exists external_reference text;

alter table public.establishment_billing_subscriptions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_establishment_billing_subscriptions_preapproval_id
  on public.establishment_billing_subscriptions(preapproval_id)
  where preapproval_id is not null;
