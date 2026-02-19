-- Etiqueta por cor para assinaturas (apenas visual no agendamento)
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS label_color text;

