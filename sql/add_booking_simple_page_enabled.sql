-- Ativa modo simples na pagina publica de agendamentos.
-- Seguro para rodar mais de uma vez.
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS booking_simple_page_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.establishments.booking_simple_page_enabled
IS 'Quando true, a pagina de agendamentos publica mostra somente foto/perfil, botao de agendar e assinaturas.';
