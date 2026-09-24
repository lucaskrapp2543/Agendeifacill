/**
 * Histórico mensal de assinantes — regra "com histórico", ligada por estabelecimento.
 *
 * FONTE ÚNICA para a aba "Meus Assinantes" (SubscribersManager) e para o card
 * "Financeiro de Meus Assinantes" do dashboard (EstablishmentDashboard), para os
 * dois espelharem exatamente o mesmo número.
 *
 * Regra antiga (todo mundo, inalterada):
 *   - "Entradas do mês" só conta quem está PAGO HOJE e não arquivado;
 *   - "ativos" olham a janela (início/fim) da ficha de HOJE.
 *   Por isso o mês passado "some" quando o assinante vence, é removido ou renova
 *   (a renovação sobrescreve a ficha).
 *
 * Regra nova (só para quem está em ESTABELECIMENTOS_ENTRADAS_COM_HISTORICO):
 *   1. a data de pagamento gravada na ficha conta no mês dela, mesmo que hoje o
 *      assinante esteja vencido/não pago ou arquivado (o dinheiro entrou);
 *   2. os estados gravados em client_subscription_history (desde 24/09/2026)
 *      preservam o mês mesmo depois de a ficha ser sobrescrita pela renovação;
 *   3. "desfazer" (marcar NÃO PAGO no mesmo mês do pagamento) cancela o clique;
 *   4. em mês FECHADO (anterior ao atual), "assinantes ativos" = quem apareceu
 *      como assinante na agenda do mês + quem pagou no mês — inclusive quem já
 *      teve a ficha apagada (a agenda ainda lembra). O mês atual não muda.
 *
 * Pedido: Costa Barbearia (9223), 24/09/2026. Para ligar para todos, trocar a
 * checagem de `usaEntradasComHistorico` por `true` — mas isso muda meses passados
 * de outras barbearias (simulação de ago/2026: 44 de 60 mudariam), então só com
 * decisão explícita do Lucas.
 *
 * Este arquivo é PURO (sem supabase) para poder ser testado fora do navegador.
 * As consultas ficam em subscriberMonthHistoryFetch.ts.
 */
import {
  getWhatsappLookupKeys,
  normalizeSubscriberNameKey,
  normalizeSubscriberPhoneDigits,
  parseSubscriberBoolean,
} from './subscriberAppointmentFlags';

export const ESTABELECIMENTOS_ENTRADAS_COM_HISTORICO = new Set<string>([
  'f90f3509-3ddf-487a-aac6-206b09982bc7', // Costa Barbearia & Tatuagem (9223)
]);

export const usaEntradasComHistorico = (establishmentId: unknown): boolean =>
  ESTABELECIMENTOS_ENTRADAS_COM_HISTORICO.has(String(establishmentId || '').trim());

/** Mês fechado = anterior ao mês atual. month0 vai de 0 a 11, igual a Date#getMonth. */
export const mesFechado = (year: number, month0: number, agora: Date = new Date()): boolean =>
  year < agora.getFullYear() || (year === agora.getFullYear() && month0 < agora.getMonth());

export type HistoricoEstadoAssinante = { createdAt: string; row: Record<string, any> };

export type AgendaAssinanteMesRow = {
  client_name: string;
  client_whatsapp: string;
  subscription_id: string | null;
  appointment_date: string;
};

export type MonthEntryEvent = { dateRaw: string; typeLabel: string; value: number };

export type AtivoReconstruido = {
  id: string;
  clientName: string;
  planName: string;
  value: number;
  liquido: number;
  fonte: 'agenda' | 'pagamento' | 'agenda+pagamento';
};

const partesDeData = (raw: unknown): { year: number; month: number; day: number } | null => {
  const value = String(raw || '').trim();
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), month: parsed.getMonth(), day: parsed.getDate() };
};

const dataNoMes = (raw: unknown, year: number, month0: number): boolean => {
  const p = partesDeData(raw);
  return Boolean(p) && p!.year === year && p!.month === month0;
};

const mesmoDia = (a: unknown, b: unknown): boolean => {
  const pa = partesDeData(a);
  const pb = partesDeData(b);
  return Boolean(pa && pb) && pa!.year === pb!.year && pa!.month === pb!.month && pa!.day === pb!.day;
};

/**
 * Eventos de UM estado da ficha (a ficha de hoje ou um estado gravado no
 * histórico). A data de pagamento conta mesmo se o estado está 'unpaid' (venceu
 * depois) ou arquivado. O início do plano conta se estava pago ou se existe
 * alguma data de pagamento.
 */
