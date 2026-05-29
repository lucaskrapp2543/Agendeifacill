BEGIN;

ALTER TABLE public.establishment_notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

CREATE OR REPLACE FUNCTION public.create_payment_confirmed_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method text;
  v_price numeric;
  v_price_text text;
  v_message text;
BEGIN
  IF NEW.establishment_id IS NULL OR NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.establishment_notifications n
    WHERE n.appointment_id = NEW.id
      AND n.title = 'Pagamento confirmado!'
    LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  v_method := CASE
    WHEN lower(coalesce(NEW.payment_method::text, '')) LIKE '%pix%'
      OR lower(coalesce(NEW.pix_payment_status::text, '')) IN ('confirmado', 'aprovado')
      THEN 'Pix'
    WHEN lower(coalesce(NEW.payment_method::text, '')) IN ('credito', 'credit_card', 'credit')
      THEN 'cartao'
    ELSE 'Mercado Pago'
  END;

  v_price := NULLIF(NEW.price, 0);
  v_price_text := CASE
    WHEN v_price IS NULL THEN ''
    ELSE ' de R$ ' || replace(to_char(v_price, 'FM999999990D00'), '.', ',')
  END;

  v_message :=
    coalesce(nullif(trim(NEW.client_name), ''), 'Cliente') ||
    ' pagou' || v_price_text || ' via ' || v_method ||
    ' para ' || coalesce(nullif(trim(NEW.service), ''), 'servico') ||
    ' em ' || coalesce(NEW.appointment_date::text, '?') ||
    ' as ' || coalesce(NEW.appointment_time::text, '?') || '.';

  INSERT INTO public.establishment_notifications (
    establishment_id,
    type,
    title,
    message,
    appointment_id,
    metadata
  ) VALUES (
    NEW.establishment_id,
    'new_appointment',
    'Pagamento confirmado!',
    v_message,
    NEW.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'notification_kind', 'payment_confirmed',
        'payment_status', NEW.payment_status,
        'pix_payment_status', NEW.pix_payment_status,
        'payment_method', NEW.payment_method,
        'payment_transaction_id', NEW.payment_transaction_id
      )
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Falha ao criar notificacao de pagamento confirmado para appointment %. Pagamento preservado. Erro: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_payment_confirmed_notification ON public.appointments;
CREATE TRIGGER trigger_create_payment_confirmed_notification
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (
    (
      OLD.payment_status IS DISTINCT FROM NEW.payment_status
      AND lower(coalesce(NEW.payment_status::text, '')) = 'paid'
    )
    OR (
      OLD.pix_payment_status IS DISTINCT FROM NEW.pix_payment_status
      AND lower(coalesce(NEW.pix_payment_status::text, '')) IN ('confirmado', 'aprovado')
    )
  )
  EXECUTE FUNCTION public.create_payment_confirmed_notification();

COMMIT;
