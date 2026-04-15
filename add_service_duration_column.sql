-- Coluna legada usada por RPCs/partes antigas do sistema (COALESCE(service_duration, 30)).
-- ⚠️ NUNCA rode UPDATE em massa setando 30 para NULL em produção: isso apaga a duração real
-- de planos que só existia no fluxo antigo e gera “60 virou 30” para todos os clientes.
--
-- Seguro: só garantir que a coluna exista. O app (SubscribersManager / createSubscription)
-- grava service_duration espelhando divided_services ao salvar.

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS service_duration INTEGER;

COMMENT ON COLUMN subscriptions.service_duration IS 'Minutos: espelho do plano (1 serviço = essa duração; vários = soma). Manter preenchido; evitar NULL para não cair no fallback 30 em RPCs legadas.';

-- Intencionalmente REMOVIDO (causava estrago em massa):
-- UPDATE subscriptions SET service_duration = 30 WHERE service_duration IS NULL;
