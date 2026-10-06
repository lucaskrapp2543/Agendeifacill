-- ============================================================================
-- TOP 5 / TOP 1 do mês: contagem de agendamentos CONCLUÍDOS por barbearia.
-- ----------------------------------------------------------------------------
-- POR QUE: o painel do barbeiro calculava o ranking lendo `appointments` de
-- TODAS as barbearias direto do navegador. Depois da trava de LGPD
-- (20260722_appointments_lock_select), cada barbearia só enxerga os próprios
-- agendamentos — então TODA barbearia passou a se ver como "#1" e a achar que
-- ganhou o mês grátis. Esta função devolve SÓ CONTAGENS (nenhum dado pessoal),
-- calculadas no servidor com SECURITY DEFINER, para o ranking voltar a ser global.
--
-- Regras iguais às do painel (que continuam no front):
--   · status = 'completed', por appointment_date dentro do período pedido;
--   · fora: barbearias excluídas (is_deleted) e as que pediram para sair do
--     ranking (hide_from_top10_ranking);
--   · last_completed_at = momento do último concluído (desempate do Top 1:
--     quem chegou primeiro à contagem final).
-- Risco: nenhum para dados pessoais (só id da barbearia + contagem). Sem
-- alteração em tabelas, policies ou colunas.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_completed_ranking(p_start date, p_end date)
RETURNS TABLE (establishment_id uuid, completed_count bigint, last_completed_at timestamp)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.establishment_id,
         count(*)::bigint AS completed_count,
         max(
           (a.appointment_date::date)::timestamp
           + coalesce(nullif(left(a.appointment_time::text, 5), ''), '00:00')::time
         ) AS last_completed_at
  FROM public.appointments a
  JOIN public.establishments e ON e.id = a.establishment_id
  WHERE a.status = 'completed'
    AND a.appointment_date::date >= p_start
    AND a.appointment_date::date <= p_end
    AND coalesce(e.is_deleted, false) = false
    AND coalesce(e.hide_from_top10_ranking, false) = false
  GROUP BY a.establishment_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_completed_ranking(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_completed_ranking(date, date) TO anon, authenticated, service_role;

-- Teste rápido (rodar depois): deve listar as barbearias com mais concluídos no mês
-- SELECT * FROM public.get_completed_ranking(date_trunc('month', now())::date, now()::date)
-- ORDER BY completed_count DESC LIMIT 5;
