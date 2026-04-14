-- Cliente não vê modal pedindo avisar profissional no WhatsApp após agendar (só confirmação simples).
-- Compatível: ADD COLUMN IF NOT EXISTS, default false mantém fluxo antigo.

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS skip_client_whatsapp_booking_nudge boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.establishments.skip_client_whatsapp_booking_nudge IS
  'Quando true, após agendar o cliente vê apenas confirmação simples (sem pedir WhatsApp ao profissional).';
