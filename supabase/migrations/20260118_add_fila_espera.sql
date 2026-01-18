-- Sistema de Fila de Espera (por estabelecimento)
-- - Fila única (não por profissional)
-- - Entrada via booking público + via dashboard
-- - Suporte a notificação quando faltar 1 atendimento (via outbox/job)

-- ✅ SQL FINAL (roda mesmo com banco "meio mexido")
-- - Cria/atualiza estrutura da Fila de Espera
-- - Corrige conflito de horários para ignorar agendamentos de fila
-- - Cancela duplicados automaticamente (mantém o mais recente)
-- - Recria índice UNIQUE sem erro de IMMUTABLE
-- - Recarrega schema cache do PostgREST no final

BEGIN;

-- =========================
-- 1) COLUNAS (establishments / appointments)
-- =========================
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS fila_espera_ativa BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS fila_espera_fechada BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS fila_espera_profissional_id UUID NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_waitlist BOOLEAN NOT NULL DEFAULT false;

-- garantir NOT NULL (caso a coluna tenha sido criada antes sem NOT NULL)
UPDATE public.appointments SET is_waitlist = false WHERE is_waitlist IS NULL;
ALTER TABLE public.appointments ALTER COLUMN is_waitlist SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN is_waitlist SET DEFAULT false;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS waitlist_entry_id UUID NULL;

-- =========================
-- 2) TABELAS (waitlist_entries / outbox) + ALTERs se já existirem
-- =========================
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  service_id UUID NULL,
  service_name TEXT NOT NULL,
  service_price NUMERIC(10,2) NULL,
  service_duration_minutes INT NULL,
  professional_id UUID NULL,
  started_at TIMESTAMPTZ NULL,
  source TEXT NOT NULL DEFAULT 'booking' CHECK (source IN ('booking', 'dashboard')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'done', 'cancelled')),
  notified_one_ahead BOOLEAN NOT NULL DEFAULT false,
  notified_one_ahead_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Se a tabela já existia (versão antiga), adicionar colunas que faltam
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS service_price NUMERIC(10,2) NULL;
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS service_duration_minutes INT NULL;
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS professional_id UUID NULL;
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;

-- FK opcional appointments.waitlist_entry_id -> waitlist_entries.id (cria só se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_waitlist_entry_id_fkey'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_waitlist_entry_id_fkey
      FOREIGN KEY (waitlist_entry_id) REFERENCES public.waitlist_entries(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS waitlist_entries_establishment_id_created_at_idx
  ON public.waitlist_entries (establishment_id, created_at ASC);
CREATE INDEX IF NOT EXISTS waitlist_entries_establishment_id_status_idx
  ON public.waitlist_entries (establishment_id, status);
CREATE INDEX IF NOT EXISTS waitlist_entries_appointment_id_idx
  ON public.waitlist_entries (appointment_id);

-- Outbox para WhatsApp automático (job/cron)
CREATE TABLE IF NOT EXISTS public.waitlist_whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  waitlist_entry_id UUID NULL REFERENCES public.waitlist_entries(id) ON DELETE SET NULL,
  phone_to TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_response TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS waitlist_whatsapp_outbox_pending_idx
  ON public.waitlist_whatsapp_outbox (status, created_at ASC);
CREATE INDEX IF NOT EXISTS waitlist_whatsapp_outbox_establishment_idx
  ON public.waitlist_whatsapp_outbox (establishment_id, created_at DESC);

-- Histórico financeiro exclusivo da fila (por profissional)
CREATE TABLE IF NOT EXISTS public.waitlist_financial_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL,
  waitlist_entry_id UUID NULL REFERENCES public.waitlist_entries(id) ON DELETE SET NULL,
  appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  service_name TEXT NOT NULL,
  gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  professional_percentage NUMERIC(6,2) NOT NULL DEFAULT 100,
  professional_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (waitlist_entry_id)
);

CREATE INDEX IF NOT EXISTS waitlist_financial_logs_est_prof_time_idx
  ON public.waitlist_financial_logs (establishment_id, professional_id, occurred_at DESC);

-- =========================
-- 3) updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_waitlist_entries_updated_at') THEN
    CREATE TRIGGER trg_waitlist_entries_updated_at
    BEFORE UPDATE ON public.waitlist_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- =========================
-- 4) Helper + RLS/Policies
-- =========================
CREATE OR REPLACE FUNCTION public.is_owner_of_establishment(p_establishment_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.owner_id = auth.uid()
  )
$$;

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_whatsapp_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_financial_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view waitlist" ON public.waitlist_entries;
CREATE POLICY "Public can view waitlist"
  ON public.waitlist_entries
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can join waitlist" ON public.waitlist_entries;
CREATE POLICY "Public can join waitlist"
  ON public.waitlist_entries
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owner can manage waitlist" ON public.waitlist_entries;
CREATE POLICY "Owner can manage waitlist"
  ON public.waitlist_entries
  FOR UPDATE
  USING (public.is_owner_of_establishment(establishment_id))
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

