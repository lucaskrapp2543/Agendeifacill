/**
 * Antes da limpeza automática de `pending_payment`, pergunta ao backend se o MP já aprovou
 * algum pagamento ainda não espelhado no Supabase. Falha silenciosa (não bloqueia UI).
 */
export async function fireMercadoPagoPendingReconcile(establishmentId: string): Promise<void> {
  const id = String(establishmentId || '').trim();
  if (!id) return;

  const url = import.meta.env.PROD
    ? '/.netlify/functions/mercadopago-reconcile-pending-appointments'
    : '/api/mercadopago/reconcile-pending-appointments';

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
  }
}
