-- ZERAR APENAS O ESTABELECIMENTO code = '5560'
-- Objetivo:
-- 1) Apagar agendamentos do MÊS ATUAL e do MÊS PASSADO (e tudo que referencie esses appointments)
-- 2) "Zerar" configurações da Pagar.me do estabelecimento (recipient + dados KYC + toggles)
--
-- ✅ Seguro: tem validações para garantir que só existe 1 estabelecimento com esse código.
-- ⚠️ IRREVERSÍVEL após COMMIT. Se quiser testar antes, troque COMMIT por ROLLBACK.
--
-- Execute no Supabase SQL Editor com role admin (postgres).

BEGIN;

DO $$
DECLARE
  v_codigo_estabelecimento TEXT := '5560';
  v_establishment_id UUID;
  v_start DATE;
  v_end DATE;
  v_month_current TEXT;
  v_month_prev TEXT;
  v_deleted BIGINT;
  v_sql TEXT;
BEGIN
  -- 0) Encontrar o estabelecimento pelo código (mais seguro do que email)
  IF (SELECT COUNT(*) FROM public.establishments WHERE code = v_codigo_estabelecimento) = 0 THEN
    RAISE EXCEPTION 'Nenhum estabelecimento encontrado com code=%', v_codigo_estabelecimento;
  END IF;

  IF (SELECT COUNT(*) FROM public.establishments WHERE code = v_codigo_estabelecimento) > 1 THEN
    RAISE EXCEPTION 'Mais de 1 estabelecimento encontrado com code=%. Abortando por segurança.', v_codigo_estabelecimento;
  END IF;

  SELECT id
  INTO v_establishment_id
  FROM public.establishments
  WHERE code = v_codigo_estabelecimento;

  -- 1) Definir janela: mês atual + mês passado (baseado em appointment_date)
  v_start := (date_trunc('month', current_date) - interval '1 month')::date;
  v_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
  v_month_current := to_char(date_trunc('month', current_date)::date, 'YYYY-MM');
  v_month_prev := to_char((date_trunc('month', current_date) - interval '1 month')::date, 'YYYY-MM');

  -- 2) Capturar appointments-alvo numa temp table (para deletar em cascata com segurança)
  CREATE TEMP TABLE tmp_appointments_5560_to_delete AS
  SELECT a.id
  FROM public.appointments a
  WHERE a.establishment_id = v_establishment_id
    AND a.appointment_date >= v_start
    AND a.appointment_date <= v_end;

  RAISE NOTICE 'Estabelecimento code=% (id=%). Período [%..%]. Appointments selecionados=%',
    v_codigo_estabelecimento,
    v_establishment_id,
    v_start,
    v_end,
    (SELECT COUNT(*) FROM tmp_appointments_5560_to_delete);

  -- 3) Apagar tabelas que referenciam appointment_id (quando existirem)

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'appointment_products'
  ) THEN
    DELETE FROM public.appointment_products
    WHERE appointment_id IN (SELECT id FROM tmp_appointments_5560_to_delete);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'appointment_products deletados=%', v_deleted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'establishment_notifications'
  ) THEN
    DELETE FROM public.establishment_notifications
    WHERE appointment_id IN (SELECT id FROM tmp_appointments_5560_to_delete);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'establishment_notifications (por appointment_id) deletados=%', v_deleted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_reminder_logs'
  ) THEN
    DELETE FROM public.whatsapp_reminder_logs
    WHERE appointment_id IN (SELECT id FROM tmp_appointments_5560_to_delete);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'whatsapp_reminder_logs (por appointment_id) deletados=%', v_deleted;
  END IF;

  -- 4) Apagar os appointments do período
  DELETE FROM public.appointments
  WHERE id IN (SELECT id FROM tmp_appointments_5560_to_delete);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'appointments deletados=%', v_deleted;

  -- 4.1) Zerar "financeiro" do estabelecimento no mesmo período (mês atual + passado)
  -- ✅ NÃO mexe em professionals/produtos cadastrados, só em registros financeiros/históricos.

  -- Despesas
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'establishment_expenses'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='establishment_expenses' AND column_name='expense_date'
    ) THEN
      DELETE FROM public.establishment_expenses
      WHERE establishment_id = v_establishment_id
        AND expense_date >= v_start
        AND expense_date <= v_end;
    ELSE
      DELETE FROM public.establishment_expenses
      WHERE establishment_id = v_establishment_id
        AND created_at >= v_start::timestamptz
        AND created_at < (v_end + 1)::timestamptz;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'establishment_expenses deletados=%', v_deleted;
  END IF;

  -- Pagamentos de profissionais (histórico de retiradas/lançamentos)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'professional_payments'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='professional_payments' AND column_name='payment_date'
    ) THEN
      DELETE FROM public.professional_payments
      WHERE establishment_id = v_establishment_id
        AND (payment_date AT TIME ZONE 'UTC')::date >= v_start
        AND (payment_date AT TIME ZONE 'UTC')::date <= v_end;
    ELSE
      DELETE FROM public.professional_payments
      WHERE establishment_id = v_establishment_id
        AND created_at >= v_start::timestamptz
        AND created_at < (v_end + 1)::timestamptz;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'professional_payments deletados=%', v_deleted;
  END IF;

  -- Vendas avulsas de produtos (histórico de vendas)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_sales'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='product_sales' AND column_name='sold_at'
    ) THEN
      DELETE FROM public.product_sales
      WHERE establishment_id = v_establishment_id
        AND (sold_at AT TIME ZONE 'UTC')::date >= v_start
        AND (sold_at AT TIME ZONE 'UTC')::date <= v_end;
    ELSE
      DELETE FROM public.product_sales
      WHERE establishment_id = v_establishment_id
        AND created_at >= v_start::timestamptz
        AND created_at < (v_end + 1)::timestamptz;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'product_sales deletados=%', v_deleted;
  END IF;

  -- Valores brutos editados por mês (histórico do dashboard)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'establishment_initial_values'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='establishment_initial_values' AND column_name='month_year'
    ) THEN
      DELETE FROM public.establishment_initial_values
      WHERE establishment_id = v_establishment_id
        AND month_year IN (v_month_current, v_month_prev);
    ELSE
      -- fallback: se não existir month_year, tentar por created_at (se existir)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='establishment_initial_values' AND column_name='created_at'
      ) THEN
        DELETE FROM public.establishment_initial_values
        WHERE establishment_id = v_establishment_id
          AND created_at >= v_start::timestamptz
          AND created_at < (v_end + 1)::timestamptz;
      END IF;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'establishment_initial_values deletados=%', v_deleted;
  END IF;

  -- 5) Zerando configurações Pagar.me (somente campos existentes)
  v_sql := 'UPDATE public.establishments SET ';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='establishments' AND column_name='pagarme_recipient_id'
  ) THEN
    v_sql := v_sql || 'pagarme_recipient_id = NULL, ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='establishments' AND column_name='pagarme_register_information'
  ) THEN
    v_sql := v_sql || 'pagarme_register_information = NULL, ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='establishments' AND column_name='exigir_pagamento_antecipado'
  ) THEN
    v_sql := v_sql || 'exigir_pagamento_antecipado = FALSE, ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='establishments' AND column_name='use_pagarme_subscription_pix'
  ) THEN
    v_sql := v_sql || 'use_pagarme_subscription_pix = FALSE, ';
  END IF;

  -- Se nenhum campo existir, não executar UPDATE (evita SQL inválido)
  IF v_sql = 'UPDATE public.establishments SET ' THEN
    RAISE NOTICE 'Nenhuma coluna de Pagar.me encontrada em public.establishments. Pulando reset Pagar.me.';
  ELSE
    -- remover última vírgula/espaço
    v_sql := regexp_replace(v_sql, ',\s*$', '');
    v_sql := v_sql || ' WHERE code = $1';

    EXECUTE v_sql USING v_codigo_estabelecimento;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'establishments atualizados (Pagar.me reset)=%', v_deleted;
  END IF;

  -- 6) Checagens finais (só log)
  RAISE NOTICE 'Appointments restantes no período para code=%: %',
    v_codigo_estabelecimento,
    (
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.establishment_id = v_establishment_id
        AND a.appointment_date >= v_start
        AND a.appointment_date <= v_end
    );
END $$;

-- Se quiser validar manualmente antes do COMMIT:
-- SELECT * FROM public.establishments WHERE code = '5560';
-- SELECT COUNT(*) FROM public.appointments a JOIN public.establishments e ON e.id = a.establishment_id
--   WHERE e.code = '5560' AND a.appointment_date >= (date_trunc('month', current_date) - interval '1 month')::date;

COMMIT;