export function eventosDoEstadoComHistorico(
  estado: any,
  year: number,
  month0: number,
  valueOf: (estado: any) => number
): MonthEntryEvent[] {
  const eventos: MonthEntryEvent[] = [];
  const value = Number(valueOf(estado) || 0);
  if (!Number.isFinite(value) || value <= 0) return eventos;

  const pago = String(estado?.payment_status || '').toLowerCase() === 'paid';
  const startRaw = String(estado?.start_date || '').trim();
  const paymentRaw = String(estado?.last_payment_date || '').trim();

  const contaInicio = (pago || Boolean(paymentRaw)) && dataNoMes(startRaw, year, month0);
  if (contaInicio) {
    eventos.push({ dateRaw: startRaw.slice(0, 10), typeLabel: 'Novo assinante', value });
  }

  if (dataNoMes(paymentRaw, year, month0)) {
    const duplicateStart = contaInicio && mesmoDia(startRaw, paymentRaw);
    if (!duplicateStart) {
      eventos.push({ dateRaw: paymentRaw.slice(0, 10), typeLabel: 'Renovação', value });
    }
  }

  return eventos;
}

/**
 * Entradas do mês de UM assinante: estados do histórico (cronológicos) + ficha de
 * hoje, sem duplicar a mesma data, com cancelamento de "desfazer".
 */
export function buildEntryEventsComHistorico(
  cs: any,
  estados: HistoricoEstadoAssinante[] | undefined,
  year: number,
  month0: number,
  valueOf: (estado: any) => number
): MonthEntryEvent[] {
  const porData = new Map<string, MonthEntryEvent>();
  const canceladas = new Set<string>();

  // 1) Estados gravados no histórico, em ordem cronológica (desde 24/09/2026).
  //    Mesclar com a ficha de hoje garante o plano (valor) e os campos que o
  //    estado antigo não tem.
  for (const h of estados || []) {
    const estado = { ...(cs || {}), ...(h.row || {}) };
    const pagoNaEpoca = String(h.row?.payment_status || '').toLowerCase() === 'paid';
    if (pagoNaEpoca) {
      for (const ev of eventosDoEstadoComHistorico(estado, year, month0, valueOf)) {
        canceladas.delete(ev.dateRaw);
        if (!porData.has(ev.dateRaw)) porData.set(ev.dateRaw, ev);
      }
      continue;
    }
    // "Desfazer": marcou NÃO PAGO no mesmo mês do pagamento → o clique de pago
    // foi engano. Vencer meses depois não cancela: o pagamento foi real.
    const dataPagamento = String(h.row?.last_payment_date || '').slice(0, 10);
    if (dataPagamento && String(h.createdAt || '').slice(0, 7) === dataPagamento.slice(0, 7)) {
      porData.delete(dataPagamento);
      canceladas.add(dataPagamento);
    }
  }

  // 2) Ficha de hoje (cobre o passado anterior ao histórico).
  for (const ev of eventosDoEstadoComHistorico(cs, year, month0, valueOf)) {
    if (canceladas.has(ev.dateRaw)) continue;
    if (!porData.has(ev.dateRaw)) porData.set(ev.dateRaw, ev);
  }

  return Array.from(porData.values());
}

/** Linhas cruas de client_subscription_history → estados por assinante, em ordem cronológica. */
export function agruparEstadosPorAssinante(rows: any[]): Map<string, HistoricoEstadoAssinante[]> {
  const mapa = new Map<string, HistoricoEstadoAssinante[]>();
  const ordenadas = [...(rows || [])].sort((a, b) =>
    String(a?.created_at || '').localeCompare(String(b?.created_at || ''))
  );
  for (const h of ordenadas) {
    const subId = String(h?.client_subscription_id || '').trim();
    if (!subId || !h?.new_row) continue;
    const lista = mapa.get(subId) || [];
    lista.push({ createdAt: String(h.created_at || ''), row: h.new_row });
    mapa.set(subId, lista);
  }
  return mapa;
}

/** Linhas cruas de appointments → atendimentos de assinante do mês (sem brinde de fidelidade). */
export function normalizarAgendaAssinantes(rows: any[]): AgendaAssinanteMesRow[] {
  return (rows || [])
    .filter((a) => !parseSubscriberBoolean(a?.is_loyalty_reward))
    .map((a) => ({
      client_name: String(a?.client_name || '').trim(),
      client_whatsapp: String(a?.client_whatsapp || '').trim(),
      subscription_id: a?.subscription_id ? String(a.subscription_id) : null,
      appointment_date: String(a?.appointment_date || '').slice(0, 10),
    }));
}

/** "CLIENTE AVULSO", "Cliente", "Encaixe"…: não dá para saber quem é. */
export const nomeGenericoDeAssinante = (nome: unknown): boolean => {
  const k = normalizeSubscriberNameKey(nome);
  return !k || k === 'cliente' || k === 'assinante' || k === 'encaixe' || k === 'nao informado' || k.includes('avulso');
};

