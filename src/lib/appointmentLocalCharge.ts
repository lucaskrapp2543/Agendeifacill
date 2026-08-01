import { supabase } from './supabase';

/**
 * 💳 COBRAR CLIENTE — PIX de balcão para agendamentos sem pagamento online.
 *
 * A criação da cobrança acontece NO SERVIDOR (função Netlify): é lá que o valor
 * é lido do banco e a taxa da plataforma é definida. Daqui só sai o id do
 * agendamento — nunca um valor.
 *
 * A leitura é direta na tabela, protegida por RLS (só o dono enxerga as
 * cobranças da própria barbearia).
 *
 * Nada aqui altera agendamento: status, payment_status e payment_transaction_id
 * continuam exatamente como estavam.
 */

export type AppointmentLocalChargeStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'expired';

export type AppointmentLocalCharge = {
  id: string;
  appointmentId: string;
  amountCents: number;
  paymentId: string;
  status: AppointmentLocalChargeStatus;
  qrCode: string;
  qrCodeBase64: string;
  paidAt: string | null;
  createdAt: string;
};

export type CreateLocalChargeResult =
  | {
    ok: true;
    chargeId: string | null;
    paymentId: string;
    amountCents: number;
    qrCode: string;
    qrCodeBase64: string;
    reused?: boolean;
    alreadyPaid?: boolean;
    warning?: string;
  }
  | { ok: false; message: string };

/** Tabela ainda não criada — o recurso simplesmente não aparece. */
function isMissingLocalChargeTable(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  if (code === '42P01' || code === 'PGRST205') return true;
  return (
    msg.includes('appointment_local_charges') ||
    msg.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

const mapRow = (raw: any): AppointmentLocalCharge => ({
  id: String(raw?.id || ''),
  appointmentId: String(raw?.appointment_id || ''),
  amountCents: Number(raw?.amount_cents || 0),
  paymentId: String(raw?.payment_id || ''),
  status: String(raw?.status || 'pending') as AppointmentLocalChargeStatus,
  qrCode: String(raw?.qr_code || ''),
  qrCodeBase64: String(raw?.qr_code_base64 || ''),
  paidAt: raw?.paid_at ? String(raw.paid_at) : null,
  createdAt: String(raw?.created_at || ''),
});

const endpoint = () =>
  import.meta.env.PROD
    ? '/.netlify/functions/mercadopago-create-appointment-local-charge'
    : '/api/mercadopago/create-appointment-local-charge';

/**
 * Gera (ou reaproveita) o PIX de balcão do agendamento.
 * Clicar duas vezes devolve o MESMO QR Code — nunca gera dois.
 */
export async function createAppointmentLocalCharge(appointmentId: string): Promise<CreateLocalChargeResult> {
  const id = String(appointmentId || '').trim();
  if (!id) return { ok: false, message: 'Agendamento não informado.' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = String(sessionData?.session?.access_token || '').trim();
    if (!accessToken) {
      return { ok: false, message: 'Sua sessão expirou. Entre novamente e tente de novo.' };
    }

    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ appointmentId: id }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        message: String(
          (payload as any)?.userMessage || (payload as any)?.error || `Erro ${response.status}`
        ),
      };
    }

    if ((payload as any)?.already_paid === true) {
      return {
        ok: true,
        alreadyPaid: true,
        chargeId: String((payload as any)?.charge_id || '') || null,
        paymentId: String((payload as any)?.payment_id || ''),
        amountCents: Number((payload as any)?.amount_cents || 0),
        qrCode: '',
        qrCodeBase64: '',
      };
    }

    const qrCode = String((payload as any)?.qr_code || '').trim();
    const qrCodeBase64 = String((payload as any)?.qr_code_base64 || '').trim();
    if (!qrCode && !qrCodeBase64) {
      return { ok: false, message: 'Não foi possível gerar o QR Code agora. Tente novamente.' };
    }

    return {
      ok: true,
      chargeId: String((payload as any)?.charge_id || '') || null,
      paymentId: String((payload as any)?.payment_id || ''),
      amountCents: Number((payload as any)?.amount_cents || 0),
      qrCode,
      qrCodeBase64,
      reused: (payload as any)?.reused === true,
      warning: (payload as any)?.warning ? String((payload as any).warning) : undefined,
    };
  } catch (error: any) {
    return { ok: false, message: String(error?.message || 'Erro ao gerar a cobrança.') };
  }
}

/**
 * Cobranças de vários agendamentos de uma vez (evita N+1 na agenda).
 * Degrada em silêncio: sem a tabela, devolve mapa vazio e nada aparece.
 */
export async function fetchAppointmentLocalCharges(
  appointmentIds: string[]
): Promise<Record<string, AppointmentLocalCharge>> {
  const ids = Array.from(new Set((appointmentIds || []).map((v) => String(v || '').trim()).filter(Boolean)));
  if (ids.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('appointment_local_charges')
      .select('id, appointment_id, amount_cents, payment_id, status, qr_code, qr_code_base64, paid_at, created_at')
      .in('appointment_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      if (!isMissingLocalChargeTable(error)) {
        console.warn('⚠️ Cobrança de balcão: erro ao carregar:', error);
      }
      return {};
    }

    const map: Record<string, AppointmentLocalCharge> = {};
    for (const raw of Array.isArray(data) ? data : []) {
      const charge = mapRow(raw);
      const current = map[charge.appointmentId];
      // "Paga" sempre vence a pendente — é o estado que o barbeiro precisa ver.
      if (!current || (charge.status === 'paid' && current.status !== 'paid')) {
        map[charge.appointmentId] = charge;
      }
    }
    return map;
  } catch (error) {
    if (!isMissingLocalChargeTable(error)) {
      console.warn('⚠️ Cobrança de balcão: falha inesperada:', error);
    }
    return {};
  }
}

/** Cobrança de um agendamento só — usado pela verificação automática do modal. */
export async function fetchAppointmentLocalCharge(
  appointmentId: string
): Promise<AppointmentLocalCharge | null> {
  const map = await fetchAppointmentLocalCharges([appointmentId]);
  return map[String(appointmentId || '').trim()] || null;
}

/** Cancela uma cobrança ainda aberta (o barbeiro desistiu ou o cliente pagou de outro jeito). */
export async function cancelAppointmentLocalCharge(chargeId: string): Promise<boolean> {
  const id = String(chargeId || '').trim();
  if (!id) return false;
  try {
    const { error } = await supabase
      .from('appointment_local_charges')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');
    return !error;
  } catch {
    return false;
  }
}

/**
 * Regra do badge: qualquer sinal de pagamento online esconde o botão de cobrar.
 * Inclui `pending_payment` — nesse estado o cliente já começou a pagar pelo
 * link, e cobrar no balcão poderia fazer ele pagar duas vezes.
 */
export function appointmentHasOnlinePayment(appointment: any): boolean {
  const paymentStatus = String(appointment?.payment_status || '').toLowerCase().trim();
  const transactionId = String(appointment?.payment_transaction_id || '').trim();
  const pixStatus = String(appointment?.pix_payment_status || '').toLowerCase().trim();
  const status = String(appointment?.status || '').toLowerCase().trim();
  return (
    status === 'pending_payment' ||
    paymentStatus === 'paid' ||
    Boolean(transactionId) ||
    pixStatus === 'aprovado' ||
    pixStatus === 'approved' ||
    pixStatus === 'confirmado'
  );
}
