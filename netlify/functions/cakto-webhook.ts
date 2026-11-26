/**
 * Aviso (webhook) da Cakto — venda do Plano Diamante para novos clientes.
 * Endereço para cadastrar na Cakto: https://agendeifacil.com/.netlify/functions/cakto-webhook
 *
 * Porta trancada: sem a chave (CAKTO_WEBHOOK_SECRET, que só existe no Netlify) qualquer
 * pessoa poderia inventar um pagamento e ganhar uma conta de graça.
 *
 * A Cakto NÃO reenvia sozinha quando recebe um erro (só quando a entrega nem chega).
 * Por isso todo aviso válido é gravado em `cakto_events` antes de ser processado:
 * se algo falhar, dá para reprocessar pelo "Reenviar evento" do painel da Cakto.
 */
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { avisoSemSegredo, lerAvisoCakto } from '../../src/lib/caktoPayload';
import { processarAvisoCakto } from '../../src/lib/caktoProcessing';
import { json } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const CAKTO_WEBHOOK_SECRET = String(process.env.CAKTO_WEBHOOK_SECRET || '').trim();
/** Tolerância do carimbo de hora da assinatura (5 minutos, como a Cakto recomenda). */
const TOLERANCIA_SEGUNDOS = 5 * 60;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const iguais = (a: string, b: string): boolean => {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  return bufA.length > 0 && bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

const lerHeader = (headers: Record<string, string | undefined> | undefined, nome: string): string => {
  if (!headers) return '';
  const alvo = nome.toLowerCase();
  for (const [chave, valor] of Object.entries(headers)) {
    if (chave.toLowerCase() === alvo) return String(valor || '').trim();
  }
  return '';
};

/**
 * Confere se o aviso veio mesmo da Cakto. Vale qualquer uma das duas formas oficiais:
 *  1) assinatura no cabeçalho: X-Cakto-Signature = "v1=" + HMAC-SHA256(segredo, "{timestamp}.{corpo cru}")
 *  2) campo `secret` no corpo igual ao segredo guardado
 */
export function origemCaktoValida(input: {
  secret: string;
  rawBody: string;
  signature: string;
  timestamp: string;
  bodySecret: unknown;
  agoraMs?: number;
}): 'assinatura' | 'segredo' | null {
  const secret = String(input.secret || '').trim();
  if (!secret) return null;

  if (input.signature && input.timestamp) {
    const carimbo = Number(input.timestamp);
    const agora = (input.agoraMs ?? Date.now()) / 1000;
    const noPrazo = Number.isFinite(carimbo) && Math.abs(agora - carimbo) <= TOLERANCIA_SEGUNDOS;
    if (noPrazo) {
      const esperado = `v1=${createHmac('sha256', secret).update(`${input.timestamp}.${input.rawBody}`).digest('hex')}`;
      const recebidas = input.signature.split(',').map((parte) => parte.trim());
      if (recebidas.some((parte) => iguais(parte, esperado))) return 'assinatura';
    }
  }

  if (iguais(String(input.bodySecret || '').trim(), secret)) return 'segredo';
  return null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }
  if (!supabaseAdmin || !CAKTO_WEBHOOK_SECRET) {
    // Responde erro de propósito: a entrega aparece como falha na Cakto e pode ser reenviada depois.
    console.error('[cakto/webhook] não configurado: falta SUPABASE ou CAKTO_WEBHOOK_SECRET');
    return json(500, { error: 'Webhook nao configurado' });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(String(event.body || ''), 'base64').toString('utf8')
    : String(event.body || '');

  let corpo: any = null;
  try {
    corpo = JSON.parse(rawBody);
  } catch {
    return json(400, { error: 'Corpo invalido' });
  }

  const origem = origemCaktoValida({
    secret: CAKTO_WEBHOOK_SECRET,
    rawBody,
    signature: lerHeader(event.headers as any, 'x-cakto-signature'),
    timestamp: lerHeader(event.headers as any, 'x-cakto-timestamp'),
    bodySecret: corpo?.secret,
  });
  if (!origem) {
    console.warn('[cakto/webhook] chave errada — aviso ignorado');
    return json(401, { error: 'unauthorized' });
  }

  const { event: nomeEvento, orders } = lerAvisoCakto(corpo);
  const primeiro = orders[0];

  // Guarda o aviso (sem o segredo) antes de processar.
  let eventoId: number | null = null;
  try {
    const { data: gravado, error: gravarError } = await supabaseAdmin
      .from('cakto_events')
      .insert({
        event: nomeEvento || 'desconhecido',
        cakto_order_id: primeiro?.id || null,
        order_status: primeiro?.status || null,
        validated_by: origem,
        payload: avisoSemSegredo(corpo),
      } as any)
      .select('id')
      .single();
    if (gravarError) console.error('[cakto/webhook] falha ao guardar o aviso:', gravarError.message);
    eventoId = gravado?.id ?? null;
  } catch (error) {
    console.error('[cakto/webhook] falha ao guardar o aviso:', error);
  }

  const anotar = async (resultado: string) => {
    if (eventoId === null) return;
    try {
      await supabaseAdmin
        .from('cakto_events')
        .update({ result: resultado.slice(0, 1000), processed_at: new Date().toISOString() } as any)
        .eq('id', eventoId);
    } catch {
      // só registro; não muda a resposta
    }
  };

  try {
    const saida = await processarAvisoCakto(supabaseAdmin, corpo);
    const resumo = saida.resultados.map((r) => `${r.orderId}:${r.resultado}`).join(' | ') || 'sem_pedido';
    await anotar(resumo);
    console.log('[cakto/webhook]', saida.event, resumo);
    return json(200, { ok: true, event: saida.event, resultados: saida.resultados });
  } catch (error: any) {
    const mensagem = String(error?.message || error);
    console.error('[cakto/webhook] ERRO ao processar:', mensagem);
    await anotar(`ERRO: ${mensagem}`);
    // Erro de propósito: fica como falha no histórico da Cakto para reenviar.
    return json(500, { error: 'Falha ao processar o aviso' });
  }
};
