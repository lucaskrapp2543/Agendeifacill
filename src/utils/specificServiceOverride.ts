/**
 * Serviço específico do profissional vence o serviço geral de MESMO NOME no balcão
 * (Reservar Cliente): tempo e preço passam a ser os do barbeiro escolhido, igual ao que
 * o link de agendamento já faz. O id e os pontos (AFCoins) continuam os do serviço
 * geral, para não mudar relatórios nem a pontuação do cliente.
 *
 * Caso real (3337, 21/10/2026): "Corte e barba" geral = 60 min escondia o "Corte e barba"
 * de 30 min do Gabriel; o dono tentou corrigir mudando o geral e estragou o da Nathalia.
 */
export interface ServiceLike {
  id?: string;
  name: string;
  price: number;
  duration: number;
  loyalty_points?: number;
}

export const normalizeServiceNameKey = (name: unknown): string =>
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function findSpecificServiceByName<T extends ServiceLike>(
  specific: T[] | null | undefined,
  name: unknown
): T | null {
  if (!Array.isArray(specific) || specific.length === 0) return null;
  const key = normalizeServiceNameKey(name);
  if (!key) return null;
  return specific.find((s) => normalizeServiceNameKey(s?.name) === key) || null;
}

/** Devolve o serviço geral com tempo e preço do específico de mesmo nome (se existir). */
export function applySpecificServiceOverride<T extends ServiceLike>(
  base: T,
  specific: ServiceLike[] | null | undefined
): T {
  const match = findSpecificServiceByName(specific, base?.name);
  if (!match) return base;
  const duration = Number(match.duration);
  const price = Number(match.price);
  return {
    ...base,
    duration: Number.isFinite(duration) && duration > 0 ? duration : base.duration,
    price: Number.isFinite(price) && price > 0 ? price : base.price,
  };
}

/**
 * Lista do balcão: serviços gerais (com tempo/preço do específico quando o nome bate)
 * mais os específicos que não existem na lista geral.
 */
export function mergeSpecificServices<T extends ServiceLike>(base: T[], specific: T[]): T[] {
  if (!Array.isArray(specific) || specific.length === 0) return base;
  const replaced = base.map((s) => applySpecificServiceOverride(s, specific));
  const baseKeys = new Set(base.map((s) => normalizeServiceNameKey(s.name)));
  const toAdd = specific.filter((s) => !baseKeys.has(normalizeServiceNameKey(s.name)));
  return [...replaced, ...toAdd];
}
