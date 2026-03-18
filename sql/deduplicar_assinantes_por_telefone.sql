-- Deduplicacao segura de assinantes por telefone no mesmo estabelecimento.
-- Mantem o registro mais "forte" e remove os demais:
-- 1) maior end_date
-- 2) payment_status = paid
-- 3) updated_at mais recente
-- 4) created_at mais recente
--
-- IMPORTANTE:
-- - Rode primeiro em homologacao, depois em producao.
-- - Se quiser aplicar apenas para um estabelecimento, descomente o filtro em "base".

begin;

create table if not exists public.client_subscriptions_dedup_backup (
  backup_at timestamptz not null default now(),
  backup_reason text not null default 'dedup_by_phone',
  source_id uuid not null,
  row_data jsonb not null
);

with base as (
  select
    cs.*,
    case
      when regexp_replace(coalesce(cs.subscriber_whatsapp, cs.client_whatsapp, ''), '\D', '', 'g') ~ '^55\d{10,11}$'
        then substring(regexp_replace(coalesce(cs.subscriber_whatsapp, cs.client_whatsapp, ''), '\D', '', 'g') from 3)
      else regexp_replace(coalesce(cs.subscriber_whatsapp, cs.client_whatsapp, ''), '\D', '', 'g')
    end as phone_key
  from public.client_subscriptions cs
  where coalesce(cs.subscriber_whatsapp, cs.client_whatsapp, '') <> ''
    -- and cs.establishment_id = 'COLE_O_ID_DO_ESTABELECIMENTO_AQUI'
),
ranked as (
  select
    b.*,
    row_number() over (
      partition by b.establishment_id, b.phone_key
      order by
        coalesce(b.end_date, date '1900-01-01') desc,
        case when lower(coalesce(b.payment_status, '')) = 'paid' then 1 else 0 end desc,
        coalesce(b.updated_at, b.created_at, now()) desc,
        coalesce(b.created_at, now()) desc,
        b.id desc
    ) as rn
  from base b
),
to_delete as (
  select r.*
  from ranked r
  where r.rn > 1
),
backup_rows as (
  insert into public.client_subscriptions_dedup_backup (source_id, row_data)
  select td.id, to_jsonb(td)
  from to_delete td
  returning source_id
)
delete from public.client_subscriptions cs
using to_delete td
where cs.id = td.id;

commit;

-- Consulta de conferencia (execute depois):
-- select establishment_id, phone_key, count(*) as total
-- from (
--   select
--     establishment_id,
--     case
--       when regexp_replace(coalesce(subscriber_whatsapp, client_whatsapp, ''), '\D', '', 'g') ~ '^55\d{10,11}$'
--         then substring(regexp_replace(coalesce(subscriber_whatsapp, client_whatsapp, ''), '\D', '', 'g') from 3)
--       else regexp_replace(coalesce(subscriber_whatsapp, client_whatsapp, ''), '\D', '', 'g')
--     end as phone_key
--   from public.client_subscriptions
--   where coalesce(subscriber_whatsapp, client_whatsapp, '') <> ''
-- ) x
-- group by 1,2
-- having count(*) > 1
-- order by total desc;
