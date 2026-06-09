-- AFCoins / Beneficios Agendei Facil - Fase 1 BLINDADA (sem trigger em appointments)
-- Objetivo: criar base AFCoins sem tocar no caminho critico de agendamento.

create table if not exists public.afcoin_settings (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  enabled boolean not null default true,
  points_name_phone integer not null default 5,
  points_booking_confirm integer not null default 10,
  points_online_bonus integer not null default 45,
  redeem_threshold integer not null default 1000,
  redeem_value_cents integer not null default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint afcoin_settings_points_name_phone_check check (points_name_phone >= 0 and points_name_phone <= 500),
  constraint afcoin_settings_points_booking_confirm_check check (points_booking_confirm >= 0 and points_booking_confirm <= 1000),
  constraint afcoin_settings_points_online_bonus_check check (points_online_bonus >= 0 and points_online_bonus <= 5000),
  constraint afcoin_settings_redeem_threshold_check check (redeem_threshold > 0),
  constraint afcoin_settings_redeem_value_cents_check check (redeem_value_cents > 0)
);

create table if not exists public.afcoin_wallets (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  balance integer not null default 0,
  total_earned integer not null default 0,
  total_spent integer not null default 0,
  online_payments_count integer not null default 0,
  local_payments_count integer not null default 0,
  last_appointment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint afcoin_wallets_balance_check check (balance >= 0),
  constraint afcoin_wallets_total_earned_check check (total_earned >= 0),
  constraint afcoin_wallets_total_spent_check check (total_spent >= 0),
  constraint afcoin_wallets_online_payments_count_check check (online_payments_count >= 0),
  constraint afcoin_wallets_local_payments_count_check check (local_payments_count >= 0),
  constraint afcoin_wallets_establishment_phone_uniq unique (establishment_id, customer_phone)
);

create index if not exists idx_afcoin_wallets_establishment on public.afcoin_wallets(establishment_id);
create index if not exists idx_afcoin_wallets_balance_desc on public.afcoin_wallets(establishment_id, balance desc);

create table if not exists public.afcoin_transactions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  wallet_id uuid not null references public.afcoin_wallets(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  payment_id text,
  source text not null default 'appointment',
  rule_key text not null,
  points_delta integer not null,
  transaction_type text not null default 'earn',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint afcoin_transactions_type_check check (transaction_type in ('earn', 'spend', 'adjustment', 'refund')),
  constraint afcoin_transactions_points_nonzero_check check (points_delta <> 0)
);

create index if not exists idx_afcoin_transactions_establishment_created on public.afcoin_transactions(establishment_id, created_at desc);
create index if not exists idx_afcoin_transactions_wallet_created on public.afcoin_transactions(wallet_id, created_at desc);
create index if not exists idx_afcoin_transactions_appointment on public.afcoin_transactions(appointment_id);
create unique index if not exists idx_afcoin_transactions_rule_per_appointment
  on public.afcoin_transactions(establishment_id, appointment_id, rule_key)
  where appointment_id is not null;

create table if not exists public.afcoin_rewards (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  wallet_id uuid not null references public.afcoin_wallets(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  reward_code text,
  points_spent integer not null default 0,
  discount_cents integer not null default 0,
  original_amount_cents integer,
  paid_amount_cents integer,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint afcoin_rewards_status_check check (status in ('pending', 'compensated', 'monthly_offset', 'cancelled')),
  constraint afcoin_rewards_points_spent_check check (points_spent >= 0),
  constraint afcoin_rewards_discount_cents_check check (discount_cents >= 0)
);

create index if not exists idx_afcoin_rewards_establishment_created on public.afcoin_rewards(establishment_id, created_at desc);
create index if not exists idx_afcoin_rewards_wallet on public.afcoin_rewards(wallet_id, created_at desc);
create index if not exists idx_afcoin_rewards_status on public.afcoin_rewards(establishment_id, status);

create table if not exists public.afcoin_compensations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  reward_id uuid references public.afcoin_rewards(id) on delete set null,
  amount_cents integer not null default 0,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint afcoin_compensations_status_check check (status in ('pending', 'compensated', 'monthly_offset', 'cancelled')),
  constraint afcoin_compensations_amount_cents_check check (amount_cents >= 0)
);

