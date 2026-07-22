-- ============================================================================
-- PASSO 3 — A TRAVA: fecha o vazamento de LEITURA da tabela appointments.
-- ----------------------------------------------------------------------------
-- A consulta em pg_policies mostrou que existem DUAS regras de SELECT com
-- USING (true) (= "qualquer um vê tudo"), que são a causa do vazamento:
--    1) "View all appointments"                       {public}            true
--    2) "Booking can read appointments for availability" {anon,authenticated} true
--
-- E já existem regras RESTRITAS corretas, que DEVEM CONTINUAR (dão o acesso
-- legítimo de cliente e dono) e NÃO são tocadas aqui:
--    - "Clients can view their own appointments"        auth.uid()=client_id
--    - "Users can view their own appointments"          client_id OR establishment_id
--    - "Enable read access for users"                   client_id OR establishment_id OR dono(owner_id)
--    - "Establishment owners can view their appointments" dono(owner_id)
--
-- Portanto a trava só precisa:
--    (a) REMOVER as duas regras "true" (a porta escancarada);
--    (b) ADICIONAR acesso do admin da plataforma (email de suporte), que hoje
--        depende da regra "true" pra ver todos os estabelecimentos.
--
-- Os fluxos públicos (disponibilidade, ver-por-telefone, validações) NÃO usam
-- mais leitura direta — usam as funções SECURITY DEFINER do Passo 1 (já no ar,
-- deploy confirmado). Por isso remover as regras "true" não quebra o booking.
--
-- Rollback (volta ao estado anterior na hora) está no fim do arquivo.
-- ============================================================================

BEGIN;

-- (a) Remover as duas regras escancaradas
DROP POLICY IF EXISTS "View all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Booking can read appointments for availability" ON public.appointments;

-- (b) Admin da plataforma continua enxergando tudo (email é verificado, não dá pra forjar)
DROP POLICY IF EXISTS "Platform admin can view all appointments" ON public.appointments;
CREATE POLICY "Platform admin can view all appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');

COMMIT;

-- ============================================================================
-- ROLLBACK (se QUALQUER coisa quebrar, cole e rode ISTO pra voltar ao de antes):
--
-- BEGIN;
-- DROP POLICY IF EXISTS "Platform admin can view all appointments" ON public.appointments;
-- CREATE POLICY "View all appointments"
--   ON public.appointments FOR SELECT USING (true);
-- CREATE POLICY "Booking can read appointments for availability"
--   ON public.appointments FOR SELECT TO anon, authenticated USING (true);
-- COMMIT;
-- ============================================================================
