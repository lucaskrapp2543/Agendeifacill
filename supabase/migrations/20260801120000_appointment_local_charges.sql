-- =============================================================================
-- 💳 COBRAR CLIENTE — PIX de balcão para agendamentos NÃO pagos online
-- -----------------------------------------------------------------------------
-- MOTIVO
--   Hoje o barbeiro que recebe no balcão usa o PIX da conta pessoal dele. Com
--   isso o pagamento não passa pelo sistema, ele não pontua na Meta Mensal e a
--   plataforma não recebe a taxa. Este recurso gera um QR Code na tela, o
--   cliente paga ali, e o pagamento vira um pagamento online legítimo.
--
-- IMPACTO
--   Cria UMA tabela nova, isolada. NÃO altera nenhuma tabela existente.
--   Em especial, NÃO grava nada em `appointments`:
--     • `status` continua como está (quem conclui é o barbeiro, sempre)
--     • `payment_transaction_id` não é tocado
--     • `payment_status` não é tocado
--   Isso é proposital. Gravar em appointments faria o card exibir
--   "Pago integralmente online" — falso, porque o cliente pagou no balcão —
--   e, em quem usa 50%, ainda mostraria "Restante no salão" errado.
--
-- ESCOPO
--   O botão só existe para agendamento SEM pagamento online. Onde já houve
--   pagamento (100% ou 50%), o botão não nasce — logo, não há como cobrar
--   duas vezes o mesmo agendamento por caminhos diferentes.
--
-- A TAXA
--   Continua sendo a taxa de plataforma do Mercado Pago (application_fee), pelo
--   mesmo caminho dos pagamentos do booking. O R$1,00 é registrado em
--   `admin_mp_commissions` pelo webhook — logo conta na Meta Mensal sem
--   nenhuma regra nova.
--
-- ROLLBACK
--   DROP TABLE public.appointment_local_charges; — e o sistema volta a ser
--   exatamente o que era antes. Nada mais depende dela.
--
-- ANTES DE RODAR: execute 20260801120000_appointment_local_charges_VERIFY.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight — aborta sem alterar nada se faltar dependência
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='appointments') THEN
    v_missing := v_missing || ' appointments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='establishments') THEN
    v_missing := v_missing || ' establishments';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='establishments' AND column_name='owner_id'
  ) THEN
    v_missing := v_missing || ' establishments.owner_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration cobrança PIX no balcão abortada. Dependências faltando:%', v_missing;
  END IF;
END $$;

-- Trigger helper (idempotente — mesmo corpo usado em outras migrations)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Tabela — espelha o padrão de establishment_billing_payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_local_charges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id   uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id     uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  amount_cents       integer NOT NULL CHECK (amount_cents > 0),
  payment_provider   text NOT NULL DEFAULT 'mercadopago',
  payment_id         text NOT NULL UNIQUE,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired')),
  qr_code            text,
  qr_code_base64     text,
  external_reference text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by         uuid,
  paid_at            timestamptz,
  expires_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_local_charges_appointment
  ON public.appointment_local_charges (appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_local_charges_establishment
  ON public.appointment_local_charges (establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointment_local_charges_status
  ON public.appointment_local_charges (status);

-- Trava de duplicidade: no máximo UMA cobrança aberta e UMA paga por
-- agendamento. Se o barbeiro clicar duas vezes, o servidor reaproveita a
-- cobrança que já existe em vez de gerar outro QR Code.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointment_local_charge_pending
  ON public.appointment_local_charges (appointment_id) WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointment_local_charge_paid
  ON public.appointment_local_charges (appointment_id) WHERE status = 'paid';

COMMENT ON TABLE public.appointment_local_charges IS
  'PIX gerado no balcão para agendamento sem pagamento online. NÃO altera appointments (status, payment_status e payment_transaction_id ficam intocados).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_appointment_local_charges_updated_at') THEN
    CREATE TRIGGER trg_appointment_local_charges_updated_at
    BEFORE UPDATE ON public.appointment_local_charges
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) RLS — o dono lê e cancela as próprias; quem CRIA e CONFIRMA é o servidor.
--    A criação fica fora do navegador de propósito: é ela que define o valor
--    cobrado e a taxa da plataforma.
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointment_local_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own local charges" ON public.appointment_local_charges;
CREATE POLICY "Owner reads own local charges"
  ON public.appointment_local_charges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = appointment_local_charges.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin reads all local charges" ON public.appointment_local_charges;
CREATE POLICY "Admin reads all local charges"
  ON public.appointment_local_charges
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- Cancelar uma cobrança aberta é a única escrita permitida ao dono. Nunca pode
-- marcar como paga — só o webhook do Mercado Pago faz isso.
DROP POLICY IF EXISTS "Owner cancels own pending charge" ON public.appointment_local_charges;
CREATE POLICY "Owner cancels own pending charge"
  ON public.appointment_local_charges
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = appointment_local_charges.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('pending', 'cancelled'));

GRANT SELECT ON public.appointment_local_charges TO authenticated;
GRANT UPDATE ON public.appointment_local_charges TO authenticated;
GRANT ALL    ON public.appointment_local_charges TO service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK (remove só o que esta migration criou):
--
-- DROP TABLE IF EXISTS public.appointment_local_charges;
--
-- Nenhuma outra tabela depende dela. Agendamentos, comanda, financeiro e
-- booking continuam exatamente como estavam.
-- =============================================================================
