-- Permite trocar a ordem manualmente na Fila de Espera (dashboard)
-- Sem isso, a fila fica apenas por "ordem de chegada" (created_at).

alter table public.waitlist_entries
add column if not exists queue_position integer;

create index if not exists waitlist_entries_queue_position_idx
  on public.waitlist_entries (establishment_id, status, professional_id, queue_position);

