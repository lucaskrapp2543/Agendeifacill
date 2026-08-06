-- ============================================================================
-- FECHA A ESCRITA DE establishments PARA QUEM NÃO É DONO NEM ADMIN
-- ----------------------------------------------------------------------------
-- PROBLEMA (achado em 2026-08-06, auditando a RLS depois do caso do vencimento):
--
-- 1) GRANT: o role `anon` (visitante SEM LOGIN, cuja chave é pública por design)
--    tem INSERT, UPDATE e DELETE em public.establishments.
-- 2) RLS: existe a policy "Enable update for all users" para {public}
--    com USING (true) / WITH CHECK (true).
--
-- As duas camadas abertas ao mesmo tempo significam que QUALQUER PESSOA NA
-- INTERNET, sem login, podia alterar QUALQUER estabelecimento — nome, preços,
-- profissionais, horários. E qualquer cliente logado podia alterar a conta de
-- outra barbearia (por isso a trava de cobrança foi ajustada para congelar
-- todo usuário logado que não seja admin, e não só o dono da linha).
--
-- CONFERIDO ANTES DE REVOGAR — quem escreve em establishments hoje:
--   * EstablishmentDashboard  -> dono logado        (authenticated) OK
--   * AdminDashboard / NewRegistrations -> admin    (authenticated) OK
--   * siteRegistrationCheckoutConversion (cadastro do site) -> roda SÓ nas
--     netlify functions / server com service_role (não é o navegador) OK
--   * supabase.ts createEstablishment -> código morto, só usado em backups
--   * BookingPage / bookingSimpleEngine -> SOMENTE LEITURA
-- Ou seja: nenhum fluxo anônimo escreve em establishments. O booking continua
-- lendo normalmente (o SELECT do anon não é tocado aqui).
--
-- A policy removida é REDUNDANTE: dono e admin já são cobertos por
--   "Owners can manage their establishments"     -> auth.uid() = owner_id
--   "Enable update for admin and owners"         -> owner_id OU e-mail do admin
--   "Usuários podem atualizar seu próprio pin_password"
--
-- Reversível: rollback no fim do arquivo.
-- ============================================================================

BEGIN;

-- 1) Tira a escrita do visitante anônimo (leitura permanece intacta).
REVOKE INSERT, UPDATE, DELETE ON public.establishments FROM anon;

-- 2) Remove a regra que liberava UPDATE para todo mundo.
DROP POLICY IF EXISTS "Enable update for all users" ON public.establishments;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (se algo quebrar, cole e rode ISTO):
--
-- GRANT INSERT, UPDATE, DELETE ON public.establishments TO anon;
-- CREATE POLICY "Enable update for all users" ON public.establishments
--   FOR UPDATE TO public USING (true) WITH CHECK (true);
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================
