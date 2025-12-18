-- Liberação de "Pagamento adiantado" pelo admin
-- Por padrão todo estabelecimento vem com isso DESATIVADO.
-- O barbeiro só enxerga a opção de pagamento adiantado quando o admin libera.

alter table public.establishments
add column if not exists pagamento_adiantado_liberado_admin boolean not null default false;

-- Backfill para linhas antigas que possam estar com null (por segurança)
update public.establishments
set pagamento_adiantado_liberado_admin = false
where pagamento_adiantado_liberado_admin is null;


