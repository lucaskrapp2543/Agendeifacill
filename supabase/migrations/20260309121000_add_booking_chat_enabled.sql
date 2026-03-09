BEGIN;

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS booking_chat_enabled boolean NOT NULL DEFAULT true;

COMMIT;

