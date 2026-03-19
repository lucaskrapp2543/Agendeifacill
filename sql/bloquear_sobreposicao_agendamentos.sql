-- Proteção definitiva contra sobreposição de horários no banco.
-- Regra: mesmo estabelecimento + mesmo profissional + mesmo dia
-- não pode ter intervalos de horário sobrepostos (exceto cancelados).
--
-- Compatível com base atual:
-- - usa duração com fallback para 30 minutos;
-- - ignora registros com status = 'cancelled';
-- - não bloqueia update do próprio registro.

create or replace function public.prevent_overlapping_appointments()
returns trigger
language plpgsql
as $$
declare
  new_start_minutes integer;
  new_duration_minutes integer;
  new_end_minutes integer;
  conflict_id uuid;
begin
  -- Cancelados não disputam horário.
  if coalesce(lower(trim(new.status::text)), '') = 'cancelled' then
    return new;
  end if;

  -- Sem dados mínimos, não tenta validar.
  if new.establishment_id is null
     or new.appointment_date is null
     or coalesce(trim(new.appointment_time::text), '') = ''
     or coalesce(trim(new.professional::text), '') = '' then
    return new;
  end if;

  new_start_minutes :=
    (split_part(new.appointment_time::text, ':', 1)::int * 60)
    + split_part(new.appointment_time::text, ':', 2)::int;

  new_duration_minutes := coalesce(
    nullif(regexp_replace(coalesce(new.duration::text, ''), '\D', '', 'g'), '')::int,
    30
  );

  if new_duration_minutes <= 0 then
    new_duration_minutes := 30;
  end if;

  new_end_minutes := new_start_minutes + new_duration_minutes;

  select a.id
    into conflict_id
  from public.appointments a
  where a.establishment_id = new.establishment_id
    and a.appointment_date = new.appointment_date
    and coalesce(lower(trim(a.status::text)), '') <> 'cancelled'
    and lower(trim(coalesce(a.professional::text, ''))) = lower(trim(coalesce(new.professional::text, '')))
    and a.id is distinct from new.id
    and (
      new_start_minutes
        < (
          (split_part(a.appointment_time::text, ':', 1)::int * 60)
          + split_part(a.appointment_time::text, ':', 2)::int
          + coalesce(nullif(regexp_replace(coalesce(a.duration::text, ''), '\D', '', 'g'), '')::int, 30)
        )
      and
      (
        (split_part(a.appointment_time::text, ':', 1)::int * 60)
        + split_part(a.appointment_time::text, ':', 2)::int
      ) < new_end_minutes
    )
  limit 1;

  if conflict_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Conflito de horário: já existe agendamento neste intervalo para este profissional.',
      detail = format(
        'establishment_id=%s, professional=%s, appointment_date=%s, appointment_time=%s',
        new.establishment_id,
        coalesce(new.professional::text, ''),
        new.appointment_date::text,
        coalesce(new.appointment_time::text, '')
      ),
      hint = 'Escolha outro horário ou cancele o agendamento existente.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_overlapping_appointments on public.appointments;

create trigger trg_prevent_overlapping_appointments
before insert or update of establishment_id, appointment_date, appointment_time, duration, professional, status
on public.appointments
for each row
execute function public.prevent_overlapping_appointments();

