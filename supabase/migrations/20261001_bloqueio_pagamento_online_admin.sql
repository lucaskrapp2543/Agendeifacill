-- =====================================================================
-- ADMIN: "Retirar obrigatoriedade de pagamento online" por barbearia
-- =====================================================================
--
-- O QUE FAZ
--   Coluna nova em establishments: online_payment_blocked_by_admin (nasce false
--   para TODO MUNDO = nada muda). Quando o admin liga, o cliente daquela barbearia
--   só paga no local: nenhuma página de agendamento oferece PIX/cartão, e o
--   servidor recusa criar pagamento online para ela.
--
-- QUEM PODE MUDAR
--   Só o admin (painel) ou o servidor. Se o próprio dono tentar (pela API), a
--   mudança é ignorada em silêncio pelo trigger abaixo — mesma lógica da trava
--   de cobrança (20260806): auth.uid() NULL = servidor, passa; logado que não é
--   admin, não muda nada.
--
-- RISCO: nenhum para quem está rodando hoje (default false). Reversível:
--   DROP TRIGGER IF EXISTS trg_protect_online_payment_block ON public.establishments;
--   DROP FUNCTION IF EXISTS public.protect_online_payment_block();
--   ALTER TABLE public.establishments DROP COLUMN IF EXISTS online_payment_blocked_by_admin;
-- =====================================================================

BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS online_payment_blocked_by_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.establishments.online_payment_blocked_by_admin IS
  'Ligado pelo admin: cliente desta barbearia só paga no local (sem PIX/cartão em nenhuma página de agendamento).';

CREATE OR REPLACE FUNCTION public.protect_online_payment_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF NEW.online_payment_blocked_by_admin IS DISTINCT FROM OLD.online_payment_blocked_by_admin THEN
    BEGIN
      v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;
    -- Sem usuário logado = servidor / SQL Editor: passa. Logado e não admin: ignora a mudança.
    IF v_uid IS NOT NULL AND NOT public.is_admin_user() THEN
      NEW.online_payment_blocked_by_admin := OLD.online_payment_blocked_by_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_online_payment_block ON public.establishments;
CREATE TRIGGER trg_protect_online_payment_block
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_online_payment_block();

-- Conferência: default "false" e 0 barbearias bloqueadas
SELECT
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'online_payment_blocked_by_admin') AS default_coluna,
  (SELECT count(*) FROM public.establishments WHERE online_payment_blocked_by_admin = true) AS barbearias_bloqueadas;

COMMIT;

NOTIFY pgrst, 'reload schema';
