/**
 * Intervalo de datas para contar usos da assinatura (limite por serviço / total).
 * Usa o período vigente em client_subscriptions (início → fim da assinatura), não o mês civil.
 * Ao renovar e atualizar start/end (ou criar novo período), agendamentos fora do intervalo não entram na conta.
 */
export function getSubscriptionUsageDateRange(
  clientSubscription: { start_date?: string | null; end_date?: string | null } | null | undefined,
  fallbackTargetDate: Date
): { periodMin: string; periodMax: string } {
  const start = String(clientSubscription?.start_date || '').slice(0, 10);
  const end = String(clientSubscription?.end_date || '').slice(0, 10);
  if (start && end && start <= end) {
    return { periodMin: start, periodMax: end };
  }
  const d = fallbackTargetDate;
  const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    periodMin: firstDayOfMonth.toISOString().split('T')[0],
    periodMax: lastDayOfMonth.toISOString().split('T')[0],
  };
}