create index if not exists idx_afcoin_compensations_establishment_status on public.afcoin_compensations(establishment_id, status, created_at desc);

create or replace function public.afcoin_normalize_phone(raw text)
returns text
language plpgsql
as $$
declare
  digits text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
begin
  if digits = '' then
    return '';
  end if;
  if length(digits) in (12, 13) and left(digits, 2) = '55' then
    return right(digits, length(digits) - 2);
  end if;
  return digits;
end;
$$;

create or replace function public.afcoin_get_or_create_wallet(
  p_establishment_id uuid,
  p_customer_phone text,
  p_customer_name text
)
returns uuid
language plpgsql
as $$
declare
  v_wallet_id uuid;
begin
  if coalesce(trim(p_customer_phone), '') = '' then
    return null;
  end if;

  insert into public.afcoin_wallets (
    establishment_id,
    customer_phone,
    customer_name
  )
  values (
    p_establishment_id,
    p_customer_phone,
    nullif(trim(coalesce(p_customer_name, '')), '')
  )
  on conflict (establishment_id, customer_phone)
  do update set
    customer_name = coalesce(
      nullif(trim(excluded.customer_name), ''),
      public.afcoin_wallets.customer_name
    ),
    updated_at = now()
  returning id into v_wallet_id;

  return v_wallet_id;
end;
$$;

