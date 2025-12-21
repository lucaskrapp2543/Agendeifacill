# Módulo isolado: Lembretes Automáticos por WhatsApp (WaSenderAPI)

## Objetivo

Implementar lembretes automáticos via WhatsApp **de forma isolada** do core (agendamentos/reservas/pagamentos), permitindo que **cada estabelecimento use o próprio número** (instância) e que o **ADMIN controle ativação e configuração**.

## Estrutura

- `sql/`: scripts SQL para criar **apenas novas tabelas** e políticas (RLS)
- `jobs/`: job Node/TS para envio automático (cron externo)
- `server/`: utilitários backend (cripto + client WaSenderAPI)
- `ui/`: componentes/telas isoladas (não integradas automaticamente)

## Regras de segurança

- A coluna `whatsapp_instances.api_key_encrypted` **nunca** deve ser exposta ao frontend (nem para admin).
- O envio via WaSenderAPI deve ocorrer **apenas no backend/job** usando credenciais descriptografadas.
- As telas do estabelecimento mostram **somente status** (sem chaves/tokens).

## Deploy/execução (visão geral)

1. Aplicar os scripts SQL em `sql/` no Supabase (migrations ou SQL editor).
2. Rodar o job `jobs/sendWhatsappReminders.ts` via cron externo a cada 5 minutos.
3. (Opcional) Integrar as telas em `ui/` ao dashboard existente.

> Observação: este módulo não altera tabelas existentes; cria apenas tabelas novas.


