/**
 * Histórico mensal de assinantes — quanto entrou em cada mês e quem foi assinante.
 *
 * FONTE ÚNICA para a aba "Meus Assinantes" (SubscribersManager) e para o card
 * "Financeiro de Meus Assinantes" do dashboard (EstablishmentDashboard), para os
 * dois mostrarem exatamente o mesmo número.
 *
 * Regra (vale para todos os estabelecimentos desde 04/11/2026, decisão do Lucas):
 *   1. pagamento feito fica no mês dele: vencer, renovar, arquivar ou apagar a
 *      ficha depois NÃO tira o valor daquele mês (o dinheiro entrou);
 *   2. cada pagamento conta UMA vez: cadastrar num dia e pagar em outro é um
 *      pagamento só, não "novo assinante" + "renovação";
 *   3. "desfazer" (marcar NÃO PAGO com o plano ainda correndo, no mesmo mês do
 *      pagamento) cancela o clique. Vencimento natural NÃO é desfazer;
 *   4. em mês FECHADO (anterior ao atual), "assinantes ativos" = quem apareceu
 *      como assinante na agenda do mês + quem pagou no mês — inclusive quem já
 *      teve a ficha apagada (a agenda ainda lembra). O mês atual não muda.
 *
 * Fonte: linha do tempo de client_subscription_history (desde 24/09/2026). O que
 * veio antes disso só pode ser lido da ficha, então meses antigos ficam parciais.
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

/** Ligada para todos. Para voltar à regra antiga (ficha de hoje), basta devolver false aqui. */
export const usaEntradasComHistorico = (_establishmentId?: unknown): boolean => true;

/** Mês fechado = anterior ao mês atual. month0 vai de 0 a 11, igual a Date#getMonth. */
export const mesFechado = (year: number, month0: number, agora: Date = new Date()): boolean =>
  year < agora.getFullYear() || (year === agora.getFullYear() && month0 < agora.getMonth());

export type HistoricoEstadoAssinante = {
  createdAt: string;
  /** SNAPSHOT | INSERT | UPDATE | DELETE. DELETE vem com row vazia. */
  operation?: string;
  row: Record<string, any>;
};

export type AgendaAssinanteMesRow = {
  client_name: string;
  client_whatsapp: string;
  subscription_id: string | null;
  appointment_date: string;
};

export type MonthEntryEvent = { dateRaw: string; typeLabel: string; value: number };

/** Uma entrada do mês com a ficha de onde veio (a ficha pode já ter sido apagada). */
export type EntradaDoMes = MonthEntryEvent & { fichaId: string; ficha: any };

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

/** Menos dias que isso entre duas datas, sem o plano ganhar prazo = o mesmo pagamento (planos são mensais). */
const DIAS_MINIMOS_ENTRE_PAGAMENTOS = 20;

