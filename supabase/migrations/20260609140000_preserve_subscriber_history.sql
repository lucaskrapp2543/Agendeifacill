-- Preserva histórico de atendimentos de assinantes ao remover/arquivar cliente.
-- Antes: DELETE em client_subscriptions apagava subscriber_attendances (ON DELETE CASCADE).

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.client_subscriptions.archived_at IS
  'Quando preenchido, assinante foi removido da lista ativa mas permanece no histórico mensal.';

ALTER TABLE public.subscriber_attendances
  ADD COLUMN IF NOT EXISTS client_name_snapshot text,
  ADD COLUMN IF NOT EXISTS subscription_name_snapshot text;

-- Preenche snapshots onde a assinatura ainda existe
UPDATE public.subscriber_attendances sa
SET
  client_name_snapshot = COALESCE(
    NULLIF(TRIM(sa.client_name_snapshot), ''),
    NULLIF(TRIM(cs.client_name_override), ''),
    NULLIF(TRIM(cs.subscriber_name), ''),
    'Cliente'
  ),
  subscription_name_snapshot = COALESCE(
    NULLIF(TRIM(sa.subscription_name_snapshot), ''),
    NULLIF(TRIM(s.name), ''),
    'Plano'
  )
FROM public.client_subscriptions cs
LEFT JOIN public.subscriptions s ON s.id = cs.subscription_id
WHERE sa.client_subscription_id = cs.id;

-- Permite NULL antes de limpar órfãos (ordem importa!)
ALTER TABLE public.subscriber_attendances
  ALTER COLUMN client_subscription_id DROP NOT NULL;

ALTER TABLE public.subscriber_attendances
  DROP CONSTRAINT IF EXISTS subscriber_attendances_client_subscription_id_fkey;

-- Órfãos: assinatura já apagada no passado, atendimento ficou
UPDATE public.subscriber_attendances sa
SET
  client_name_snapshot = COALESCE(NULLIF(TRIM(sa.client_name_snapshot), ''), 'Cliente (removido)'),
  subscription_name_snapshot = COALESCE(NULLIF(TRIM(sa.subscription_name_snapshot), ''), 'Plano'),
  client_subscription_id = NULL
WHERE sa.client_subscription_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_subscriptions cs
    WHERE cs.id = sa.client_subscription_id
  );

ALTER TABLE public.subscriber_attendances
  ADD CONSTRAINT subscriber_attendances_client_subscription_id_fkey
  FOREIGN KEY (client_subscription_id)
  REFERENCES public.client_subscriptions(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.subscriber_attendances.client_name_snapshot IS
  'Nome do assinante no momento do atendimento (preservado se assinatura for removida).';
COMMENT ON COLUMN public.subscriber_attendances.subscription_name_snapshot IS
  'Nome do plano no momento do atendimento (preservado se assinatura for removida).';
