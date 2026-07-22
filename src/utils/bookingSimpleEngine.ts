import { format } from 'date-fns';
import { checkWhatsAppSubscriber as checkLegacySubscriber, createGuestClientAndLogin, getSubscriptions, supabase } from '../lib/supabase';
import { checkWhatsAppSubscriber as checkNewSubscriber } from '../lib/subscriberSystem';
import { resolveBookingPaymentAmount } from './appointmentPayment';
import { filterTimesAlignedToScheduleGrid, getScheduleIntervalMinutes } from './scheduleGrid';
import { establishmentHasMercadoPago } from './establishmentPaymentFlags';

/**
 * Motor de agendamento da página simples (/booking/:id/af).
 *
 * Este arquivo é uma CÓPIA isolada da lógica equivalente em src/pages/BookingPage.tsx
 * (página /booking/:id original). É deliberadamente independente — não importa nem
 * altera BookingPage.tsx — para garantir isolamento total entre as duas páginas.
 *
 * Origem de cada trecho copiado (referência se a regra de negócio mudar lá e precisar
 * ser replicada aqui manualmente; sincronizado em 2026-06-30):
 * - loadEstablishmentAndServices: BookingPage.tsx linhas ~989-1167
 * - resolveProfessionalMatch: BookingPage.tsx linhas ~2247-2262
 * - checkAppointmentConflict: BookingPage.tsx linhas ~2218-2349
 * - resolvePaymentRequirement: BookingPage.tsx linhas ~2087-2151
 * - buildNormalPayload / buildPendingPaymentPayload: BookingPage.tsx linhas ~2400-2410, ~2530-2537
 * - ensureGuestSession: BookingPage.tsx linhas ~1830-1875
 *
 * Simplificação intencional: os fallbacks de retry para esquemas de banco antigos
 * (colunas ausentes em bancos não migrados) não foram copiados aqui — esta página é
 * nova e o banco já tem todas as colunas modernas necessárias.
 */

export interface SimpleProfessional {
  id: string;
  name: string;
  photo_url?: string | null;
  work_hours?: Record<string, { enabled: boolean; entry_time?: string; break_start?: string; break_end?: string; exit_time?: string }> | null;
  absences?: string[];
  blocked_hours?: Record<string, string[]>;
  hidden_from_booking?: boolean;
}

export interface SimpleService {
  id: string;
  name: string;
  price: number;
  duration: number;
  image_url?: string | null;
  /** Profissionais bloqueados pela categoria do serviço (não veem o serviço no agendamento). */
  excluded_professional_ids?: string[];
}

