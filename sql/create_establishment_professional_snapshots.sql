-- Snapshot completo de profissionais para recuperação de desastre.
-- Seguro para rodar mais de uma vez.

create table if not exists public.establishment_professional_snapshots (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  reason text not null default 'manual_snapshot',
  snapshot jsonb not null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_establishment_professional_snapshots_establishment_created
  on public.establishment_professional_snapshots (establishment_id, created_at desc);

alter table public.establishment_professional_snapshots enable row level security;

drop policy if exists "snapshot_select_owner" on public.establishment_professional_snapshots;
create policy "snapshot_select_owner"
  on public.establishment_professional_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.establishments e
      where e.id = establishment_professional_snapshots.establishment_id
        and e.owner_id = auth.uid()
    )
  );

drop policy if exists "snapshot_insert_owner" on public.establishment_professional_snapshots;
create policy "snapshot_insert_owner"
  on public.establishment_professional_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.establishments e
      where e.id = establishment_professional_snapshots.establishment_id
        and e.owner_id = auth.uid()
    )
  );

drop policy if exists "snapshot_delete_owner" on public.establishment_professional_snapshots;
create policy "snapshot_delete_owner"
  on public.establishment_professional_snapshots
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.establishments e
      where e.id = establishment_professional_snapshots.establishment_id
        and e.owner_id = auth.uid()
    )
  );