-- Cliente autenticado (guest) pode cancelar a PRÓPRIA entrada da fila (via appointment_id)
DROP POLICY IF EXISTS "Client can cancel own waitlist entry" ON public.waitlist_entries;
CREATE POLICY "Client can cancel own waitlist entry"
  ON public.waitlist_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = waitlist_entries.appointment_id
        AND a.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = waitlist_entries.appointment_id
        AND a.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can delete waitlist entries" ON public.waitlist_entries;
CREATE POLICY "Owner can delete waitlist entries"
  ON public.waitlist_entries
  FOR DELETE
  USING (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can view waitlist outbox" ON public.waitlist_whatsapp_outbox;
CREATE POLICY "Owner can view waitlist outbox"
  ON public.waitlist_whatsapp_outbox
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can insert waitlist outbox" ON public.waitlist_whatsapp_outbox;
CREATE POLICY "Owner can insert waitlist outbox"
  ON public.waitlist_whatsapp_outbox
  FOR INSERT
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can view waitlist financial logs" ON public.waitlist_financial_logs;
CREATE POLICY "Owner can view waitlist financial logs"
  ON public.waitlist_financial_logs
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can insert waitlist financial logs" ON public.waitlist_financial_logs;
CREATE POLICY "Owner can insert waitlist financial logs"
  ON public.waitlist_financial_logs
  FOR INSERT
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

-- =========================
-- 5) CONFLITO DE HORÁRIO (ignorar fila + permitir cancelar)
-- =========================
CREATE OR REPLACE FUNCTION public.appointments_overlap(
  time1 time,
  duration1 int,
  time2 time,
  duration2 int
) RETURNS boolean AS $$
BEGIN
  RETURN NOT (
    time1 >= (time2 + (duration2 || ' minutes')::interval) OR
    (time1 + (duration1 || ' minutes')::interval) <= time2
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS trigger AS $$
DECLARE
  conflicting_appointment appointments;
BEGIN
  -- ✅ Se estiver cancelando, nunca bloquear
  IF NEW.status IS NOT NULL AND NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- ✅ Se for fila, nunca bloquear
  IF COALESCE(NEW.is_waitlist, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT * INTO conflicting_appointment
  FROM public.appointments
  WHERE establishment_id = NEW.establishment_id
    AND professional = NEW.professional
    AND appointment_date = NEW.appointment_date
    AND status::text != 'cancelled'
    AND COALESCE(is_waitlist, false) = false
    AND id != NEW.id
    AND public.appointments_overlap(
      NEW.appointment_time::time,
      NEW.duration,
      appointment_time::time,
      duration
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Horário % já está reservado para outro cliente. Por favor, escolha outro horário.', NEW.appointment_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger (garante que aponta pra função atual)
DROP TRIGGER IF EXISTS check_appointment_conflict_trigger ON public.appointments;
CREATE TRIGGER check_appointment_conflict_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_conflict();

-- =========================
-- 6) DEDUPE + ÍNDICE UNIQUE (sem erro de IMMUTABLE)
-- =========================
-- Cancelar duplicados (mantém o mais recente) para permitir o índice UNIQUE
DO $$
DECLARE
  has_enum BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') INTO has_enum;

  IF has_enum THEN
    EXECUTE $SQL$
      WITH dups AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY establishment_id, professional, appointment_date, appointment_time
            ORDER BY created_at DESC
          ) AS rn
        FROM public.appointments
        WHERE status::text != 'cancelled'
          AND COALESCE(is_waitlist, false) = false
      )
      UPDATE public.appointments a
      SET status = 'cancelled'::appointment_status
      FROM dups d
      WHERE a.id = d.id
        AND d.rn > 1;
    $SQL$;
  ELSE
    EXECUTE $SQL$
      WITH dups AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY establishment_id, professional, appointment_date, appointment_time
            ORDER BY created_at DESC
          ) AS rn
        FROM public.appointments
        WHERE status != 'cancelled'
          AND COALESCE(is_waitlist, false) = false
      )
      UPDATE public.appointments a
      SET status = 'cancelled'
      FROM dups d
      WHERE a.id = d.id
        AND d.rn > 1;
    $SQL$;
  END IF;
END$$;

-- Recriar índice UNIQUE ignorando fila (predicate sem functions)
DO $$
DECLARE
  has_enum BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') INTO has_enum;

  EXECUTE 'DROP INDEX IF EXISTS public.idx_unique_active_appointments';

  IF has_enum THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointments
      ON public.appointments (establishment_id, professional, appointment_date, appointment_time)
      WHERE status != ''cancelled''::appointment_status AND is_waitlist = false';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointments
      ON public.appointments (establishment_id, professional, appointment_date, appointment_time)
      WHERE status != ''cancelled'' AND is_waitlist = false';
  END IF;
END$$;

COMMIT;

-- Recarregar schema cache do PostgREST (resolve "schema cache" no frontend)
NOTIFY pgrst, 'reload schema';