/** Origem: BookingPage.tsx ~989-1167 (fetchEstablishment, sem os fallbacks de coluna legada). */
export async function loadEstablishmentAndServices(code: string): Promise<{ establishment: any | null; error: string | null }> {
  try {
    // Caminho seguro: função que devolve o estabelecimento SEM os campos secretos
    // (tokens do Mercado Pago, senhas, CPF/CNPJ bancário). Se falhar, cai no método antigo.
    let data: any = null;
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc('get_establishment_public', { p_code: code });
      if (!rpcErr && Array.isArray(rows)) data = rows[0] || null;
    } catch {
      // cai no método antigo abaixo
    }

    if (!data) {
      const res = await supabase
        .from('establishments')
        .select(
          `*, pix_payment_link, review_link, social_media_link, pix_key, whatsapp,
           pagarme_recipient_id, has_mercadopago`
        )
        .eq('code', code)
        .maybeSingle();
      if (res.error) throw res.error;
      data = res.data;
    }

    if (!data) return { establishment: null, error: 'Estabelecimento não encontrado.' };
    if ((data as any).booking_blocked) {
      return { establishment: { ...data, _blocked: true }, error: null };
    }

    let servicesFromCategories: any[] = [];
    try {
      const { data: subs, error: subErr } = await supabase
        .from('service_subcategories')
        .select(`*, service_categories!inner(*)`)
        .eq('is_active', true)
        .eq('service_categories.is_active', true)
        .eq('service_categories.establishment_id', data.id)
        .order('service_categories(display_order)', { ascending: true })
        .order('display_order', { ascending: true });

      if (!subErr) {
        const isHidden = (o: any) => Boolean(o?.hidden_from_booking ?? o?.oculto_da_reserva);
        const isActive = (o: any) => o?.is_active !== false;
        const establishmentIdNorm = String((data as any)?.id || '').trim();
        const visible = (subs || []).filter((s: any) => {
          const cat = s?.service_categories;
          return (
            String(cat?.establishment_id || '').trim() === establishmentIdNorm &&
            isActive(s) &&
            isActive(cat) &&
            !isHidden(s) &&
            !isHidden(cat)
          );
        });

        const parseExcludedIds = (raw: any): string[] => {
          if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean);
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
            } catch { return []; }
          }
          return [];
        };

        servicesFromCategories = visible
          .filter((s: any) => s?.id && s?.name)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            price: Number(s.price || 0),
            duration: Number(s.duration || 30),
            image_url: String(s?.image_url || '').trim() || null,
            // Bloqueio de profissionais definido na CATEGORIA (união com o do serviço, se existir)
            excluded_professional_ids: Array.from(new Set([
              ...parseExcludedIds(s?.excluded_professional_ids),
              ...parseExcludedIds(s?.service_categories?.excluded_professional_ids),
            ])),
          }));
      }
    } catch {
      // Silencioso — cai no fallback de serviços legados abaixo.
    }

    const usingCategories = servicesFromCategories.length > 0;
    const resolvedServices: SimpleService[] = usingCategories
      ? servicesFromCategories
      : Array.isArray((data as any)?.services_with_prices)
        ? (data as any).services_with_prices
        : [];

    return {
      establishment: { ...data, services_with_prices: resolvedServices },
      error: null,
    };
  } catch (err: any) {
    return { establishment: null, error: err?.message || 'Erro ao carregar estabelecimento.' };
  }
}

/** Origem: BookingPage.tsx ~2156-2161. */
export const normalizeText = (raw: any): string =>
  String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Origem: BookingPage.tsx ~584-595. */
export const buildPhoneCandidates = (rawPhone: string): string[] => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return [];
  const candidates = new Set<string>();
  candidates.add(digits);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    candidates.add(digits.slice(2));
  } else if (digits.length === 10 || digits.length === 11) {
    candidates.add(`55${digits}`);
  }
  return Array.from(candidates).filter(Boolean);
};