create or replace function public.afcoin_add_transaction(
  p_establishment_id uuid,
  p_customer_phone text,
  p_customer_name text,
  p_appointment_id uuid,
  p_payment_id text,
  p_rule_key text,
  p_points_delta integer,
  p_is_online boolean,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
as $$
declare
  v_wallet_id uuid;
  v_inserted_rows integer := 0;
begin
  if p_points_delta = 0 then
    return false;
  end if;

  v_wallet_id := public.afcoin_get_or_create_wallet(
    p_establishment_id,
    p_customer_phone,
    p_customer_name
  );

  if v_wallet_id is null then
    return false;
  end if;

  insert into public.afcoin_transactions (
    establishment_id,
    wallet_id,
    appointment_id,
    payment_id,
    source,
    rule_key,
    points_delta,
    transaction_type,
    metadata
  )
  values (
    p_establishment_id,
    v_wallet_id,
    p_appointment_id,
    nullif(trim(coalesce(p_payment_id, '')), ''),
    'appointment',
    p_rule_key,
    p_points_delta,
    case when p_points_delta > 0 then 'earn' else 'spend' end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (establishment_id, appointment_id, rule_key) do nothing;

  get diagnostics v_inserted_rows = row_count;
  if v_inserted_rows <= 0 then
    return false;
  end if;

  update public.afcoin_wallets
  set
    balance = greatest(0, balance + p_points_delta),
    total_earned = total_earned + case when p_points_delta > 0 then p_points_delta else 0 end,
    total_spent = total_spent + case when p_points_delta < 0 then abs(p_points_delta) else 0 end,
    online_payments_count = online_payments_count + case when p_is_online then 1 else 0 end,
    local_payments_count = local_payments_count + case when not p_is_online then 1 else 0 end,
    last_appointment_at = now(),
    updated_at = now()
  where id = v_wallet_id;

  return true;
end;
$$;

create or replace function public.afcoin_register_booking_event(
  p_establishment_id uuid,
  p_appointment_id uuid,
  p_client_phone text,
  p_client_name text,
  p_rule text,
  p_payment_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mp_connected boolean := false;
  v_enabled boolean := true;
  v_settings record;
  v_rule text := lower(coalesce(trim(p_rule), ''));
  v_points integer := 0;
  v_phone text;
  v_is_online boolean := false;
  v_appointment_date date;
  v_program_start date := date '2026-06-08';
begin
  if p_establishment_id is null then
    return false;
  end if;

  select (coalesce(trim(e.mercadopago_access_token), '') <> '')
    into v_mp_connected
  from public.establishments e
  where e.id = p_establishment_id
  limit 1;

  if not coalesce(v_mp_connected, false) then
    return false;
  end if;

  select
    coalesce(s.enabled, true) as enabled,
    coalesce(s.points_name_phone, 5) as points_name_phone,
    coalesce(s.points_booking_confirm, 10) as points_booking_confirm,
    coalesce(s.points_online_bonus, 45) as points_online_bonus
  into v_settings
  from public.afcoin_settings s
  where s.establishment_id = p_establishment_id
  limit 1;

  if found then
    v_enabled := coalesce(v_settings.enabled, true);
  end if;

  if not v_enabled then
    return false;
  end if;

  v_phone := public.afcoin_normalize_phone(coalesce(p_client_phone, ''));
  if coalesce(v_phone, '') = '' then
    return false;
  end if;

  if p_appointment_id is not null then
    select a.appointment_date
      into v_appointment_date
    from public.appointments a
    where a.id = p_appointment_id
    limit 1;

    if found and v_appointment_date is not null and v_appointment_date < v_program_start then
      return false;
    end if;
  end if;

  if v_rule = 'name_phone_5' then
    v_points := coalesce(v_settings.points_name_phone, 5);
    v_is_online := false;
  elsif v_rule = 'booking_confirm_10' then
    v_points := coalesce(v_settings.points_booking_confirm, 10);
    v_is_online := false;
  elsif v_rule = 'local_bonus_3' then
    v_points := 3;
    v_is_online := false;
  elsif v_rule = 'local_total_18' then
    v_points := coalesce(v_settings.points_name_phone, 5)
      + coalesce(v_settings.points_booking_confirm, 10)
      + 3;
    v_is_online := false;
  elsif v_rule = 'local_total_10' then
    v_points := coalesce(v_settings.points_booking_confirm, 10);
    v_is_online := false;
  elsif v_rule = 'online_bonus_45' then
    v_points := coalesce(v_settings.points_online_bonus, 45);
    v_is_online := true;
  elsif v_rule = 'online_total_60' then
    v_points := coalesce(v_settings.points_name_phone, 5)
      + coalesce(v_settings.points_booking_confirm, 10)
      + coalesce(v_settings.points_online_bonus, 45);
    v_is_online := true;
  else
    return false;
  end if;

  return public.afcoin_add_transaction(
    p_establishment_id,
    v_phone,
    coalesce(p_client_name, 'Cliente'),
    p_appointment_id,
    p_payment_id,
    v_rule,
    v_points,
    v_is_online,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

comment on table public.afcoin_settings is 'Configuracoes AFCoins por estabelecimento (habilitacao e regras de pontuacao/resgate).';
comment on table public.afcoin_wallets is 'Carteira AFCoins por cliente (telefone) em cada estabelecimento.';
comment on table public.afcoin_transactions is 'Historico idempotente de pontuacao/uso AFCoins.';
comment on table public.afcoin_rewards is 'Beneficios AFCoins desbloqueados/usados por cliente.';
comment on table public.afcoin_compensations is 'Controle de compensacoes que o Agendei Facil deve ao estabelecimento por beneficios usados.';
comment on function public.afcoin_register_booking_event(uuid, uuid, text, text, text, text, jsonb)
is 'Registro controlado de AFCoins por evento, sem trigger em appointments.';

grant execute on function public.afcoin_register_booking_event(uuid, uuid, text, text, text, text, jsonb) to anon, authenticated, service_role;

grant select on public.afcoin_wallets to anon, authenticated;

create or replace function public.afcoin_get_client_wallets(
  p_establishment_ids uuid[],
  p_phone_variants text[]
)
returns table (
  establishment_id uuid,
  customer_phone text,
  balance integer,
  online_payments_count integer,
  local_payments_count integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_phones text[];
begin
  if coalesce(array_length(p_establishment_ids, 1), 0) = 0
     or coalesce(array_length(p_phone_variants, 1), 0) = 0 then
    return;
  end if;

  select coalesce(array_agg(distinct public.afcoin_normalize_phone(v)), array[]::text[])
    into v_normalized_phones
  from unnest(p_phone_variants) as u(v)
  where coalesce(public.afcoin_normalize_phone(v), '') <> '';

  if coalesce(array_length(v_normalized_phones, 1), 0) = 0 then
    return;
  end if;

  return query
  select
    w.establishment_id,
    w.customer_phone,
    w.balance,
    w.online_payments_count,
    w.local_payments_count,
    w.updated_at
  from public.afcoin_wallets w
  where w.establishment_id = any(p_establishment_ids)
    and w.customer_phone = any(v_normalized_phones);
end;
$$;

grant execute on function public.afcoin_get_client_wallets(uuid[], text[]) to anon, authenticated, service_role;

