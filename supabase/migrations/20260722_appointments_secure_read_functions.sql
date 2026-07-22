-- ============================================================================
-- PASSO 1 — Funções de leitura SEGURA de appointments (SEM dados pessoais)
-- ----------------------------------------------------------------------------
-- Objetivo: dar caminhos controlados pra ler o que os fluxos públicos precisam,
-- SEM entregar a tabela inteira. Depois que o frontend passar a usar estas
-- funções (Passo 2, testado), a tabela appointments será trancada (Passo 3).
--
-- IMPORTANTE: aplicar este arquivo NÃO muda nada em produção. São funções
-- novas, ainda não usadas por ninguém. O site continua idêntico.
-- Reversível com DROP FUNCTION. Não altera tabela, coluna, policy nem dado.
--
-- SECURITY DEFINER: a função roda com privilégio do dono do banco, por isso
-- continuará conseguindo ler a tabela mesmo depois de trancada. Mas ela SÓ
-- devolve o conjunto de colunas abaixo — nunca a porta escancarada.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- A) DISPONIBILIDADE PÚBLICA — "quais horários estão ocupados nesse dia"
--    Usada pelo booking pra montar os horários livres.
--    NÃO devolve nome, telefone, CPF nem qualquer dado do cliente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_day_availability(
  p_establishment_id uuid,
  p_date date
)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t) FROM (
    SELECT a.id,
           a.appointment_date,
           a.appointment_time,
           a.duration,
           a.professional,
           a.status,
           a.additional_products,
           a.is_avulso,
           a.payment_status,
           a.pix_payment_status
    FROM public.appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.appointment_date = p_date
      AND a.status <> 'cancelled'
  ) t;
$$;

-- ----------------------------------------------------------------------------
-- B) VER POR TELEFONE — os agendamentos daquele número (todos estabelecimentos)
--    Devolve tudo do agendamento MENOS o CPF (o cliente vê nome/telefone dele,
--    que já são dele mesmo). Exige telefone com >= 9 dígitos e faz match pelos
--    últimos 9 dígitos (bem mais restrito que o ILIKE parcial de hoje).
--    OBS: o join com "establishments" continua sendo feito no frontend.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_appointments_by_phone(
  p_phone text
)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS p
  )
  SELECT to_jsonb(a) - 'client_cpf' - 'cpf'
  FROM public.appointments a, d
  WHERE length(d.p) >= 9
    AND a.status <> 'cancelled'
    AND right(regexp_replace(coalesce(a.client_whatsapp, ''), '\D', '', 'g'), 9) = right(d.p, 9);
$$;

-- ----------------------------------------------------------------------------
-- C) AGENDAMENTOS DO CLIENTE NUM ESTABELECIMENTO (pras validações de limite:
--    assinante/mensal/semanal que rodam durante o agendamento).
--    Mesmo match por telefone; devolve tudo MENOS o CPF. O filtro de status
--    e o resto continua sendo feito no frontend, igual hoje.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_appointments_for_establishment(
  p_phone text,
  p_establishment_id uuid,
  p_date_min date DEFAULT NULL,
  p_date_max date DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS p
  )
  SELECT to_jsonb(a) - 'client_cpf' - 'cpf'
  FROM public.appointments a, d
  WHERE a.establishment_id = p_establishment_id
    AND (p_date_min IS NULL OR a.appointment_date >= p_date_min)
    AND (p_date_max IS NULL OR a.appointment_date <= p_date_max)
    AND length(d.p) >= 9
    AND right(regexp_replace(coalesce(a.client_whatsapp, ''), '\D', '', 'g'), 9) = right(d.p, 9);
$$;

-- Permissões: os fluxos públicos usam a chave anon (visitante) ou a sessão de
-- convidado (authenticated). Ambos precisam poder EXECUTAR estas funções.
GRANT EXECUTE ON FUNCTION public.get_day_availability(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointments_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_appointments_for_establishment(text, uuid, date, date) TO anon, authenticated;

COMMIT;