/** Origem: BookingPage.tsx ~2247-2262 (resolução de profissional por ID ou nome normalizado). */
export function resolveProfessionalMatch(professionals: any[], professionalRef: string): SimpleProfessional | null {
  const refNorm = normalizeText(professionalRef);
  const list = Array.isArray(professionals) ? professionals : [];
  return (
    list.find((p: any) => {
      const id = String(p?.id || '').trim();
      const nameNorm = normalizeText(p?.name);
      return (id.length > 0 && id === String(professionalRef || '').trim()) || (nameNorm.length > 0 && nameNorm === refNorm);
    }) || null
  );
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const normalizeTimeHHmm = (rawTime: any): string => {
  const value = String(rawTime || '').trim();
  if (!value) return '00:00';
  const [h = '00', m = '00'] = value.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
};

/**
 * Checagem de conflito/double-booking antes de inserir o agendamento.
 * Origem: BookingPage.tsx ~2218-2349 (re-busca snapshot fresco de profissionais e
 * agendamentos do dia, não confia em cache do client).
 */
export async function checkAppointmentConflict(params: {
  establishmentId: string;
  professionalRef: string;
  targetDate: string;
  targetTime: string;
  durationMinutes: number;
  scheduleIntervalMinutes: number;
}): Promise<{ ok: boolean; message?: string }> {
  const { establishmentId, professionalRef, targetDate, targetTime, durationMinutes, scheduleIntervalMinutes } = params;
  const targetProfessionalRefNorm = normalizeText(professionalRef);
  const targetStart = toMinutes(normalizeTimeHHmm(targetTime));
  const targetEnd = targetStart + durationMinutes;

  let freshProfessionals: any[] = [];
  try {
    const { data } = await supabase.from('establishments').select('professionals').eq('id', establishmentId).single();
    if (Array.isArray(data?.professionals)) freshProfessionals = data.professionals;
  } catch {
    // Segue com snapshot vazio — checagem de bloqueio/ausência fica best-effort.
  }

  const selectedProfessional = resolveProfessionalMatch(freshProfessionals, professionalRef);
  const targetProfessionalNameNorm = selectedProfessional?.name ? normalizeText(selectedProfessional.name) : '';
  const targetProfessionalIdNorm = selectedProfessional?.id ? normalizeText(selectedProfessional.id) : '';

  if (selectedProfessional) {
    const absences = Array.isArray(selectedProfessional.absences)
      ? selectedProfessional.absences.map((d: any) => String(d || '').slice(0, 10)).filter(Boolean)
      : [];
    if (absences.includes(targetDate)) {
      return { ok: false, message: 'Este profissional está indisponível neste dia. Escolha outro horário.' };
    }

    const blockedMap = selectedProfessional.blocked_hours && typeof selectedProfessional.blocked_hours === 'object' ? selectedProfessional.blocked_hours : {};
    const blockedTimes = filterTimesAlignedToScheduleGrid(
      Array.isArray((blockedMap as any)[targetDate]) ? (blockedMap as any)[targetDate].map((t: any) => normalizeTimeHHmm(t)).filter(Boolean) : [],
      scheduleIntervalMinutes
    );
    const hasBlockedConflict = blockedTimes.some((blockedTime) => {
      const blockedStart = toMinutes(blockedTime);
      const blockedEnd = blockedStart + scheduleIntervalMinutes;
      const startsInBlocked = targetStart >= blockedStart && targetStart < blockedEnd;
      const endsInBlocked = targetEnd > blockedStart && targetEnd <= blockedEnd;
      const encompassesBlocked = targetStart <= blockedStart && targetEnd >= blockedEnd;
      return startsInBlocked || endsInBlocked || encompassesBlocked;
    });
    if (hasBlockedConflict) {
      return { ok: false, message: 'Este horário foi bloqueado pelo profissional. Escolha outro horário.' };
    }
  }

  let sameDayAppointments: any[] = [];
  {
    let loaded = false;
    // Caminho seguro: disponibilidade sem dados pessoais.
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_day_availability', {
        p_establishment_id: establishmentId,
        p_date: targetDate,
      });
      if (!rpcError && Array.isArray(rpcData)) {
        sameDayAppointments = rpcData as any[];
        loaded = true;
      }
    } catch {
      // cai no método antigo abaixo
    }
    if (!loaded) {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_time, duration, additional_products, status, professional')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', targetDate)
        .neq('status', 'cancelled');
      if (error) return { ok: false, message: 'Não foi possível validar disponibilidade. Tente novamente.' };
      sameDayAppointments = data || [];
    }
  }

  const hasConflict = (sameDayAppointments || []).some((existing: any) => {
    const existingProfessionalNorm = normalizeText(existing?.professional);
    const sameProfessional =
      (targetProfessionalIdNorm.length > 0 && existingProfessionalNorm === targetProfessionalIdNorm) ||
      (targetProfessionalRefNorm.length > 0 && existingProfessionalNorm === targetProfessionalRefNorm) ||
      (targetProfessionalNameNorm.length > 0 && existingProfessionalNorm === targetProfessionalNameNorm);
    if (!sameProfessional) return false;

    const existingStart = toMinutes(normalizeTimeHHmm(existing?.appointment_time));
    const existingDuration = Number(existing?.duration) || 30;
    const existingEnd = existingStart + existingDuration;
    return !(targetEnd <= existingStart || targetStart >= existingEnd);
  });

  if (hasConflict) {
    return { ok: false, message: 'Esse horário acabou de ser ocupado. Escolha outro horário.' };
  }

  return { ok: true };
}

