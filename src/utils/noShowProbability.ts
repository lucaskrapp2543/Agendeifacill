/**
 * "Probabilidade de falta" mostrada no agendamento EM ESPERA da agenda.
 *
 * Só leitura: usa o histórico que o sistema já guarda por WhatsApp do cliente
 * neste estabelecimento — atendimentos concluídos (status completed) e faltas
 * registradas pelo botão "Cliente faltou" (tabela client_no_shows).
 *
 * Como a conta funciona (em português claro):
 * - Cliente COM histórico: começa perto da média da barbearia e vai para o
 *   número real dele conforme o histórico cresce ("amortecida"). Assim 1 vinda e
 *   1 falta não vira "50% certeza", e 2 vindas sem falta não vira "0% nunca".
 * - Cliente NOVO (sem nada aqui): usa a taxa real de clientes novos desta
 *   barbearia (quantos marcaram e nunca apareceram). Se a barbearia ainda tem
 *   pouco histórico para isso, não inventa número: mostra só "sem histórico".
 */
export type NoShowLevel = 'bom' | 'medio' | 'risco';

export interface ClientAttendanceStats {
  /** Atendimentos concluídos neste estabelecimento. */
  completed: number;
  /** Faltas registradas ("Cliente faltou"). */
  faltas: number;
}

export interface EstablishmentNoShowBaseline {
  /** Clientes com algum histórico (veio ou faltou ao menos 1x). */
  clientsWithHistory: number;
  /** Média geral de faltas da barbearia (0–1). null = sem dado. */
  overallRate: number | null;
  /** Taxa de clientes que marcaram e NUNCA apareceram (0–1). null = pouco histórico. */
  newClientRate: number | null;
}

export interface NoShowProbability {
  /** null = cliente novo numa barbearia com pouco histórico (mostra "sem histórico"). */
  percent: number | null;
  level: NoShowLevel | null;
  isNewClient: boolean;
  /** Histórico curto (menos de 3 eventos): o número ainda pode mudar bastante. */
  lowData: boolean;
  completed: number;
  faltas: number;
}

/** Barbearia precisa de pelo menos este tanto de clientes com histórico para ter "média própria". */
export const MIN_CLIENTS_FOR_BASELINE = 10;
/** Peso da média da barbearia na conta amortecida (equivale a "2 eventos" de histórico). */
const SMOOTHING_WEIGHT = 2;
/** Média usada quando a barbearia ainda não tem a dela. */
const DEFAULT_PRIOR_RATE = 0.3;
const LOW_DATA_EVENTS = 3;

/** Mesmos cortes de Meus Clientes: até 20% bom, até 40% médio, acima risco. */
export function getNoShowLevel(percent: number): NoShowLevel {
  if (percent <= 20) return 'bom';
  if (percent <= 40) return 'medio';
  return 'risco';
}

const clampRate = (rate: number) => Math.min(0.8, Math.max(0.05, rate));

/**
 * Média da barbearia, calculada do mesmo mapa por telefone. O mapa guarda o mesmo
 * objeto nas chaves "telefone" e "55telefone", por isso o Set por identidade.
 */
export function computeEstablishmentNoShowBaseline(
  map: Map<string, ClientAttendanceStats> | null | undefined
): EstablishmentNoShowBaseline {
  const empty: EstablishmentNoShowBaseline = { clientsWithHistory: 0, overallRate: null, newClientRate: null };
  if (!map || map.size === 0) return empty;

  const unique = new Set<ClientAttendanceStats>();
  map.forEach((stats) => unique.add(stats));

  let clientsWithHistory = 0;
  let neverCame = 0;
  let totalCompleted = 0;
  let totalFaltas = 0;
  unique.forEach((stats) => {
    const completed = Math.max(0, Math.round(Number(stats?.completed) || 0));
    const faltas = Math.max(0, Math.round(Number(stats?.faltas) || 0));
    if (completed + faltas <= 0) return;
    clientsWithHistory += 1;
    totalCompleted += completed;
    totalFaltas += faltas;
    if (completed === 0 && faltas > 0) neverCame += 1;
  });

  if (clientsWithHistory < MIN_CLIENTS_FOR_BASELINE) {
    return { clientsWithHistory, overallRate: null, newClientRate: null };
  }
  const totalEvents = totalCompleted + totalFaltas;
  return {
    clientsWithHistory,
    overallRate: totalEvents > 0 ? clampRate(totalFaltas / totalEvents) : null,
    newClientRate: clampRate(neverCame / clientsWithHistory),
  };
}

export function computeNoShowProbability(
  stats: ClientAttendanceStats | null | undefined,
  baseline?: EstablishmentNoShowBaseline | null
): NoShowProbability {
  const completed = Math.max(0, Math.round(Number(stats?.completed) || 0));
  const faltas = Math.max(0, Math.round(Number(stats?.faltas) || 0));
  const total = completed + faltas;

  if (total <= 0) {
    const rate = baseline?.newClientRate ?? null;
    if (rate === null) {
      return { percent: null, level: null, isNewClient: true, lowData: true, completed: 0, faltas: 0 };
    }
    const percent = Math.round(rate * 100);
    return { percent, level: getNoShowLevel(percent), isNewClient: true, lowData: true, completed: 0, faltas: 0 };
  }

  // Conta amortecida: (faltas + média × peso) ÷ (eventos + peso).
  const prior = baseline?.overallRate ?? DEFAULT_PRIOR_RATE;
  const smoothed = (faltas + prior * SMOOTHING_WEIGHT) / (total + SMOOTHING_WEIGHT);
  const percent = Math.round(Math.min(0.95, Math.max(0, smoothed)) * 100);
  return {
    percent,
    level: getNoShowLevel(percent),
    isNewClient: false,
    lowData: total < LOW_DATA_EVENTS,
    completed,
    faltas,
  };
}

/** Telefone só com dígitos e sem o 55 do Brasil — mesma regra do "PRIMEIRO AGENDAMENTO". */
export function normalizePhoneForAttendance(raw: unknown): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  while (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  return digits;
}

/** Procura o histórico do telefone no mapa (com e sem 55). */
export function findClientAttendance(
  map: Map<string, ClientAttendanceStats> | null | undefined,
  rawPhone: unknown
): ClientAttendanceStats | null {
  if (!map) return null;
  const phone = normalizePhoneForAttendance(rawPhone);
  if (!phone) return null;
  return map.get(phone) || map.get('55' + phone) || null;
}

/** Texto curto do histórico para o selo/tooltip. */
export function describeNoShowHistory(p: NoShowProbability): string {
  if (p.isNewClient) {
    return p.percent === null ? 'cliente novo, sem histórico aqui' : 'cliente novo · média de novos nesta barbearia';
  }
  const veio = `veio ${p.completed}x`;
  const faltou = p.faltas > 0 ? `faltou ${p.faltas}x` : 'nunca faltou';
  return `${veio}, ${faltou}${p.lowData ? ' · poucos dados' : ''}`;
}
