-- Pagamento adiantado opcional (Pagar.me)
-- Quando TRUE: o cliente pode finalizar o agendamento sem pagar, mas verá a opção "pagar agora".
-- Quando FALSE: se pagamento adiantado estiver ativo, o pagamento é obrigatório para confirmar.

alter table public.establishments
add column if not exists pagamento_adiantado_opcional boolean not null default false;

update public.establishments
set pagamento_adiantado_opcional = false
where pagamento_adiantado_opcional is null;


