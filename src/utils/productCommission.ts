/**
 * "% por colaborador" dos produtos (establishment_products.commission_percentages).
 *
 * Antes o mapa era gravado pelo NOME do profissional. Quando o dono renomeava alguém,
 * a comissão zerava (caso REFERENCE 8916, 26/10/2026). Agora o mapa é gravado pelo ID
 * do profissional (que nunca muda) e também pelo nome atual, para o app antigo em cache
 * continuar funcionando. Na leitura vale: ID primeiro, depois nome (formato antigo).
 */
export type CommissionMap = Record<string, number>;

export interface CommissionProfessionalRef {
  id?: string | null;
  name?: string | null;
}

const clean = (value: unknown): string => String(value ?? '').trim();

const clampPct = (raw: unknown): number | null => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
};

/** Acha o profissional atual por ID ou, se não tiver ID, pelo nome. */
export function resolveCommissionProfessional(
  professionals: CommissionProfessionalRef[] | null | undefined,
  ref: CommissionProfessionalRef
): CommissionProfessionalRef | null {
  const list = Array.isArray(professionals) ? professionals : [];
  const id = clean(ref?.id);
  const name = clean(ref?.name);
  if (id) {
    const byId = list.find((p) => clean(p?.id) === id);
    if (byId) return byId;
  }
  if (name) {
    const byName = list.find((p) => clean(p?.name) === name);
    if (byName) return byName;
  }
  return id || name ? { id: id || null, name: name || null } : null;
}

/**
 * % de comissão do profissional naquele produto (0 quando não tem).
 * Ordem: chave pelo ID → chave pelo nome atual → chave pelo nome recebido (legado).
 */
export function getProductCommissionPct(
  map: CommissionMap | null | undefined,
  professionals: CommissionProfessionalRef[] | null | undefined,
  ref: CommissionProfessionalRef
): number {
  if (!map || typeof map !== 'object') return 0;
  const resolved = resolveCommissionProfessional(professionals, ref);
  const keys = [clean(resolved?.id), clean(resolved?.name), clean(ref?.name)].filter(Boolean);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      const pct = clampPct(map[key]);
      if (pct !== null) return pct;
    }
  }
  return 0;
}

/**
 * Monta o mapa para gravar: cada profissional atual entra pelo ID e pelo nome (mesmo valor).
 * Chaves que não são de nenhum profissional atual (nomes antigos) são descartadas.
 */
export function buildCommissionMapForSave(
  professionals: CommissionProfessionalRef[] | null | undefined,
  pctByProfessionalId: Record<string, number | null | undefined>
): CommissionMap {
  const out: CommissionMap = {};
  const list = Array.isArray(professionals) ? professionals : [];
  for (const p of list) {
    const id = clean(p?.id);
    const name = clean(p?.name);
    if (!id) continue;
    const pct = clampPct(pctByProfessionalId[id]);
    if (pct === null) continue;
    const rounded = Math.round(pct * 100) / 100;
    out[id] = rounded;
    if (name) out[name] = rounded;
  }
  return out;
}
