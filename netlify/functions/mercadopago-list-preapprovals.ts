// =============================================================================
// CONFERÊNCIA DE RECORRÊNCIAS — SOMENTE LEITURA
// -----------------------------------------------------------------------------
// Pergunta ao Mercado Pago quais recorrências (preapprovals) existem na conta da
// barbearia e devolve a lista crua.
//
// POR QUE ISSO EXISTE
// A coluna que guardava o vínculo da recorrência era sobrescrita por pagamento
// avulso (corrigido na migration 20260827). Quem já perdeu o vínculo não pode
// ser recuperado pelo banco — o número da recorrência não está mais lá. Só o
// Mercado Pago sabe quem realmente tem renovação automática ativa.
//
// ESTA FUNÇÃO NÃO ESCREVE NADA. Nem no banco, nem no Mercado Pago. É só uma
// consulta, para conferir se a informação vem correta ANTES de qualquer
// reconexão automática.
// =============================================================================

import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

async function getValidMercadoPagoAccessToken(establishmentId: string): Promise<string> {
  if (!supabaseAdmin) throw new Error('Supabase admin não configurado');

  const { data: establishment, error } = await supabaseAdmin
    .from('establishments')
    .select('id, mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
    .eq('id', establishmentId)
    .single();

  if (error || !establishment) throw new Error('Estabelecimento não encontrado');

  const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
  const refreshToken = String((establishment as any)?.mercadopago_refresh_token || '').trim();
  const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;
  if (!accessToken) throw new Error('Estabelecimento sem Mercado Pago conectado');
  if (!expiresAtRaw) return accessToken;

  const expiresAt = new Date(expiresAtRaw).getTime();
  const now = Date.now();
  const safetyMs = 2 * 60 * 1000;
  if (Number.isFinite(expiresAt) && expiresAt > now + safetyMs) return accessToken;
  if (!refreshToken) throw new Error('Token Mercado Pago expirado. Reconecte a conta.');

  const refreshed = await refreshAccessToken(refreshToken);
  const newAccessToken = String(refreshed.access_token || '').trim();
  const newRefreshToken = String(refreshed.refresh_token || refreshToken).trim();
  const expiresIn = Number(refreshed.expires_in || 21600);
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  if (!newAccessToken) throw new Error('Falha ao atualizar token do Mercado Pago');

  await supabaseAdmin
    .from('establishments')
    .update({
      mercadopago_access_token: newAccessToken,
      mercadopago_refresh_token: newRefreshToken,
      mercadopago_token_expires_at: newExpiresAt,
    } as any)
    .eq('id', establishmentId);

  return newAccessToken;
}

const normalizePreapproval = (raw: any) => ({
  id: String(raw?.id || ''),
  status: String(raw?.status || '').toLowerCase(),
  payer_email: String(raw?.payer_email || raw?.payer?.email || '').toLowerCase().trim(),
  payer_id: String(raw?.payer_id || raw?.payer?.id || ''),
  payer_first_name: String(raw?.payer_first_name || '').trim(),
  payer_last_name: String(raw?.payer_last_name || '').trim(),
  next_payment_date: String(raw?.next_payment_date || ''),
  external_reference: String(raw?.external_reference || ''),
  reason: String(raw?.reason || ''),
  date_created: String(raw?.date_created || ''),
  last_charged_date: String(raw?.summarized?.last_charged_date || ''),
  charged_quantity: Number(raw?.summarized?.charged_quantity ?? 0) || 0,
  transaction_amount: Number(raw?.auto_recurring?.transaction_amount ?? 0) || 0,
});

const ACTIVE_STATUSES = new Set(['authorized', 'approved', 'active', 'paid']);

/**
 * A listagem em lote (/preapproval/search) NÃO traz o e-mail do pagador — sem ele
 * não dá para saber a QUEM cada recorrência pertence. O e-mail só vem no detalhe
 * individual (/preapproval/{id}).
 *
 * Buscar o detalhe de todas as 148 seria desperdício: só interessa quem está ativo.
 * Então enriquece apenas as ativas, em lotes pequenos para não tomar bloqueio por
 * excesso de requisições. Continua SÓ LEITURA.
 */
async function enriquecerAtivasComEmail(
  ativas: ReturnType<typeof normalizePreapproval>[],
  accessToken: string
): Promise<{
  enriquecidas: ReturnType<typeof normalizePreapproval>[];
  falhas: number;
  amostra: any;
}> {
  const LOTE = 5;
  const TETO = 300; // trava de segurança
  const alvo = ativas.slice(0, TETO);
  let falhas = 0;
  // Guarda a lista de campos do PRIMEIRO detalhe consultado. Serve só para
  // descobrir onde o Mercado Pago esconde o e-mail (ou se ele não manda mesmo).
  let amostra: any = null;

  for (let i = 0; i < alvo.length; i += LOTE) {
    const lote = alvo.slice(i, i + LOTE);
    await Promise.all(
      lote.map(async (p) => {
        if (p.payer_email) return; // já veio na listagem, não precisa
        try {
          const resp = await axios.get(`${MP_API_BASE_URL}/preapproval/${encodeURIComponent(p.id)}`, {
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            validateStatus: () => true,
          });
          if (resp.status !== 200) {
            falhas += 1;
            if (!amostra) amostra = { httpStatus: resp.status, erro: resp.data ?? null };
            return;
          }
          const d = resp.data || {};
          if (!amostra) {
            amostra = {
              httpStatus: resp.status,
              campos: Object.keys(d || {}).sort(),
              payer_email: d?.payer_email ?? null,
              payer_id: d?.payer_id ?? null,
              payer: d?.payer ?? null,
            };
          }
          p.payer_email = String(d?.payer_email || d?.payer?.email || '').toLowerCase().trim();
          if (!p.payer_id) p.payer_id = String(d?.payer_id || d?.payer?.id || '');
          if (!p.next_payment_date) p.next_payment_date = String(d?.next_payment_date || '');
          if (!p.external_reference) p.external_reference = String(d?.external_reference || '');
          if (!p.last_charged_date) p.last_charged_date = String(d?.summarized?.last_charged_date || '');
          if (!p.charged_quantity) p.charged_quantity = Number(d?.summarized?.charged_quantity ?? 0) || 0;
          if (!p.transaction_amount) p.transaction_amount = Number(d?.auto_recurring?.transaction_amount ?? 0) || 0;
        } catch {
          falhas += 1;
        }
      })
    );
  }

  return { enriquecidas: alvo, falhas, amostra };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) return json(500, { error: 'Supabase admin não configurado' });
    const body = parseJsonBody<any>(event) || {};
    const establishmentId = String(body?.establishmentId || '').trim();
    if (!establishmentId) {
      return json(400, { error: 'Dados incompletos', required: ['establishmentId'] });
    }

    const accessToken = await getValidMercadoPagoAccessToken(establishmentId);

    // Paginação: o Mercado Pago devolve no máximo 100 por página. Limito a 10
    // páginas (1000 recorrências) — folga enorme para qualquer barbearia e
    // impede laço infinito se a resposta vier num formato inesperado.
    // ⚠️ A PAGINAÇÃO DO MERCADO PAGO NÃO É ESTÁVEL.
    //
    // O /preapproval/search não aceita ordenação ('Invalid sorting value format')
    // e devolve as páginas em ordem variável. Medido em produção, na mesma conta:
    //   · uma varredura trouxe 148 registros com só 140 ids distintos (repetiu 8)
    //   · outra varredura trouxe 140 e PERDEU 8 que existiam
    //
    // As duas falhas são graves aqui:
    //   · repetir cria "cliente com cobrança duplicada" que não existe — e o
    //     barbeiro cancelaria uma assinatura legítima por erro de leitura;
    //   · perder esconde uma recorrência ativa de verdade.
    //
    // Solução: juntar por id (nunca duplica) e REPETIR a varredura enquanto o
    // total distinto for menor que o total que o próprio Mercado Pago informa.
    const PAGE_SIZE = 100;
    const MAX_PAGES = 10;
    const MAX_VARREDURAS = 4;
    const porId = new Map<string, any>();
    let total = 0;
    let pagesFetched = 0;
    let varreduras = 0;

    for (varreduras = 1; varreduras <= MAX_VARREDURAS; varreduras += 1) {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const offset = page * PAGE_SIZE;
        const resp = await axios.get(`${MP_API_BASE_URL}/preapproval/search`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: { limit: PAGE_SIZE, offset },
          validateStatus: () => true,
        });

        if (resp.status !== 200) {
          // Devolve o erro cru do Mercado Pago para dar para diagnosticar sem adivinhação.
          return json(200, {
            ok: false,
            httpStatus: resp.status,
            mercadoPagoError: resp.data ?? null,
            hint: 'O Mercado Pago recusou a consulta de recorrências. Veja httpStatus e mercadoPagoError.',
          });
        }

        const data = resp.data || {};
        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        total = Number(data?.paging?.total ?? total) || total;
        pagesFetched += 1;
        results.forEach((raw: any) => {
          const id = String(raw?.id || '').trim();
          if (id && !porId.has(id)) porId.set(id, raw);
        });

        if (results.length < PAGE_SIZE) break;
      }

      if (total > 0 && porId.size >= total) break;
    }

    const all = Array.from(porId.values());
    const coberturaCompleta = total === 0 || porId.size >= total;
    const preapprovals = all.map(normalizePreapproval).filter((p) => p.id);
    const porStatus: Record<string, number> = {};
    preapprovals.forEach((p) => {
      const key = p.status || 'sem_status';
      porStatus[key] = (porStatus[key] || 0) + 1;
    });

    // Só as ativas recebem a busca de detalhe (é onde o e-mail aparece).
    const ativas = preapprovals.filter((p) => ACTIVE_STATUSES.has(p.status));
    const { enriquecidas, falhas, amostra: amostraDetalhe } = await enriquecerAtivasComEmail(ativas, accessToken);
    const semEmailMesmoAposDetalhe = enriquecidas.filter((p) => !p.payer_email).length;

    return json(200, {
      ok: true,
      establishmentId,
      totalInformadoPeloMercadoPago: total,
      totalRecebido: preapprovals.length,
      coberturaCompleta,
      varreduras,
      pagesFetched,
      porStatus,
      ativasEnriquecidas: enriquecidas.length,
      falhasAoBuscarDetalhe: falhas,
      semEmailMesmoAposDetalhe,
      // Diagnóstico: quais campos o Mercado Pago realmente devolve. Sem isso a
      // gente fica adivinhando por que o e-mail não vem.
      camposDisponiveis: all[0] ? Object.keys(all[0]).sort() : [],
      amostraDetalhe: amostraDetalhe ?? null,
      preapprovals,
    });
  } catch (error: any) {
    const message =
      String(error?.response?.data?.message || '') ||
      String(error?.response?.data?.error || '') ||
      String(error?.message || 'Erro ao listar recorrências no Mercado Pago');
    return json(500, { error: message, httpStatus: error?.response?.status ?? null });
  }
};