export interface PaymentRequirement {
  precisaPagamento: boolean;
  permitePagamentoOpcional: boolean;
  usarPagarMe: boolean;
  usarMercadoPago: boolean;
  pagarmeRecipientId: string;
  mercadopagoAccessToken: string;
  valorAgendamento: number;
  /** Se true, o estabelecimento repassa a taxa da maquininha ao cliente (+R$1, ver chargeAmount). */
  cobrarTaxaCliente: boolean;
  /** Valor final a cobrar no PaymentModal (já inclui a taxa de R$1 quando cobrarTaxaCliente=true). */
  chargeAmount: number;
}

/**
 * Decide se o pagamento antecipado é obrigatório para este agendamento.
 * Origem: BookingPage.tsx ~2087-2151 — replicado integralmente, incluindo o override
 * por cliente (force_advance_payment), para manter paridade total com a regra de negócio.
 */
export async function resolvePaymentRequirement(params: {
  establishment: any;
  servicePrice: number;
  clientPhone: string;
}): Promise<PaymentRequirement> {
  const { establishment, servicePrice, clientPhone } = params;

  const exigirPagamentoAntecipado = establishment?.exigir_pagamento_antecipado === true;
  const exigirPagamentoAntecipadoMercadoPago = establishment?.exigir_pagamento_antecipado_mercadopago === true;
  const pagamentoAdiantadoOpcional = establishment?.pagamento_adiantado_opcional === true;
  const pagamentoAdiantadoOpcionalMercadoPago = establishment?.pagamento_adiantado_opcional_mercadopago === true;
  const pagarmeRecipientId = String(establishment?.pagarme_recipient_id || '').trim();

  const advancePercent = establishment?.advance_payment_percentage === 50 ? 50 : 100;
  const valorAgendamentoFull = resolveBookingPaymentAmount({ price: servicePrice });
  const valorAgendamento = advancePercent === 50 ? Math.round(valorAgendamentoFull * 0.5) : valorAgendamentoFull;

  const hasPagarMe = !!pagarmeRecipientId;
  const hasMercadoPago = establishmentHasMercadoPago(establishment);

  const usarMercadoPago = hasMercadoPago && exigirPagamentoAntecipadoMercadoPago;
  const usarPagarMe = !usarMercadoPago && hasPagarMe && exigirPagamentoAntecipado;

  const pagamentoAdiantadoAtivo = (usarPagarMe || usarMercadoPago) && valorAgendamento > 0;

  let forceAdvancePaymentForClient = false;
  const phoneCandidates = buildPhoneCandidates(clientPhone);
  if (pagamentoAdiantadoAtivo && usarMercadoPago && pagamentoAdiantadoOpcionalMercadoPago && phoneCandidates.length > 0) {
    try {
      const { data } = await supabase
        .from('manual_clients')
        .select('id')
        .eq('establishment_id', establishment.id)
        .in('whatsapp', phoneCandidates as any)
        .eq('force_advance_payment', true)
        .limit(1)
        .maybeSingle();
      forceAdvancePaymentForClient = Boolean((data as any)?.id);
    } catch {
      // Coluna pode não existir em bancos antigos — segue como não-forçado.
    }
  }

  const pagamentoOpcionalNoGatewayAtual = usarPagarMe ? pagamentoAdiantadoOpcional : pagamentoAdiantadoOpcionalMercadoPago;
  const forceMandatoryInOptionalMode = pagamentoAdiantadoAtivo && pagamentoOpcionalNoGatewayAtual && forceAdvancePaymentForClient;
  const precisaPagamento = (pagamentoAdiantadoAtivo && !pagamentoOpcionalNoGatewayAtual) || forceMandatoryInOptionalMode;
  const permitePagamentoOpcional = pagamentoAdiantadoAtivo && pagamentoOpcionalNoGatewayAtual && !forceMandatoryInOptionalMode;

  const cobrarTaxaCliente = establishment?.cobrar_taxa_maquininha_cliente === true;
  const chargeAmount = cobrarTaxaCliente && valorAgendamento > 0 ? valorAgendamento + 1 : valorAgendamento;

  return {
    precisaPagamento,
    permitePagamentoOpcional,
    usarPagarMe,
    usarMercadoPago,
    pagarmeRecipientId,
    mercadopagoAccessToken,
    valorAgendamento,
    cobrarTaxaCliente,
    chargeAmount,
  };
}

