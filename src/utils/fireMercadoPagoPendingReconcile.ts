/**
 * Antes da limpeza automática de `pending_payment`, pergunta ao backend se o MP já aprovou
 * algum pagamento ainda não espelhado no Supabase. Falha silenciosa (não bloqueia UI).
 */
const RECONCILE_COOLDOWN_MS = 45000;
const reconcileInFlightByEstablishment = new Map<string, Promise<void>>();
const reconcileLastExecutionByEstablishment = new Map<string, number>();

export async function fireMercadoPagoPendingReconcile(establishmentId: string): Promise<void> {
  const id = String(establishmentId || '').trim();
  if (!id) return;
  const storageKey = `mp_reconcile_last_run_${id}`;
  const now = Date.now();
  const lastRunAtMemory = Number(reconcileLastExecutionByEstablishment.get(id) || 0);
  const lastRunAtStorage = (() => {
    if (typeof window === 'undefined') return 0;
    return Number(window.sessionStorage.getItem(storageKey) || 0);
  })();
  const lastRunAt = Math.max(lastRunAtMemory, lastRunAtStorage);
  if (now - lastRunAt < RECONCILE_COOLDOWN_MS) return;

  const inFlight = reconcileInFlightByEstablishment.get(id);
  if (inFlight) return inFlight;

  const url = import.meta.env.PROD
    ? '/.netlify/functions/mercadopago-reconcile-pending-appointments'
    : '/api/mercadopago/reconcile-pending-appointments';

  const task = (async () => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ establishmentId: id }),
      });
      if (!res.ok) {
        console.warn('[MP Reconcile pending] HTTP', res.status);
      }
    } catch (e) {
      console.warn('[MP Reconcile pending] ignorado:', e);
    } finally {
      const finishedAt = Date.now();
      reconcileLastExecutionByEstablishment.set(id, finishedAt);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(storageKey, String(finishedAt));
      }
      reconcileInFlightByEstablishment.delete(id);
    }
  })();

  reconcileInFlightByEstablishment.set(id, task);
  return task;
}
