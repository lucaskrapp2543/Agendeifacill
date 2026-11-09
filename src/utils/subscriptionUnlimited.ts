/**
 * Serviço "ilimitado" na assinatura. Não existe coluna nova: o limite do serviço fica
 * gravado como 999, que é o que as barbearias já usavam e o que o booking já trata como
 * "sem limite". Daqui para frente a tela mostra "Ilimitado" no lugar do número.
 */
export const UNLIMITED_SERVICE_LIMIT = 999;

export const isUnlimitedServiceLimit = (limit: unknown): boolean => {
  const n = Number(limit);
  return Number.isFinite(n) && n >= UNLIMITED_SERVICE_LIMIT;
};

export const formatServiceLimit = (limit: unknown): string =>
  isUnlimitedServiceLimit(limit) ? 'Ilimitado' : String(Math.floor(Number(limit) || 0));

/** Como a comissão é dividida num plano com serviço ilimitado (são os modelos que já existiam). */
export type UnlimitedCommissionModel = 'fixo' | 'dividir' | 'pontos';

/** Modelo de um plano salvo, pelas mesmas regras do cálculo de repasse. */
export const commissionModelOfPlan = (plan: { divide_total_enabled?: unknown; fixed_commission_value?: unknown }): UnlimitedCommissionModel => {
  const divide = plan?.divide_total_enabled;
  const divideOn = divide === true || divide === 1 || ['true', '1', 't', 'sim', 'yes', 'on'].includes(String(divide ?? '').trim().toLowerCase());
  if (divideOn) return 'dividir';
  return Number(plan?.fixed_commission_value || 0) > 0 ? 'fixo' : 'pontos';
};