export interface BookingPayloadInput {
  clientId: string;
  establishmentId: string;
  establishmentCode: string;
  appointmentDate: string;
  appointmentTime: string;
  professionalId: string;
  professionalName: string;
  serviceName: string;
  price: number;
  duration: number;
  clientName: string;
  clientWhatsapp: string;
}

/**
 * Origem: BookingPage.tsx ~2530-2537 (caminho sem pagamento obrigatório).
 * Nota: a coluna real é `professional` (guarda o id do profissional) — não existe
 * coluna `professional_name` na tabela `appointments` (confirmado em produção).
 */
export function buildNormalPayload(input: BookingPayloadInput) {
  return {
    client_id: input.clientId,
    establishment_id: input.establishmentId,
    establishment_code: input.establishmentCode,
    appointment_date: input.appointmentDate,
    appointment_time: input.appointmentTime,
    professional: input.professionalId,
    service: input.serviceName,
    price: input.price,
    total_price: input.price,
    duration: input.duration,
    client_name: input.clientName,
    client_whatsapp: input.clientWhatsapp,
    payment_method: 'pagar_local',
    status: 'pending',
    booking_source: 'af',
  };
}

/** Origem: BookingPage.tsx ~2400-2409 (caminho com pagamento obrigatório). */
export function buildPendingPaymentPayload(input: BookingPayloadInput) {
  return {
    ...buildNormalPayload(input),
    payment_method: 'pendente',
    payment_status: 'pending',
    status: 'pending_payment',
  };
}

/** Origem: BookingChatFlow.tsx ~161-179 (converte business_hours da semana para o dia selecionado). */
export function buildBusinessHoursForDate(establishment: any, selectedDate: Date) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = days[selectedDate.getDay()];
  const raw = establishment?.business_hours?.[dayKey];
  if (!raw) return { enabled: false, open1: '', close1: '', open2: null, close2: null };
  const formatTime = (time: string | null | undefined) => {
    if (!time) return '';
    const [h, m] = String(time).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return {
    enabled: Boolean(raw?.enabled),
    open1: formatTime(raw?.open1 ?? raw?.open),
    close1: formatTime(raw?.close1 ?? raw?.close),
    open2: raw?.open2 ? formatTime(raw?.open2) : null,
    close2: raw?.close2 ? formatTime(raw?.close2) : null,
  };
}

/** Origem: BookingChatFlow.tsx ~181-187. */
export function getMinimumAdvanceMinutes(establishment: any): number {
  const rawMinutes = Number(establishment?.booking_min_advance_minutes ?? 0);
  if (Number.isFinite(rawMinutes) && rawMinutes > 0) return Math.max(0, Math.floor(rawMinutes));
  const rawHours = Number(establishment?.booking_min_advance_hours ?? 0);
  if (!Number.isFinite(rawHours) || rawHours <= 0) return 0;
  return Math.max(0, Math.floor(rawHours * 60));
}

/** Origem: BookingPage.tsx ~1319-1334 (busca de agendamentos do dia para a grade de horários). */
export async function loadExistingAppointmentsForDate(establishmentId: string, dateStr: string): Promise<any[]> {
  // Caminho seguro: função que devolve só a disponibilidade (sem nome/telefone/CPF).
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_day_availability', {
      p_establishment_id: establishmentId,
      p_date: dateStr,
    });
    if (!rpcError && Array.isArray(rpcData)) return rpcData as any[];
  } catch {
    // cai no método antigo abaixo
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id,appointment_date,appointment_time,duration,additional_products,status,professional')
    .eq('establishment_id', establishmentId)
    .eq('appointment_date', dateStr)
    .neq('status', 'cancelled');
  if (error) {
    console.warn('⚠️ bookingSimpleEngine: falha ao carregar agendamentos do dia:', error);
    return [];
  }
  return data || [];
}