const diaDe = (raw: unknown): string => {
  const p = partesDeData(raw);
  if (!p) return '';
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/** b - a, em dias. As duas datas no formato AAAA-MM-DD. */
const diasEntre = (a: string, b: string): number =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

/** Dia, no horário de Brasília, em que a alteração da ficha foi gravada. */
const diaDoRegistro = (createdAt: unknown): string => {
  const t = new Date(String(createdAt || '')).getTime();
  return Number.isFinite(t) ? new Date(t - 3 * 3600000).toISOString().slice(0, 10) : '';
};

const estaPago = (estado: any): boolean => String(estado?.payment_status || '').toLowerCase() === 'paid';

/** Data do pagamento que este estado representa: a gravada ou, sem ela, o início do plano. */
const dataDoPagamento = (estado: any): string => diaDe(estado?.last_payment_date) || diaDe(estado?.start_date);

/**
 * Ficha de hoje + estado gravado. O plano do estado vale sobre o de hoje: se o
 * assinante trocou de plano depois, o valor daquele mês continua o da época.
 */
const mesclarEstado = (cs: any, row: Record<string, any>): any => {
  const estado = { ...(cs || {}), ...(row || {}) };
  if (row?.subscription_id && String(row.subscription_id) !== String(cs?.subscription_id || '')) {
    delete (estado as any).subscriptions;
  }
  return estado;
};

/**
 * Eventos de UM estado da ficha quando NÃO há linha do tempo para acompanhar
 * (ficha sem histórico ou "foto" tirada em 24/09/2026). A data de pagamento conta
 * mesmo se o estado está 'unpaid' (venceu depois) ou arquivado. O início do plano
 * só é um pagamento à parte se não houver pagamento registrado perto dele.
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

  const inicio = diaDe(estado?.start_date);
  const pagamento = diaDe(estado?.last_payment_date);
  const pertoDoInicio = Boolean(inicio && pagamento) && diasEntre(inicio, pagamento) < DIAS_MINIMOS_ENTRE_PAGAMENTOS;

  if (pagamento && dataNoMes(pagamento, year, month0)) {
    eventos.push({ dateRaw: pagamento, typeLabel: pertoDoInicio ? 'Novo assinante' : 'Renovação', value });
  }

  const inicioContaSozinho = pagamento ? !pertoDoInicio : estaPago(estado);
  if (inicio && inicioContaSozinho && dataNoMes(inicio, year, month0)) {
    eventos.push({ dateRaw: inicio, typeLabel: 'Novo assinante', value });
  }

  return eventos;
}

/**
 * Entradas do mês de UM assinante, acompanhando a linha do tempo da ficha:
 * virou pago = um pagamento; data trocada logo depois = correção do mesmo
 * pagamento; virou não pago com o plano correndo, no mesmo mês = desfazer.
 * Os estados precisam vir em ordem cronológica e sem filtro de mês.
 */
export function buildEntryEventsComHistorico(
  cs: any,
  estados: HistoricoEstadoAssinante[] | undefined,
  year: number,
  month0: number,
  valueOf: (estado: any) => number
): MonthEntryEvent[] {
  if (!estados || estados.length === 0) {
    return eventosDoEstadoComHistorico(cs, year, month0, valueOf);
  }

  const porData = new Map<string, MonthEntryEvent>();
  const canceladas = new Set<string>();
  let anterior: any = null;
  let pagamentosFeitos = 0;

  const registrar = (estado: any, data: string) => {
    const novoAssinante = pagamentosFeitos === 0;
    pagamentosFeitos += 1;
    if (!data || !dataNoMes(data, year, month0)) return;
    const value = Number(valueOf(estado) || 0);
    if (!Number.isFinite(value) || value <= 0) return;
    canceladas.delete(data);
    if (!porData.has(data)) {
      porData.set(data, { dateRaw: data, typeLabel: novoAssinante ? 'Novo assinante' : 'Renovação', value });
    }
  };
  const cancelar = (data: string) => {
    if (!data) return;
    porData.delete(data);
    canceladas.add(data);
    pagamentosFeitos = Math.max(0, pagamentosFeitos - 1);
  };

  for (const h of estados) {
    const dia = diaDoRegistro(h.createdAt);

    if (h.operation === 'DELETE') {
      // Apagou no mesmo mês do pagamento: cadastro errado. Apagar depois não muda o passado.
      const dataAntes = anterior ? dataDoPagamento(anterior) : '';
      if (dataAntes && dia.slice(0, 7) === dataAntes.slice(0, 7)) cancelar(dataAntes);
      anterior = null;
      continue;
    }

    const estado = mesclarEstado(cs, h.row);

    // Primeira linha: se a ficha nasceu com histórico, a linha do tempo está inteira.
    // Se é a "foto" de 24/09/2026 (ou outra linha solta), o passado só existe nesse estado.
    if (!anterior) {
      if (h.operation === 'INSERT') {
        if (estaPago(estado)) registrar(estado, dataDoPagamento(estado));
      } else {
        const eventos = eventosDoEstadoComHistorico(estado, year, month0, valueOf);
        for (const ev of eventos) {
          canceladas.delete(ev.dateRaw);
          if (!porData.has(ev.dateRaw)) porData.set(ev.dateRaw, ev);
        }
        if (estaPago(estado) || diaDe(estado?.last_payment_date)) pagamentosFeitos += 1;
      }
      anterior = estado;
      continue;
    }

    const pago = estaPago(estado);
    const pagoAntes = estaPago(anterior);
    const data = dataDoPagamento(estado);
    const dataAntes = dataDoPagamento(anterior);

    if (pago && !pagoAntes) {
      registrar(estado, data);
    } else if (pago && pagoAntes && data !== dataAntes) {
      const fim = diaDe(estado?.end_date);
      const fimAntes = diaDe(anterior?.end_date);
      const ganhouPrazo = Boolean(fim && fimAntes) && diasEntre(fimAntes, fim) >= DIAS_MINIMOS_ENTRE_PAGAMENTOS;
      const mesmoPagamento =
        !ganhouPrazo && Boolean(data && dataAntes) && Math.abs(diasEntre(dataAntes, data)) < DIAS_MINIMOS_ENTRE_PAGAMENTOS;
      if (!mesmoPagamento) {
        registrar(estado, data);
      } else if (porData.has(dataAntes)) {
        // Correção da data: o pagamento continua um só.
        const ev = porData.get(dataAntes)!;
        porData.delete(dataAntes);
        if (dataNoMes(data, year, month0)) porData.set(data, { ...ev, dateRaw: data });
      } else if (dataNoMes(data, year, month0) && !dataNoMes(dataAntes, year, month0)) {
        // A correção trouxe o pagamento de outro mês para este.
        const value = Number(valueOf(estado) || 0);
        if (Number.isFinite(value) && value > 0) {
          porData.set(data, { dateRaw: data, typeLabel: pagamentosFeitos > 1 ? 'Renovação' : 'Novo assinante', value });
        }
      }
    } else if (!pago && pagoAntes) {
      const fim = diaDe(anterior?.end_date);
      const venceu = Boolean(fim) && fim <= dia;
      if (!venceu && dataAntes && dia.slice(0, 7) === dataAntes.slice(0, 7)) cancelar(dataAntes);
    }

    anterior = estado;
  }

  // Segurança: se a ficha de hoje traz um pagamento que a linha do tempo não pegou, ele conta.
  const pagamentoHoje = diaDe(cs?.last_payment_date);
  if (pagamentoHoje && dataNoMes(pagamentoHoje, year, month0) && !porData.has(pagamentoHoje) && !canceladas.has(pagamentoHoje)) {
    const value = Number(valueOf(cs) || 0);
    if (Number.isFinite(value) && value > 0) {
      porData.set(pagamentoHoje, { dateRaw: pagamentoHoje, typeLabel: pagamentosFeitos > 1 ? 'Renovação' : 'Novo assinante', value });
    }
  }

  return Array.from(porData.values());
}

/**
 * Tudo o que entrou no mês na barbearia: fichas de hoje + fichas já apagadas, que
 * só o histórico lembra. A mesma pessoa, no mesmo plano e no mesmo dia, conta uma
 * vez, mesmo se tiver duas fichas repetidas. É daqui que saem Financeiro e
 * Meus Assinantes.
 */
export function calcularEntradasDoMes(params: {
  fichas: any[];
  estadosPorAssinante: Map<string, HistoricoEstadoAssinante[]>;
  year: number;
  month0: number;
  valueOf: (estado: any) => number;
}): EntradaDoMes[] {
  const { fichas, estadosPorAssinante, year, month0, valueOf } = params;
  const entradas = new Map<string, EntradaDoMes>();

  const somar = (ficha: any, estados: HistoricoEstadoAssinante[] | undefined) => {
    const pessoa =
      normalizeSubscriberPhoneDigits(ficha?.subscriber_whatsapp || ficha?.client_whatsapp || '') ||
      normalizeSubscriberNameKey(ficha?.subscriber_name) ||
      String(ficha?.id || '');
    for (const ev of buildEntryEventsComHistorico(ficha, estados, year, month0, valueOf)) {
      const chave = `${pessoa}|${String(ficha?.subscription_id || '')}|${ev.dateRaw}`;
      if (!entradas.has(chave)) entradas.set(chave, { ...ev, fichaId: String(ficha?.id || ''), ficha });
    }
  };

  const idsDeHoje = new Set<string>();
  for (const ficha of fichas || []) {
    const id = String(ficha?.id || '');
    if (id) idsDeHoje.add(id);
    somar(ficha, estadosPorAssinante.get(id));
  }

  for (const [id, estados] of estadosPorAssinante) {
    if (idsDeHoje.has(id)) continue;
    // Sem nome ou telefone não é assinante de verdade: as telas também não mostram.
    const ultimoEstado = [...estados].reverse().find((h) => h.operation !== 'DELETE')?.row;
    if (!ultimoEstado?.subscriber_name || !ultimoEstado?.subscriber_whatsapp) continue;
    somar({ id, ...ultimoEstado }, estados);
  }

  return Array.from(entradas.values());
}

/** Linhas cruas de client_subscription_history → estados por assinante, em ordem cronológica. */
export function agruparEstadosPorAssinante(rows: any[]): Map<string, HistoricoEstadoAssinante[]> {
  const mapa = new Map<string, HistoricoEstadoAssinante[]>();
  const ordenadas = [...(rows || [])].sort((a, b) =>
    String(a?.created_at || '').localeCompare(String(b?.created_at || ''))
  );
  for (const h of ordenadas) {
    const subId = String(h?.client_subscription_id || '').trim();
    const operation = String(h?.operation || '');
    if (!subId || (!h?.new_row && operation !== 'DELETE')) continue;
    const lista = mapa.get(subId) || [];
    lista.push({ createdAt: String(h.created_at || ''), operation, row: h.new_row || {} });
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