/**
 * Mês FECHADO: quem FOI assinante no mês = quem pagou no mês (ficha + histórico)
 * ∪ quem apareceu como assinante na agenda do mês. Ficha apagada entra pela
 * agenda, com o valor do plano do agendamento.
 */
export function reconstruirAtivosDoMes(params: {
  clientSubscriptions: any[];
  agenda: AgendaAssinanteMesRow[];
  estadosPorAssinante: Map<string, HistoricoEstadoAssinante[]>;
  planos: Array<{ id?: unknown; name?: unknown; value?: unknown }>;
  year: number;
  month0: number;
  valueOf: (cs: any) => number;
  netOf: (cs: any, value: number) => number;
  nameOf: (cs: any) => string;
  planNameOf: (cs: any) => string;
}): AtivoReconstruido[] {
  const { clientSubscriptions, agenda, estadosPorAssinante, planos, year, month0, valueOf, netOf, nameOf, planNameOf } = params;

  // Índice das fichas por telefone e por nome. Qualquer ficha vale (arquivada
  // inclusive): o mês é passado, o que importa é quem era o cliente.
  const fichasPorTelefone = new Map<string, any>();
  const fichasPorNome = new Map<string, any>();
  for (const cs of clientSubscriptions || []) {
    for (const raw of [cs?.subscriber_whatsapp, cs?.client_whatsapp]) {
      for (const k of getWhatsappLookupKeys(String(raw || ''))) {
        const key = normalizeSubscriberPhoneDigits(k);
        if (key && !fichasPorTelefone.has(key)) fichasPorTelefone.set(key, cs);
      }
    }
    for (const n of [cs?.subscriber_name, cs?.client_name_override]) {
      const key = normalizeSubscriberNameKey(n);
      if (key && !fichasPorNome.has(key)) fichasPorNome.set(key, cs);
    }
  }

  const porChave = new Map<string, AtivoReconstruido>();
  const registrar = (chave: string, item: Omit<AtivoReconstruido, 'fonte'>, fonte: 'agenda' | 'pagamento') => {
    const atual = porChave.get(chave);
    if (!atual) {
      porChave.set(chave, { ...item, fonte });
      return;
    }
    if (atual.fonte !== fonte) atual.fonte = 'agenda+pagamento';
    if (item.value > atual.value) {
      atual.value = item.value;
      atual.liquido = item.liquido;
      atual.planName = item.planName;
    }
  };
  const itemDaFicha = (cs: any): Omit<AtivoReconstruido, 'fonte'> => {
    const value = Number(valueOf(cs) || 0);
    return {
      id: String(cs?.id || ''),
      clientName: nameOf(cs),
      planName: planNameOf(cs),
      value: Number.isFinite(value) ? value : 0,
      liquido: Number.isFinite(value) ? Number(netOf(cs, value) || 0) : 0,
    };
  };

  // 1) Quem PAGOU no mês — mesma regra de "Entradas do mês".
  for (const cs of clientSubscriptions || []) {
    const id = String(cs?.id || '');
    if (!id) continue;
    if (buildEntryEventsComHistorico(cs, estadosPorAssinante.get(id), year, month0, valueOf).length === 0) continue;
    registrar(id, itemDaFicha(cs), 'pagamento');
  }

  // 2) Quem apareceu como assinante na AGENDA do mês.
  for (const apt of agenda || []) {
    if (nomeGenericoDeAssinante(apt.client_name)) continue;

    let ficha: any;
    for (const k of getWhatsappLookupKeys(apt.client_whatsapp)) {
      ficha = fichasPorTelefone.get(normalizeSubscriberPhoneDigits(k));
      if (ficha) break;
    }
    if (!ficha) ficha = fichasPorNome.get(normalizeSubscriberNameKey(apt.client_name));

    if (ficha) {
      registrar(String(ficha?.id || ''), itemDaFicha(ficha), 'agenda');
      continue;
    }

    // Ficha apagada: só a agenda lembra. Valor = valor do plano do agendamento.
    const plano = (planos || []).find((p) => String(p?.id || '') === String(apt.subscription_id || ''));
    const value = Number(plano?.value || 0);
    const chave = `agenda:${normalizeSubscriberPhoneDigits(apt.client_whatsapp) || normalizeSubscriberNameKey(apt.client_name)}`;
    registrar(chave, {
      id: chave,
      clientName: `${apt.client_name || 'Cliente'} (ficha apagada)`,
      planName: String(plano?.name || 'Plano não identificado'),
      value: Number.isFinite(value) ? value : 0,
      liquido: Number.isFinite(value) ? value : 0,
    }, 'agenda');
  }

  return Array.from(porChave.values()).sort((a, b) => a.clientName.localeCompare(b.clientName, 'pt-BR'));
}