/** Origem: BookingPage.tsx ~1830-1875 (login/criação de cliente convidado + validação de sessão). */
export async function ensureGuestSession(name: string, phone: string): Promise<{ userId: string | null; error: string | null }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) return { userId: authData.user.id, error: null };
  } catch {
    // Segue para criar/logar como convidado.
  }

  const { user, error } = await createGuestClientAndLogin(name, phone);
  if (error || !user) {
    return { userId: null, error: error?.message || 'Não foi possível identificar o cliente. Tente novamente.' };
  }
  return { userId: user.id, error: null };
}

/** Origem: BookingPage.tsx ~1881-1888 — evita travar para sempre em chamadas do Supabase. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)),
  ]);
}

// ============================================================================
// ASSINANTES — agendamento como assinante na página simples.
// Origem (sincronizado em 2026-07-16):
// - resolveSubscriberByPhone: BookingChatFlow.tsx ~979-1016 (resolveSubscriberAfterPhone)
// - loadSubscriberPlanOptions: BookingChatFlow.tsx ~426-477 (subscriberServiceOptions) +
//   BookingPage.tsx ~274-279 (filtro pelo plano do assinante detectado)
// - buildSubscriberPayload: BookingChatFlow.tsx ~1453-1501 — apenas os campos que são
//   colunas reais em produção (is_subscriber, subscription_id, payment_method 'assinante',
//   price 0). Os campos subscriber_service_* do chat são usados só em memória para a
//   validação e removidos antes do insert (ver BookingPage.tsx ~1896-1903).
// ============================================================================

export interface SimpleSubscriberOption {
  /** planId (plano único) ou planId::serviceId (plano com serviços divididos). */
  id: string;
  subscription_id: string | null;
  service_id: string | null;
  service_limit: number | null;
  name: string;
  duration: number;
  plan_name: string;
  /** Dias da semana permitidos pelo plano (vazio = todos). */
  weekdays: string[];
  divide_services_enabled: boolean;
}

/** Detecta assinante pelo telefone (sistema novo com fallback legado). */
export async function resolveSubscriberByPhone(
  establishmentId: string,
  phoneRaw: string
): Promise<{ status: 'active' | 'expired' | 'none'; data: any }> {
  const estId = String(establishmentId || '').trim();
  if (!estId || !String(phoneRaw || '').trim()) return { status: 'none', data: null };

  const isSubscriberRecordExpired = (record: any): boolean => {
    if (Boolean(record?.is_expired)) return true;
    const paymentStatus = String(record?.payment_status || '').toLowerCase().trim();
    if (paymentStatus === 'unpaid') return true;
    const endDateStr = String(record?.end_date || '').slice(0, 10);
    if (!endDateStr) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(`${endDateStr}T00:00:00`);
    return Number.isNaN(endDate.getTime()) || endDate.getTime() < today.getTime();
  };

  // A detecção pode vir de RPC antiga que não retorna a coluna nova
  // subscriber_professional_ids (lista) — complementa com um fetch direto da linha.
  const enrichWithProfessionalIds = async (record: any): Promise<any> => {
    const recordId = String(record?.id || '').trim();
    if (!recordId || Array.isArray(record?.subscriber_professional_ids)) return record;
    try {
      const { data } = await supabase
        .from('client_subscriptions')
        .select('subscriber_professional_ids')
        .eq('id', recordId)
        .maybeSingle();
      if (Array.isArray((data as any)?.subscriber_professional_ids)) {
        return { ...record, subscriber_professional_ids: (data as any).subscriber_professional_ids };
      }
    } catch {
      // Coluna pode não existir ainda — segue com o registro original.
    }
    return record;
  };

  try {
    const { data, error } = await checkNewSubscriber(phoneRaw, estId);
    if (data && !error) {
      return isSubscriberRecordExpired(data)
        ? { status: 'expired', data }
        : { status: 'active', data: await enrichWithProfessionalIds(data) };
    }
  } catch {
    // Segue para o fallback legado.
  }
  try {
    const { data, error } = await checkLegacySubscriber(phoneRaw, estId);
    if (data && !error) {
      return isSubscriberRecordExpired(data)
        ? { status: 'expired', data }
        : { status: 'active', data: await enrichWithProfessionalIds(data) };
    }
  } catch {
    // Segue como não-assinante.
  }
  return { status: 'none', data: null };
}

