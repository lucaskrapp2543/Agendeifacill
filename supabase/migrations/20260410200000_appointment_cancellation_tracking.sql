-- Rastreamento de quem/ o quê cancelou o agendamento + metadata nas notificações do estabelecimento.
-- Compatível: colunas opcionais; trigger usa COALESCE para registros antigos.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_source text NULL,
  ADD COLUMN IF NOT EXISTS cancellation_detail text NULL;

COMMENT ON COLUMN public.appointments.cancellation_source IS
  'Origem do cancelamento: client, establishment_staff, system_abandoned_checkout, system_payment_timeout, payment_rejected, unknown';
COMMENT ON COLUMN public.appointments.cancellation_detail IS
  'Texto curto opcional para suporte (ex.: regra de timeout).';

ALTER TABLE public.establishment_notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

COMMENT ON COLUMN public.establishment_notifications.metadata IS
  'JSON extra (ex.: cancellation_source, cancellation_detail) para UI Motivo.';

CREATE OR REPLACE FUNCTION public.create_cancellation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src text := COALESCE(NULLIF(trim(NEW.cancellation_source), ''), 'unknown');
  v_msg text;
  v_meta jsonb;
BEGIN
  v_meta := jsonb_strip_nulls(
    jsonb_build_object(
      'cancellation_source', v_src,
      'cancellation_detail', NEW.cancellation_detail,
      'payment_status', NEW.payment_status,
      'payment_transaction_id', NEW.payment_transaction_id
    )
  );

  v_msg := CASE v_src
    WHEN 'client' THEN
      NEW.client_name || ' cancelou ' || NEW.service || ' de ' || NEW.appointment_date || ' às ' || NEW.appointment_time || ' (cliente / app).'
    WHEN 'establishment_staff' THEN
      'Cancelamento interno (painel): ' || NEW.client_name || ' — ' || NEW.service || ' em ' || NEW.appointment_date || ' às ' || NEW.appointment_time || '.'
    WHEN 'system_abandoned_checkout' THEN
      'Cancelamento automático: ' || NEW.client_name || ' — ' || NEW.service || ' em ' || NEW.appointment_date || ' às ' || NEW.appointment_time ||
      '. Motivo: pagamento obrigatório não foi iniciado a tempo (reserva liberada).'
    WHEN 'system_payment_timeout' THEN
      'Cancelamento automático: ' || NEW.client_name || ' — ' || NEW.service || ' em ' || NEW.appointment_date || ' às ' || NEW.appointment_time ||
      '. Motivo: pagamento não confirmado no sistema no prazo. Se o cliente mostrar comprovante, confira no Mercado Pago / extrato.'
    WHEN 'payment_rejected' THEN
      'Pagamento recusado/cancelado no fluxo: ' || NEW.client_name || ' — ' || NEW.service || ' em ' || NEW.appointment_date || ' às ' || NEW.appointment_time || '.'
    ELSE
      COALESCE(NEW.client_name, 'Cliente') || ' — agendamento cancelado (' || COALESCE(NEW.service, 'serviço') || ', ' ||
      COALESCE(NEW.appointment_date::text, '?') || ' às ' || COALESCE(NEW.appointment_time::text, '?') ||
      '). Origem não informada (registro antigo ou fluxo externo).'
  END;

  INSERT INTO public.establishment_notifications (
    establishment_id,
    type,
    title,
    message,
    appointment_id,
    metadata
  ) VALUES (
    NEW.establishment_id,
    'cancelled_appointment',
    'Agendamento Cancelado! ❌',
    v_msg,
    NEW.id,
    v_meta
  );

  RETURN NEW;
END;
$$;

-- Recria trigger (idempotente)
DROP TRIGGER IF EXISTS trigger_create_cancellation_notification ON public.appointments;
CREATE TRIGGER trigger_create_cancellation_notification
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
  EXECUTE FUNCTION public.create_cancellation_notification();