/** Carrega os serviços do plano do assinante (expande divided_services quando habilitado). */
export async function loadSubscriberPlanOptions(
  establishmentId: string,
  detectedSubscriber: any
): Promise<SimpleSubscriberOption[]> {
  const { data: subscriptionsData, error } = await getSubscriptions(establishmentId);
  if (error || !Array.isArray(subscriptionsData)) return [];

  const detectedPlanId = String(
    detectedSubscriber?.subscription_id || detectedSubscriber?.subscriptions?.id || ''
  ).trim();
  const plans = detectedPlanId
    ? subscriptionsData.filter((plan: any) => String(plan?.id || '').trim() === detectedPlanId)
    : subscriptionsData;

  const expanded = plans.flatMap((plan: any): SimpleSubscriberOption[] => {
    const planId = String(plan?.id || '').trim();
    const planName = String(plan?.name || '').trim();
    const weekdays = Array.isArray(plan?.weekdays)
      ? plan.weekdays.map((day: any) => String(day || '').toLowerCase().trim()).filter(Boolean)
      : [];
    const dividedEnabled = Boolean(plan?.divide_services_enabled);
    const divided = Array.isArray(plan?.divided_services) ? plan.divided_services : [];

    if (!dividedEnabled || divided.length === 0) {
      return [{
        id: planId || 'subscription',
        subscription_id: planId || null,
        service_id: String(plan?.service_id || '').trim() || null,
        service_limit: Number(plan?.service_limit || 0) || null,
        name: String(plan?.booking_service_name || plan?.name || '').trim() || 'Serviço da assinatura',
        duration: Number(plan?.service_duration || plan?.duration || 30) || 30,
        plan_name: planName,
        weekdays,
        divide_services_enabled: false,
      }];
    }

    return divided
      .map((entry: any, index: number): SimpleSubscriberOption | null => {
        const entryId = String(entry?.id || '').trim();
        const entryName = String(entry?.name || '').trim();
        const entryDuration = Number(entry?.duration || 0);
        const entryLimit = Number(entry?.limit || 0);
        if (!entryName || !Number.isFinite(entryDuration) || entryDuration <= 0) return null;
        return {
          id: `${planId || 'subscription'}::${entryId || `service-${index}`}`,
          subscription_id: planId || null,
          service_id: entryId || null,
          service_limit: Number.isFinite(entryLimit) && entryLimit > 0 ? entryLimit : null,
          name: entryName,
          duration: entryDuration,
          plan_name: planName,
          weekdays,
          divide_services_enabled: true,
        };
      })
      .filter((option): option is SimpleSubscriberOption => option !== null);
  });

  return expanded;
}

/**
 * Plano bruto da assinatura do cliente (para renovação de assinatura vencida).
 * Origem: BookingPage.tsx ~563-576 (handleOpenRenewSubscription).
 */
export async function loadSubscriptionPlanForRenewal(
  establishmentId: string,
  subscriberRecord: any
): Promise<any | null> {
  const { data, error } = await getSubscriptions(establishmentId);
  if (error || !Array.isArray(data)) return null;
  const planId = String(
    subscriberRecord?.subscription_id || subscriberRecord?.subscriptions?.id || ''
  ).trim();
  if (!planId) return null;
  return data.find((plan: any) => String(plan?.id || '').trim() === planId) || null;
}

/** Payload do agendamento como assinante (sem cobrança — o plano cobre o serviço). */
export function buildSubscriberPayload(input: BookingPayloadInput, subscriptionId: string | null) {
  return {
    ...buildNormalPayload(input),
    price: 0,
    total_price: 0,
    payment_method: 'assinante',
    is_subscriber: true,
    subscription_id: subscriptionId,
  };
}

export { format, getScheduleIntervalMinutes, supabase };
