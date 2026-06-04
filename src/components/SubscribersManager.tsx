import { addMonths, endOfMonth, format, isPast, parse, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Edit, Eye, EyeOff, History, Plus, Trash2, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createIndependentSubscriber,
  getEstablishmentSubscribers,
  removeSubscriber
} from '../lib/subscriberSystem';
import { createSubscription, deleteSubscription, getClientSubscriptions, getSubscriptions, supabase } from '../lib/supabase'; // Adicionar esta importação
import { Database } from '../types/supabase';
import { openWhatsAppWithBusinessPriority } from '../utils/whatsapp';
import {
  buildCarryoverMonthlyLimit,
  clampDateRangeToSubscription,
  getCalendarMonthDateRange,
  getPreviousCalendarMonthDateRange,
  isIsoDateWithinRange,
} from '../utils/subscriptionUsagePeriod';
import { ClientRecoveryModal } from './ClientRecoveryModal';
import { useToast } from './ui/Toaster';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type ClientSubscription = Database['public']['Tables']['client_subscriptions']['Row'] & {
  subscriptions: Subscription;
  profiles: { full_name: string; is_subscriber: boolean };
};
type Profile = Database['public']['Tables']['profiles']['Row'];

interface Client {
  id: string;
  whatsapp: string;
  name: string;
  appointmentCount: number;
  isSubscriber: boolean;
}

interface KnownClientSuggestion {
  name: string;
  nameKey: string;
  phone: string;
  phoneDigits: string;
  email: string;
}

type DividedSubscriptionService = {
  id: string;
  name: string;
  duration: number;
  limit: number;
};

type SubscriptionValueChangeHistoryEntry = {
  id: string;
  changed_at: string;
  old_value: number;
  new_value: number;
  discount_amount: number;
  changed_by?: string | null;
  note?: string | null;
};

/** Filtro do modal de atendimentos: período da assinatura ou mês civil (badges no card) */
type AttendanceViewerFilter = { kind: 'period' } | { kind: 'month'; ym: string };

interface SubscribersManagerProps {
  establishmentId: string;
  clients: Client[]; // Usar Client ao invés de Profile
  onClientUpdated?: () => void; // Nova prop para notificar atualizações
  establishment?: {
    code?: string;
    limit_subscriber_bookings?: boolean;
    prevent_same_day_reschedule?: boolean;
    limit_subscribers_one_week?: boolean;
    use_pagarme_subscription_pix?: boolean;
    pagarme_recipient_id?: string | null;
    use_mercadopago_subscription_pix?: boolean;
    mercadopago_access_token?: string | null;
    show_subscriptions_fullpage?: boolean;
    payment_methods_enabled?: string[] | null;
    credit_card_tax_percentage?: number | null;
    debit_card_tax_percentage?: number | null;
  };
  onEstablishmentUpdate?: () => void;
}

type EstablishmentProfessional = {
  id: string;
  full_name: string;
  percentage: number;
};

type SubscriptionPlanAuditLogRow = Database['public']['Tables']['subscription_plan_audit_logs']['Row'];

const SUBSCRIPTION_PLAN_AUDIT_LABELS: Record<string, string> = {
  name: 'Nome do plano',
  value: 'Preço',
  description: 'Descrição',
  weekdays: 'Dias da semana',
  service_duration: 'Duração legado (min)',
  divided_services: 'Serviços oferecidos (lista)',
  divide_services_enabled: 'Serviços divididos ativos',
  divide_total_enabled: 'Dividir valor total',
  divide_total_attendances: 'Qtd. atendimentos (dividir total)',
  fixed_commission_value: 'Repasse fixo (R$)',
  duration_months: 'Duração (meses)',
  sort_order: 'Ordem na lista',
  custom_link: 'Link personalizado',
  credit_card_link: 'Link cartão',
  is_hidden: 'Oculta no booking',
  label_color: 'Cor da etiqueta',
  payment_pix_enabled: 'PIX ativo',
  payment_card_enabled: 'Cartão ativo',
  monthly_service_limit: 'Limite mensal (legado)',
  establishment_id: 'Estabelecimento',
};

const stableStringify = (v: unknown): string => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const auditNormKey = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const WEEKDAY_AUDIT_PT: Record<string, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const formatAuditMoney = (raw: unknown): string => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw ?? '');
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

const formatAuditWeekdays = (raw: unknown): string => {
  if (!Array.isArray(raw)) return String(raw ?? '');
  return (raw as string[])
    .map((d) => WEEKDAY_AUDIT_PT[String(d || '').toLowerCase()] || String(d))
    .join(', ');
};

const parseUnknownJsonArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

type AuditSvc = { id: string; name: string; duration: number; limit: number };

const normalizeAuditSvc = (x: unknown): AuditSvc => {
  const o = x as Record<string, unknown>;
  return {
    id: String(o?.id || '').trim(),
    name: String(o?.name || 'Serviço sem nome').trim() || 'Serviço sem nome',
    duration: Math.round(Number(o?.duration) || 0),
    limit: Math.round(Number(o?.limit) || 0),
  };
};

/** Explica mudanças na lista divided_services em frases curtas (ex.: duração 30 → 45 min). */
const diffDividedServicesHuman = (oldRaw: unknown, newRaw: unknown): string[] => {
  const oldArr = parseUnknownJsonArray(oldRaw).map(normalizeAuditSvc);
  const newArr = parseUnknownJsonArray(newRaw).map(normalizeAuditSvc);
  if (stableStringify(oldRaw) === stableStringify(newRaw)) return [];

  const consumedOldIdx = new Set<number>();
  const lines: string[] = [];

  const findOldIndexForNew = (ns: AuditSvc): number => {
    if (ns.id) {
      const byId = oldArr.findIndex((o, idx) => !consumedOldIdx.has(idx) && o.id && o.id === ns.id);
      if (byId >= 0) return byId;
    }
    const nk = auditNormKey(ns.name);
    const byName = oldArr.findIndex((o, idx) => !consumedOldIdx.has(idx) && auditNormKey(o.name) === nk);
    if (byName >= 0) return byName;
    if (oldArr.length === 1 && newArr.length === 1) return 0;
    return -1;
  };

  for (const ns of newArr) {
    const oi = findOldIndexForNew(ns);
    if (oi >= 0) {
      consumedOldIdx.add(oi);
      const os = oldArr[oi];
      const label = `«${ns.name}»`;
      if (os.duration !== ns.duration) {
        lines.push(`No serviço ${label}: tempo de atendimento alterado de ${os.duration} min para ${ns.duration} min.`);
      }
      if (os.limit !== ns.limit) {
        lines.push(`No serviço ${label}: limite de usos alterado de ${os.limit} para ${ns.limit}.`);
      }
      if (auditNormKey(os.name) !== auditNormKey(ns.name)) {
        lines.push(`Serviço renomeado: «${os.name}» passou a se chamar «${ns.name}».`);
      }
    } else {
      lines.push(`Foi incluído o serviço «${ns.name}» (${ns.duration} min de duração, limite ${ns.limit}).`);
    }
  }

  for (let i = 0; i < oldArr.length; i++) {
    if (!consumedOldIdx.has(i)) {
      const os = oldArr[i];
      lines.push(`Foi removido o serviço «${os.name}» (era ${os.duration} min, limite ${os.limit}).`);
    }
  }

  if (lines.length === 0) {
    lines.push('A lista de serviços do plano mudou (veja detalhe técnico no JSON abaixo, se precisar).');
  }
  return lines;
};

const describeScalarPlanFieldChange = (key: string, oldV: unknown, newV: unknown): string | null => {
  switch (key) {
    case 'name':
      return `Nome do plano: «${oldV}» → «${newV}».`;
    case 'value':
      return `Valor cobrado no plano: ${formatAuditMoney(oldV)} → ${formatAuditMoney(newV)}.`;
    case 'description': {
      const a = String(oldV ?? '').trim();
      const b = String(newV ?? '').trim();
      if (!a && b) return 'Foi adicionada uma descrição ao plano.';
      if (a && !b) return 'A descrição do plano foi removida.';
      return 'A descrição do plano foi alterada.';
    }
    case 'weekdays':
      return `Dias em que o plano vale: ${formatAuditWeekdays(oldV)} → ${formatAuditWeekdays(newV)}.`;
    case 'service_duration':
      return `Duração geral (campo legado, se existir): ${oldV} min → ${newV} min.`;
    case 'sort_order':
      return `Ordem do plano na lista: posição ${oldV} → ${newV}.`;
    case 'is_hidden':
      return `Visibilidade no booking para novos clientes: ${oldV ? 'oculto' : 'visível'} → ${newV ? 'oculto' : 'visível'}.`;
    case 'payment_pix_enabled':
      return `PIX neste plano: ${oldV ? 'ativo' : 'desativado'} → ${newV ? 'ativo' : 'desativado'}.`;
    case 'payment_card_enabled':
      return `Cartão neste plano: ${oldV ? 'ativo' : 'desativado'} → ${newV ? 'ativo' : 'desativado'}.`;
    case 'divide_total_enabled':
      return `Opção “dividir valor total”: ${oldV ? 'ligada' : 'desligada'} → ${newV ? 'ligada' : 'desligada'}.`;
    case 'divide_total_attendances':
      return `Quantidade de atendimentos para dividir o valor: ${oldV} → ${newV}.`;
    case 'divide_services_enabled':
      return `Uso da lista de serviços no plano: ${oldV ? 'sim' : 'não'} → ${newV ? 'sim' : 'não'}.`;
    case 'fixed_commission_value':
      return `Repasse fixo por atendimento (R$): ${formatAuditMoney(oldV)} → ${formatAuditMoney(newV)}.`;
    case 'label_color':
      return `Cor da etiqueta do plano foi alterada.`;
    case 'duration_months':
      return `Duração em meses (campo do sistema): ${oldV} → ${newV}.`;
    case 'custom_link':
      return `Link personalizado do plano foi alterado.`;
    case 'credit_card_link':
      return `Link de pagamento no cartão foi alterado.`;
    case 'monthly_service_limit':
      return `Limite mensal (legado): ${oldV ?? '—'} → ${newV ?? '—'}.`;
    default:
      return `Campo “${SUBSCRIPTION_PLAN_AUDIT_LABELS[key] || key}” foi alterado.`;
  }
};

const formatPlanAuditActorLine = (actorUserId: string | null): string => {
  if (!actorUserId) {
    return 'Quem alterou: não identificado (alteração via SQL no painel, migration ou processo automático).';
  }
  const id = String(actorUserId);
  const short = id.length > 24 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
  return `Quem alterou: sessão logada no painel (usuário ${short}). Se só você acessa essa conta, foi você neste horário.`;
};

const buildFriendlySubscriptionPlanAuditLines = (row: SubscriptionPlanAuditLogRow): string[] => {
  const op = String(row.operation || '').toUpperCase();
  if (op === 'INSERT') {
    const r = (row.new_row || {}) as Record<string, unknown>;
    const lines: string[] = ['Novo plano cadastrado.'];
    if (r.name != null) lines.push(`Nome: «${r.name}».`);
    if (r.value != null) lines.push(`Valor: ${formatAuditMoney(r.value)}.`);
    if (r.weekdays != null) lines.push(`Dias da semana: ${formatAuditWeekdays(r.weekdays)}.`);
    const svcs = parseUnknownJsonArray(r.divided_services).map(normalizeAuditSvc);
    if (svcs.length > 0) {
      lines.push(
        'Serviços incluídos no plano:',
        ...svcs.map((s) => `• «${s.name}»: ${s.duration} min, limite ${s.limit}.`)
      );
    }
    return lines;
  }
  if (op === 'DELETE') {
    return ['Este plano foi excluído: some da lista e deixa de ser ofertado (assinantes antigos podem ficar sem vínculo ao plano, conforme regra do sistema).'];
  }

  const oldR = (row.old_row || null) as Record<string, unknown> | null;
  const newR = (row.new_row || null) as Record<string, unknown> | null;
  if (!oldR || !newR) return ['Alteração registrada (sem detalhe legível além do JSON).'];

  const lines: string[] = [];
  const skipKeys = new Set(['id', 'created_at', 'establishment_id']);

  if (stableStringify(oldR.divided_services) !== stableStringify(newR.divided_services)) {
    lines.push(...diffDividedServicesHuman(oldR.divided_services, newR.divided_services));
  }

  const keys = new Set([...Object.keys(oldR), ...Object.keys(newR)]);
  keys.forEach((k) => {
    if (skipKeys.has(k) || k === 'divided_services') return;
    if (stableStringify(oldR[k]) === stableStringify(newR[k])) return;
    const line = describeScalarPlanFieldChange(k, oldR[k], newR[k]);
    if (line) lines.push(line);
  });

  if (lines.length === 0) {
    return ['Alteração salva. Abra “Detalhe técnico” abaixo se precisar ver o registro bruto.'];
  }
  return lines;
};

const formatSupabaseLikeError = (e: any): string => {
  const msg = String(e?.message || e?.error_description || '').trim();
  const code = e?.code ? `Código: ${e.code}` : '';
  const details = e?.details ? `Detalhes: ${e.details}` : '';
  const hint = e?.hint ? `Dica: ${e.hint}` : '';
  return [msg, code, details, hint].filter(Boolean).join(' · ') || 'Erro desconhecido ao carregar histórico.';
};

export const SubscribersManager: React.FC<SubscribersManagerProps> = ({ establishmentId, clients, onClientUpdated, establishment, onEstablishmentUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const subscriptionLabelPalette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#9ca3af'];

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [clientSubscriptions, setClientSubscriptions] = useState<ClientSubscription[]>([]);
  // const [clients, setClients] = useState<Profile[]>([]); // REMOVIDO: Agora vem via prop


  const [newSubscriptionName, setNewSubscriptionName] = useState('');
  const [newSubscriptionValue, setNewSubscriptionValue] = useState<number>(0);
  const [newPercentualComissaoDiaria, setNewPercentualComissaoDiaria] = useState<number>(0);
  const [newSubscriptionDuration, setNewSubscriptionDuration] = useState<number>(30); // Duração em minutos
  const [newSubscriptionWeekdays, setNewSubscriptionWeekdays] = useState<string[]>([]);
  const [newSubscriptionDescription, setNewSubscriptionDescription] = useState(''); // Nova descrição
  const [newDivideTotalEnabled, setNewDivideTotalEnabled] = useState(false);
  const [newDivideTotalAttendances, setNewDivideTotalAttendances] = useState<string>(''); // Ex: 4
  const [newDivideServicesEnabled, setNewDivideServicesEnabled] = useState(true);
  const [newDividedServices, setNewDividedServices] = useState<DividedSubscriptionService[]>([
    {
      id: `svc_default_${Date.now()}`,
      name: '',
      duration: 30,
      limit: 1,
    },
  ]);
  const [newSubscriptionLabelColor, setNewSubscriptionLabelColor] = useState<string>('');

  const [selectedSubscriptionToAdd, setSelectedSubscriptionToAdd] = useState<string>('');
  const [selectedClientToAdd, setSelectedClientToAdd] = useState<string>('');

  // Novos campos para adicionar assinante
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newSubscriberPaymentMethod, setNewSubscriberPaymentMethod] = useState('');
  const [newSubscriberProfessionalId, setNewSubscriberProfessionalId] = useState('');
  const [newSubscriberObservation, setNewSubscriberObservation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showEmContaBreakdown, setShowEmContaBreakdown] = useState(false);
  const [showLiquidoAtivoBreakdown, setShowLiquidoAtivoBreakdown] = useState(false);
  const [showTotalAtivosBreakdown, setShowTotalAtivosBreakdown] = useState(false);
  const [showNaoPagosBreakdown, setShowNaoPagosBreakdown] = useState(false);

  const normalizeNameKey = (value: string): string =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const normalizePhoneDigits = (value: string): string => {
    const digits = String(value || '').replace(/\D/g, '');
    // Padrao interno: DDD + numero (sem 55), para evitar duplicidade 55/sem55.
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return digits.slice(2);
    }
    return digits;
  };
  const getProfessionalNameById = (professionalId: string): string => {
    const targetId = String(professionalId || '').trim();
    if (!targetId) return '';
    const professional = (professionals || []).find((item) => String(item?.id || '').trim() === targetId);
    return String(professional?.full_name || '').trim();
  };

  const toTime = (value: unknown): number => {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const timestamp = new Date(raw).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const deduplicateSubscriberRows = (rows: ClientSubscription[]): ClientSubscription[] => {
    const byKey = new Map<string, ClientSubscription>();

    for (const row of rows || []) {
      const current = row as any;
      const phone = normalizePhoneDigits(String(current?.subscriber_whatsapp || current?.client_whatsapp || ''));
      const nameKey = normalizeNameKey(String(current?.subscriber_name || current?.profiles?.full_name || ''));
      const key = phone || (nameKey ? `name:${nameKey}` : `id:${String(current?.id || '')}`);

      const previous = byKey.get(key);
      if (!previous) {
        byKey.set(key, row);
        continue;
      }

      const prevAny = previous as any;
      const curAny = current;

      const prevEnd = toTime(prevAny?.end_date);
      const curEnd = toTime(curAny?.end_date);
      if (curEnd !== prevEnd) {
        if (curEnd > prevEnd) byKey.set(key, row);
        continue;
      }

      const prevPaid = String(prevAny?.payment_status || '').toLowerCase() === 'paid' ? 1 : 0;
      const curPaid = String(curAny?.payment_status || '').toLowerCase() === 'paid' ? 1 : 0;
      if (curPaid !== prevPaid) {
        if (curPaid > prevPaid) byKey.set(key, row);
        continue;
      }

      const prevUpdated = toTime(prevAny?.updated_at) || toTime(prevAny?.created_at);
      const curUpdated = toTime(curAny?.updated_at) || toTime(curAny?.created_at);
      if (curUpdated > prevUpdated) {
        byKey.set(key, row);
      }
    }

    return Array.from(byKey.values());
  };

  const normalizeProfessionalPercentage = (raw: unknown): number => {
    const normalizedRaw = String(raw ?? '').trim().replace('%', '').replace(',', '.');
    const parsed = Number(normalizedRaw);
    if (!Number.isFinite(parsed)) return 0;
    if (parsed < 0) return 0;
    if (parsed > 100) {
      const legacyScaled = parsed / 10;
      if (legacyScaled <= 100) return legacyScaled;
      return 100;
    }
    return parsed;
  };

  const knownClients = useMemo<KnownClientSuggestion[]>(() => {
    const byNameAndPhone = new Map<string, KnownClientSuggestion>();

    const upsert = (rawName: unknown, rawPhone: unknown, rawEmail?: unknown) => {
      const name = String(rawName || '').trim();
      const phone = String(rawPhone || '').trim();
      const email = String(rawEmail || '').trim();
      const nameKey = normalizeNameKey(name);
      const phoneDigits = normalizePhoneDigits(phone);
      if (!nameKey && !phoneDigits) return;

      const key = `${nameKey}__${phoneDigits}`;
      const current = byNameAndPhone.get(key);
      if (!current) {
        byNameAndPhone.set(key, {
          name: name || 'Cliente',
          nameKey,
          phone,
          phoneDigits,
          email,
        });
        return;
      }

      if (!current.phone && phone) current.phone = phone;
      if (!current.phoneDigits && phoneDigits) current.phoneDigits = phoneDigits;
      if (!current.email && email) current.email = email;
      if ((!current.name || current.name === 'Cliente') && name) {
        current.name = name;
        current.nameKey = nameKey;
      }
    };

    for (const client of clients || []) {
      upsert(client?.name, client?.whatsapp);
    }

    for (const cs of clientSubscriptions || []) {
      const row = cs as any;
      upsert(row?.profiles?.full_name || row?.client_name, row?.client_whatsapp || row?.subscriber_whatsapp, row?.profiles?.email || row?.subscriber_email);
    }

    return Array.from(byNameAndPhone.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [clients, clientSubscriptions]);

  const knownClientLookupItems = useMemo(() => {
    return (knownClients || []).map((client) => {
      const phoneLabel = client.phone?.trim() ? ` • ${client.phone.trim()}` : '';
      const emailLabel = client.email?.trim() ? ` • ${client.email.trim()}` : '';
      // Inclui telefone/e-mail na chave para reduzir chance de colisão entre nomes iguais
      const value = `${client.name.trim() || 'Cliente'}${phoneLabel}${emailLabel}`;
      return { value, client };
    });
  }, [knownClients]);

  const availablePaymentMethods = useMemo(() => {
    const defaultMethods = ['pix', 'credito', 'debito', 'dinheiro', 'pagar_local'];
    const enabled = Array.isArray(establishment?.payment_methods_enabled)
      ? (establishment?.payment_methods_enabled || []).map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
      : [];

    const merged = Array.from(new Set([...defaultMethods, ...enabled]));
    return merged;
  }, [establishment?.payment_methods_enabled]);

  const getPaymentMethodLabel = (method: string): string => {
    const key = String(method || '').trim().toLowerCase();
    if (key === 'pix') return 'PIX';
    if (key === 'credito') return 'Cartão de Crédito';
    if (key === 'debito') return 'Cartão de Débito';
    if (key === 'dinheiro') return 'Dinheiro';
    if (key === 'pagar_local') return 'Pagar no Local';
    return method;
  };

  const getSubscriberWhatsappForLink = (clientSubscription: any): string => {
    const raw = String(
      clientSubscription?.subscriber_whatsapp ||
      clientSubscription?.client_whatsapp ||
      ''
    ).trim();
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  };

  const getSubscriberPlanName = (clientSubscription: any): string => {
    const fromJoined = String(clientSubscription?.subscriptions?.name || '').trim();
    if (fromJoined) return fromJoined;
    const fromList = subscriptions.find((sub: any) => String(sub?.id) === String(clientSubscription?.subscription_id));
    return String(fromList?.name || 'Plano').trim() || 'Plano';
  };

  const getBillingReminderCount = (clientSubscription: any): number => {
    const raw = Number((clientSubscription as any)?.billing_reminder_count ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.floor(raw);
  };

  const incrementBillingReminderCount = async (clientSubscription: ClientSubscription) => {
    const currentCount = getBillingReminderCount(clientSubscription);
    const nextCount = currentCount + 1;
    const nowIso = new Date().toISOString();

    let persistError: any = null;

    try {
      let { error } = await supabase
        .from('client_subscriptions')
        .update({
          billing_reminder_count: nextCount,
          last_billing_reminder_at: nowIso,
          updated_at: nowIso,
        } as any)
        .eq('id', clientSubscription.id);

      const errMsg = String(error?.message || '').toLowerCase();
      if (error && (errMsg.includes('billing_reminder_count') || errMsg.includes('last_billing_reminder_at'))) {
        ({ error } = await supabase
          .from('client_subscriptions')
          .update({ updated_at: nowIso } as any)
          .eq('id', clientSubscription.id));
      }

      if (error) {
        persistError = error;
      }
    } catch (e: any) {
      persistError = e;
    }

    setClientSubscriptions((prev) =>
      prev.map((cs) =>
        String(cs.id) === String(clientSubscription.id)
          ? ({ ...cs, billing_reminder_count: nextCount, last_billing_reminder_at: nowIso } as any)
          : cs
      )
    );

    if (persistError) {
      console.error('Erro ao persistir contador de cobrança:', persistError);
      toast.error(
        [persistError?.message || 'Erro ao salvar contador de cobrança', persistError?.code ? `(código: ${persistError.code})` : null]
          .filter(Boolean)
          .join(' ')
      );
    }
  };

  const parseIsoDateSafe = (rawDate: unknown): Date | null => {
    const value = String(rawDate || '').trim();
    if (!value) return null;
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatIsoDateSafe = (rawDate: unknown, fallback = '--/--/----'): string => {
    const parsed = parseIsoDateSafe(rawDate);
    if (!parsed) return fallback;
    return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
  };

  const isPastIsoDateSafe = (rawDate: unknown): boolean => {
    const parsed = parseIsoDateSafe(rawDate);
    if (!parsed) return false;
    return isPast(parsed);
  };

  const handleSendBillingReminder = (clientSubscription: ClientSubscription) => {
    const whatsappNumber = getSubscriberWhatsappForLink(clientSubscription as any);
    if (!whatsappNumber) {
      toast.error('Esse assinante não possui WhatsApp válido para envio.');
      return;
    }

    const planName = getSubscriberPlanName(clientSubscription as any);
    const endDateRaw = String((clientSubscription as any)?.end_date || '').trim();
    const endDateLabel = endDateRaw ? formatIsoDateSafe(endDateRaw, endDateRaw) : '';

    const bookingCode = String(establishment?.code || '').trim() || String(establishmentId || '').trim();
    const bookingUrl = `https://agendeifacil.com/booking/${bookingCode}`;
    const message =
      `Olá! Passando para lembrar que seu plano (${planName}) venceu em ${endDateLabel}.\n\n` +
      `Para renovar, acesse ${bookingUrl} e vá na sua assinatura, depois clique no botão "Renovar".\n\n` +
      `É simples, rápido e fácil.`;

    openWhatsAppWithBusinessPriority(whatsappNumber, message);
    void incrementBillingReminderCount(clientSubscription);
  };

  const createEmptyDividedService = (): DividedSubscriptionService => ({
    id: `svc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    duration: 30,
    limit: 1,
  });

  const normalizeDividedServices = (services: DividedSubscriptionService[]): DividedSubscriptionService[] => {
    return services
      .map((service) => ({
        id: String(service.id || '').trim() || `svc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: String(service.name || '').trim(),
        duration: Number(service.duration || 0),
        limit: Number(service.limit || 0),
      }))
      .filter((service) => service.name && Number.isFinite(service.duration) && service.duration > 0 && Number.isFinite(service.limit) && service.limit > 0);
  };

  const parseDividedServices = (raw: unknown): DividedSubscriptionService[] => {
    if (!Array.isArray(raw)) return [];
    return normalizeDividedServices(
      raw.map((service: any) => ({
        id: String(service?.id || ''),
        name: String(service?.name || ''),
        duration: Number(service?.duration || 0),
        limit: Number(service?.limit || 0),
      }))
    );
  };

  /**
   * Preenche `service_duration` no banco alinhado a `divided_services`, para RPCs/partes antigas
   * que usam COALESCE(service_duration, 30) não tratarem NULL como “30” por engano.
   * Um serviço: mesma duração; vários: soma dos tempos (pacote).
   */
  const deriveLegacyServiceDurationFromOffered = (
    services: DividedSubscriptionService[],
    previousPlan?: Subscription | null
  ): number => {
    const durs = services.map((s) => Math.round(Number(s.duration) || 0)).filter((n) => n > 0);
    if (durs.length === 1) return durs[0];
    if (durs.length > 1) return durs.reduce((a, b) => a + b, 0);
    const prev = Math.round(Number(previousPlan?.service_duration) || 0);
    if (prev > 0) return prev;
    return 30;
  };

  const tryApplySelectedKnownClient = (lookupValue: string) => {
    const selected = knownClientLookupItems.find((item) => item.value === lookupValue)?.client;
    if (!selected) return false;

    setNewClientName(selected.name || '');
    setNewClientPhone(selected.phone || '');
    setNewClientEmail(selected.email || '');
    return true;
  };

  // Estado para controlar limitação de agendamentos de assinantes
  const [limitSubscriberBookings, setLimitSubscriberBookings] = useState(
    establishment?.limit_subscriber_bookings || false
  );
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  // Estado para controlar limitação de remarcação no mesmo dia
  const [preventSameDayReschedule, setPreventSameDayReschedule] = useState(
    establishment?.prevent_same_day_reschedule || false
  );
  const [isUpdatingSameDayLimit, setIsUpdatingSameDayLimit] = useState(false);

  // Recorrência via Pagar.me (PIX manual, sem cobrança automática)
  const localStoragePagarmeKey = `use_pagarme_subscription_pix_${establishmentId}`;
  const [usePagarmeSubscriptionPix, setUsePagarmeSubscriptionPix] = useState<boolean>(() => {
    if (establishment?.use_pagarme_subscription_pix !== undefined) {
      return Boolean(establishment.use_pagarme_subscription_pix);
    }
    try {
      return localStorage.getItem(localStoragePagarmeKey) === 'true';
    } catch {
      return false;
    }
  });
  const [isUpdatingPagarmeSubscriptionPix, setIsUpdatingPagarmeSubscriptionPix] = useState(false);

  // Recorrência via Mercado Pago (PIX manual, sem cobrança automática)
  const localStorageMercadoPagoKey = `use_mercadopago_subscription_pix_${establishmentId}`;
  const [useMercadoPagoSubscriptionPix, setUseMercadoPagoSubscriptionPix] = useState<boolean>(() => {
    if (establishment?.use_mercadopago_subscription_pix !== undefined) {
      return Boolean(establishment.use_mercadopago_subscription_pix);
    }
    try {
      return localStorage.getItem(localStorageMercadoPagoKey) === 'true';
    } catch {
      return false;
    }
  });
  const [isUpdatingMercadoPagoSubscriptionPix, setIsUpdatingMercadoPagoSubscriptionPix] = useState(false);

  // Mostrar assinaturas no booking por completo (sem precisar clicar em "PLANOS MENSAIS")
  const localStorageShowSubscriptionsFullpageKey = `show_subscriptions_fullpage_${establishmentId}`;
  const [showSubscriptionsFullpage, setShowSubscriptionsFullpage] = useState<boolean>(() => {
    if (establishment?.show_subscriptions_fullpage !== undefined) {
      return Boolean(establishment.show_subscriptions_fullpage);
    }
    try {
      return localStorage.getItem(localStorageShowSubscriptionsFullpageKey) === 'true';
    } catch {
      return false;
    }
  });
  const [isUpdatingShowSubscriptionsFullpage, setIsUpdatingShowSubscriptionsFullpage] = useState(false);

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
  const toCents = (v: number) => Math.round((Number(v) || 0) * 100);
  const fromCents = (cents: number) => cents / 100;
  const parseLegacyBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'sim' || normalized === 'yes' || normalized === 'on';
  };

  const divideEnabledByClientSubscriptionId = useMemo(() => {
    const map: Record<string, boolean> = {};
    (clientSubscriptions || []).forEach((cs: any) => {
      const clientSubId = String(cs?.id || '').trim();
      if (!clientSubId) return;
      map[clientSubId] = parseLegacyBoolean((cs as any)?.subscriptions?.divide_total_enabled);
    });
    return map;
  }, [clientSubscriptions]);

  /** Repasse 0% + sem "Dividir valor total": controle por profissional em pontos (não em R$ por atendimento). */
  const resolveSubscriptionConfigForClientSubId = (clientSubId: string): { divide: boolean; fixed: number } | null => {
    const id = String(clientSubId || '').trim();
    if (!id) return null;
    const cs = (clientSubscriptions || []).find((c: any) => String(c?.id) === id);
    if (!cs) return null;
    const nested = (cs as any)?.subscriptions;
    const sub =
      nested && (nested as any).id != null
        ? nested
        : subscriptions.find((s: any) => String(s.id) === String((cs as any).subscription_id));
    if (!sub) return null;
    return {
      divide: parseLegacyBoolean((sub as any).divide_total_enabled),
      fixed: Number((sub as any).fixed_commission_value || 0),
    };
  };

  const isClientSubscriptionPointsMode = (clientSubId: string): boolean => {
    const cfg = resolveSubscriptionConfigForClientSubId(clientSubId);
    if (!cfg) return false;
    return !cfg.divide && !(cfg.fixed > 0);
  };

  const clientNameBySubIdMap = useMemo(() => {
    const m = new Map<string, string>();
    (clientSubscriptions || []).forEach((cs: any) => {
      const id = String(cs?.id || '');
      if (!id) return;
      const name = String(cs?.profiles?.full_name || cs?.client_name || 'Cliente').trim() || 'Cliente';
      m.set(id, name);
    });
    return m;
  }, [clientSubscriptions]);

  const getAttendanceEffectiveRepass = (attendance: any): number => {
    const clientSubId = String(attendance?.client_subscription_id || '').trim();
    // Modo pontos: não soma valor financeiro no controle (mesmo se registro antigo tiver repasse cheio por bug).
    if (clientSubId && isClientSubscriptionPointsMode(clientSubId)) {
      return 0;
    }

    // Compatibilidade: se já existe repasse salvo no atendimento, ele deve prevalecer.
    const storedValue = Number(attendance?.repass_value || 0);
    if (Number.isFinite(storedValue) && storedValue > 0) {
      return storedValue;
    }

    if (clientSubId && divideEnabledByClientSubscriptionId[clientSubId] === false) {
      return 0;
    }
    return Number.isFinite(storedValue) ? storedValue : 0;
  };

  // Estado para controlar limitação de 1 agendamento por semana
  const [limitSubscribersOneWeek, setLimitSubscribersOneWeek] = useState(
    establishment?.limit_subscribers_one_week || false
  );
  const [isUpdatingOneWeekLimit, setIsUpdatingOneWeekLimit] = useState(false);


  // Estados para funcionalidade de Adicionar Atendimento (data e profissional vêm do "Atendimento assinatura" na agenda)
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false);
  const [selectedClientForAttendance, setSelectedClientForAttendance] = useState<ClientSubscription | null>(null);
  const [attendanceValue, setAttendanceValue] = useState<number>(0);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [subscriberAttendances, setSubscriberAttendances] = useState<any[]>([]);
  const [subscriberAttendanceCountsByClientSubId, setSubscriberAttendanceCountsByClientSubId] = useState<Record<string, number>>({});
  const [subscriberEffectiveLimitByClientSubId, setSubscriberEffectiveLimitByClientSubId] = useState<Record<string, number | null>>({});
  // Histórico (ex.: Fev 1) -> counts por mês (YYYY-MM) por assinante
  const [subscriberAttendanceCountsHistoryByClientSubId, setSubscriberAttendanceCountsHistoryByClientSubId] = useState<
    Record<string, Record<string, number>>
  >({});
  const [subscriptionSaleCommissions, setSubscriptionSaleCommissions] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<EstablishmentProfessional[]>([]);
  const [professionalPayments, setProfessionalPayments] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProfessionalForHistory, setSelectedProfessionalForHistory] = useState<string>('');

  const isOwnerProfessionalByName = (professionalNameRaw: string): boolean => {
    const key = normalizeNameKey(professionalNameRaw);
    if (!key) return false;
    const professional = professionals.find((p) => normalizeNameKey(p.full_name) === key);
    if (!professional) return false;
    return normalizeProfessionalPercentage(professional?.percentage) === 100;
  };

  // Estado para controlar o mês/ano selecionado (padrão: mês atual)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const getPaymentDateForSelectedMonth = () => {
    const now = new Date();
    const isCurrentSelectedMonth =
      selectedYear === now.getFullYear() &&
      selectedMonth === now.getMonth();
    if (isCurrentSelectedMonth) {
      return format(now, 'yyyy-MM-dd');
    }
    // Para meses passados/futuros, registra no fechamento do mês selecionado.
    return format(new Date(selectedYear, selectedMonth + 1, 0), 'yyyy-MM-dd');
  };

  // Quando o pagamento é marcado manualmente no card, usar a data real do clique.
  const getPaymentDateForImmediateStatusChange = () => {
    return format(new Date(), 'yyyy-MM-dd');
  };

  const getRenewedEndDateFromPaymentDate = (paymentDateIso: string) => {
    const parsedPaymentDate = parse(paymentDateIso, 'yyyy-MM-dd', new Date());
    const baseDate = Number.isNaN(parsedPaymentDate.getTime()) ? new Date() : parsedPaymentDate;
    const renewedEndDate = new Date(baseDate);
    renewedEndDate.setDate(renewedEndDate.getDate() + 30);
    return format(renewedEndDate, 'yyyy-MM-dd');
  };

  // Comissão por venda de assinatura (não é atendimento) - auto-save
  const [saleCommissionProfessional, setSaleCommissionProfessional] = useState('');
  const [saleCommissionPercent, setSaleCommissionPercent] = useState<string>(''); // input controlado
  const [isSavingSaleCommission, setIsSavingSaleCommission] = useState(false);
  const [saleCommissionLastSavedAt, setSaleCommissionLastSavedAt] = useState<number | null>(null);
  const saleCommissionSaveTimeoutRef = useRef<number | null>(null);

  // Nome do mês em português
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [professionalPaymentHistory, setProfessionalPaymentHistory] = useState<any[]>([]);
  const [reassigningPaymentId, setReassigningPaymentId] = useState<string | null>(null);

  // Estados para modal de visualizar atendimentos
  const [showViewAttendancesModal, setShowViewAttendancesModal] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<ClientSubscription | null>(null);
  const [attendanceViewerFilter, setAttendanceViewerFilter] = useState<AttendanceViewerFilter | null>(null);
  const [attendanceViewerRows, setAttendanceViewerRows] = useState<any[]>([]);
  const [attendanceViewerLoading, setAttendanceViewerLoading] = useState(false);
  const [attendanceViewerError, setAttendanceViewerError] = useState<string | null>(null);

  // Estados para modal de edição de datas
  const [showEditEndDateModal, setShowEditEndDateModal] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<ClientSubscription | null>(null);
  const [newEndDate, setNewEndDate] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [editSubscriberName, setEditSubscriberName] = useState('');
  const [editSubscriberPhone, setEditSubscriberPhone] = useState('');
  const [editSubscriberEmail, setEditSubscriberEmail] = useState('');
  const [editSubscriberSubscriptionId, setEditSubscriberSubscriptionId] = useState('');
  const [editSubscriberPaymentMethod, setEditSubscriberPaymentMethod] = useState('');
  const [editSubscriberProfessionalId, setEditSubscriberProfessionalId] = useState('');
  const [editSubscriberObservation, setEditSubscriberObservation] = useState('');
  const [isSavingEndDate, setIsSavingEndDate] = useState(false);

  // Estados para modal de limite simples
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedClientForLimit, setSelectedClientForLimit] = useState<ClientSubscription | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [showAdjustValueModal, setShowAdjustValueModal] = useState(false);
  const [selectedClientForValueAdjust, setSelectedClientForValueAdjust] = useState<ClientSubscription | null>(null);
  const [adjustedSubscriptionValue, setAdjustedSubscriptionValue] = useState<string>('');
  const [adjustValueNote, setAdjustValueNote] = useState('');
  const [isSavingAdjustedValue, setIsSavingAdjustedValue] = useState(false);

  // Estado para barra de pesquisa
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para edição de descrições
  const [showEditDescriptionModal, setShowEditDescriptionModal] = useState(false);
  const [selectedSubscriptionForEdit, setSelectedSubscriptionForEdit] = useState<Subscription | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editWeekdays, setEditWeekdays] = useState<string[]>([]);
  const [editDuration, setEditDuration] = useState<number>(30);
  const [editSubscriptionValue, setEditSubscriptionValue] = useState<string>(''); // R$
  const [editRepassePercent, setEditRepassePercent] = useState<string>(''); // %
  const [editDivideTotalEnabled, setEditDivideTotalEnabled] = useState(false);
  const [editDivideTotalAttendances, setEditDivideTotalAttendances] = useState<string>(''); // Ex: 4
  const [editDivideServicesEnabled, setEditDivideServicesEnabled] = useState(false);
  const [editDividedServices, setEditDividedServices] = useState<DividedSubscriptionService[]>([]);
  const [editSubscriptionLabelColor, setEditSubscriptionLabelColor] = useState<string>('');

  // Estados para edição de link personalizado
  const [showEditLinkModal, setShowEditLinkModal] = useState(false);
  const [selectedSubscriptionForLinkEdit, setSelectedSubscriptionForLinkEdit] = useState<Subscription | null>(null);
  const [editLink, setEditLink] = useState('');

  // Estados para edição do link de cartão de crédito (fluxo manual)
  const [showEditCreditCardLinkModal, setShowEditCreditCardLinkModal] = useState(false);
  const [selectedSubscriptionForCreditCardLinkEdit, setSelectedSubscriptionForCreditCardLinkEdit] = useState<Subscription | null>(null);
  const [editCreditCardLink, setEditCreditCardLink] = useState('');

  const [showSubscriptionPlanAuditModal, setShowSubscriptionPlanAuditModal] = useState(false);
  const [subscriptionPlanAuditFor, setSubscriptionPlanAuditFor] = useState<Subscription | null>(null);
  const [subscriptionPlanAuditRows, setSubscriptionPlanAuditRows] = useState<SubscriptionPlanAuditLogRow[]>([]);
  const [subscriptionPlanAuditLoading, setSubscriptionPlanAuditLoading] = useState(false);
  const [subscriptionPlanAuditError, setSubscriptionPlanAuditError] = useState<string | null>(null);

  const loadSubscriptionPlanAuditLogs = async (sub: Subscription) => {
    setSubscriptionPlanAuditFor(sub);
    setShowSubscriptionPlanAuditModal(true);
    setSubscriptionPlanAuditLoading(true);
    setSubscriptionPlanAuditError(null);
    setSubscriptionPlanAuditRows([]);
    try {
      const { data, error } = await supabase
        .from('subscription_plan_audit_logs')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('subscription_id', sub.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }
      setSubscriptionPlanAuditRows((data || []) as SubscriptionPlanAuditLogRow[]);
    } catch (e: any) {
      setSubscriptionPlanAuditError(formatSupabaseLikeError(e));
      setSubscriptionPlanAuditRows([]);
    } finally {
      setSubscriptionPlanAuditLoading(false);
    }
  };

  const closeSubscriptionPlanAuditModal = () => {
    setShowSubscriptionPlanAuditModal(false);
    setSubscriptionPlanAuditFor(null);
    setSubscriptionPlanAuditRows([]);
    setSubscriptionPlanAuditError(null);
  };


  // Sincronizar estado quando establishment mudar
  useEffect(() => {
    if (establishment?.limit_subscriber_bookings !== undefined) {
      setLimitSubscriberBookings(establishment.limit_subscriber_bookings);
    }
    if (establishment?.prevent_same_day_reschedule !== undefined) {
      setPreventSameDayReschedule(establishment.prevent_same_day_reschedule);
    }
    if (establishment?.limit_subscribers_one_week !== undefined) {
      setLimitSubscribersOneWeek(establishment.limit_subscribers_one_week);
    }

    // Se não tiver recipient_id, forçar desativar recorrência Pagar.me
    const hasRecipientId = !!String(establishment?.pagarme_recipient_id || '').trim();
    if (!hasRecipientId) {
      setUsePagarmeSubscriptionPix(false);
      try {
        localStorage.removeItem(localStoragePagarmeKey);
      } catch { }
    } else if (establishment?.use_pagarme_subscription_pix !== undefined) {
      setUsePagarmeSubscriptionPix(Boolean(establishment.use_pagarme_subscription_pix));
      try {
        localStorage.setItem(localStoragePagarmeKey, establishment.use_pagarme_subscription_pix ? 'true' : 'false');
      } catch { }
    }

    // Se não tiver access_token, forçar desativar recorrência Mercado Pago
    const hasAccessToken = !!String(establishment?.mercadopago_access_token || '').trim();
    if (!hasAccessToken) {
      setUseMercadoPagoSubscriptionPix(false);
      try {
        localStorage.removeItem(localStorageMercadoPagoKey);
      } catch { }
    } else if (establishment?.use_mercadopago_subscription_pix !== undefined) {
      setUseMercadoPagoSubscriptionPix(Boolean(establishment.use_mercadopago_subscription_pix));
      try {
        localStorage.setItem(localStorageMercadoPagoKey, establishment.use_mercadopago_subscription_pix ? 'true' : 'false');
      } catch { }
    }

    // Mostrar assinaturas no booking por completo
    if (establishment?.show_subscriptions_fullpage !== undefined) {
      setShowSubscriptionsFullpage(Boolean(establishment.show_subscriptions_fullpage));
      try {
        localStorage.setItem(localStorageShowSubscriptionsFullpageKey, establishment.show_subscriptions_fullpage ? 'true' : 'false');
      } catch { }
    }
  }, [establishment?.limit_subscriber_bookings, establishment?.prevent_same_day_reschedule, establishment?.limit_subscribers_one_week, establishment?.use_pagarme_subscription_pix, establishment?.use_mercadopago_subscription_pix, establishment?.pagarme_recipient_id, establishment?.mercadopago_access_token, establishment?.show_subscriptions_fullpage]);

  const handleUpdateShowSubscriptionsFullpage = async (newValue: boolean) => {
    setIsUpdatingShowSubscriptionsFullpage(true);
    try {
      // Salvar no banco; se a coluna ainda não existir, faz fallback em localStorage
      const { error } = await supabase
        .from('establishments')
        .update({ show_subscriptions_fullpage: newValue } as any)
        .eq('id', establishmentId);

      if (error) {
        console.warn('⚠️ Não foi possível salvar no banco (coluna pode não existir ainda). Salvando localmente.', error);
        setShowSubscriptionsFullpage(newValue);
        try {
          localStorage.setItem(localStorageShowSubscriptionsFullpageKey, newValue ? 'true' : 'false');
        } catch { }
        toast.success(newValue
          ? 'Agora as assinaturas vão aparecer por completo no Booking (salvo localmente).'
          : 'As assinaturas voltaram ao modo "PLANOS MENSAIS" no Booking (salvo localmente).'
        );
        return;
      }

      setShowSubscriptionsFullpage(newValue);
      try {
        localStorage.setItem(localStorageShowSubscriptionsFullpageKey, newValue ? 'true' : 'false');
      } catch { }

      toast.success(newValue
        ? 'Agora as assinaturas vão aparecer por completo no Booking.'
        : 'As assinaturas voltaram ao modo "PLANOS MENSAIS" no Booking.'
      );

      if (onEstablishmentUpdate) onEstablishmentUpdate();
    } catch (e) {
      console.error('Erro ao atualizar visualização das assinaturas no booking:', e);
      toast.error('Erro ao salvar configuração de assinaturas no booking.');
    } finally {
      setIsUpdatingShowSubscriptionsFullpage(false);
    }
  };

  const handleUpdateUsePagarmeSubscriptionPix = async (newValue: boolean) => {
    setIsUpdatingPagarmeSubscriptionPix(true);
    try {
      // Só permitir ATIVAR se houver recebedor Pagar.me configurado
      const recipientId = String(establishment?.pagarme_recipient_id || '').trim();
      if (newValue && !recipientId) {
        toast.error('Você precisa criar e colocar seus dados de recebimento (Recebedor Pagar.me) nas Configurações.');
        return;
      }

      // Exclusão mútua: se ativar Pagar.me, desativar Mercado Pago
      const updateData: any = { use_pagarme_subscription_pix: newValue };
      if (newValue) {
        updateData.use_mercadopago_subscription_pix = false;
      }

      // Limpar localStorage quando desativar (garantir que não fique cache antigo)
      try {
        if (newValue) {
          localStorage.setItem(localStoragePagarmeKey, 'true');
          localStorage.setItem(localStorageMercadoPagoKey, 'false');
        } else {
          // Quando desativar, remover do localStorage para garantir que não seja usado
          localStorage.removeItem(localStoragePagarmeKey);
        }
      } catch { }

      const { error } = await supabase
        .from('establishments')
        .update(updateData)
        .eq('id', establishmentId);

      if (error) {
        console.warn('⚠️ Não foi possível salvar no banco (coluna pode não existir ainda). Salvando localmente.', error);
        setUsePagarmeSubscriptionPix(newValue);
        if (newValue) {
          setUseMercadoPagoSubscriptionPix(false);
        }
        toast.success(newValue
          ? 'Recorrência Pagar.me (PIX) ativada (salva localmente). Mercado Pago foi desativado automaticamente.'
          : 'Recorrência Pagar.me (PIX) desativada (salva localmente).'
        );
        return;
      }

      setUsePagarmeSubscriptionPix(newValue);
      if (newValue) {
        setUseMercadoPagoSubscriptionPix(false);
      }
      toast.success(newValue
        ? 'Recorrência Pagar.me (PIX) ativada. Mercado Pago foi desativado automaticamente.'
        : 'Recorrência Pagar.me (PIX) desativada.'
      );

      if (onEstablishmentUpdate) onEstablishmentUpdate();
    } catch (e) {
      console.error('Erro ao atualizar recorrência Pagar.me:', e);
      toast.error('Erro ao atualizar configuração de recorrência Pagar.me.');
    } finally {
      setIsUpdatingPagarmeSubscriptionPix(false);
    }
  };

  const handleUpdateUseMercadoPagoSubscriptionPix = async (newValue: boolean) => {
    setIsUpdatingMercadoPagoSubscriptionPix(true);
    try {
      // Só permitir ATIVAR se houver Mercado Pago conectado
      const accessToken = String(establishment?.mercadopago_access_token || '').trim();
      if (newValue && !accessToken) {
        toast.error('Você precisa conectar sua conta do Mercado Pago nas Configurações.');
        return;
      }

      // Exclusão mútua: se ativar Mercado Pago, desativar Pagar.me
      const updateData: any = { use_mercadopago_subscription_pix: newValue };
      if (newValue) {
        updateData.use_pagarme_subscription_pix = false;
      }

      // Limpar localStorage quando desativar (garantir que não fique cache antigo)
      try {
        if (newValue) {
          localStorage.setItem(localStorageMercadoPagoKey, 'true');
          localStorage.setItem(localStoragePagarmeKey, 'false');
        } else {
          // Quando desativar, remover do localStorage para garantir que não seja usado
          localStorage.removeItem(localStorageMercadoPagoKey);
        }
      } catch { }

      const { error } = await supabase
        .from('establishments')
        .update(updateData)
        .eq('id', establishmentId);

      if (error) {
        console.warn('⚠️ Não foi possível salvar no banco (coluna pode não existir ainda). Salvando localmente.', error);
        setUseMercadoPagoSubscriptionPix(newValue);
        if (newValue) {
          setUsePagarmeSubscriptionPix(false);
        }
        toast.success(newValue
          ? 'Recorrência Mercado Pago (cartão mensal + PIX manual) ativada (salva localmente). Pagar.me foi desativado automaticamente.'
          : 'Recorrência Mercado Pago desativada (salva localmente).'
        );
        return;
      }

      setUseMercadoPagoSubscriptionPix(newValue);
      if (newValue) {
        setUsePagarmeSubscriptionPix(false);
      }
      toast.success(newValue
        ? 'Recorrência Mercado Pago (cartão mensal + PIX manual) ativada. Pagar.me foi desativado automaticamente.'
        : 'Recorrência Mercado Pago desativada.'
      );

      if (onEstablishmentUpdate) onEstablishmentUpdate();
    } catch (e) {
      console.error('Erro ao atualizar recorrência Mercado Pago:', e);
      toast.error('Erro ao atualizar configuração de recorrência Mercado Pago.');
    } finally {
      setIsUpdatingMercadoPagoSubscriptionPix(false);
    }
  };

  // Função para atualizar limitação de agendamentos de assinantes
  const handleUpdateSubscriberBookingLimit = async (newLimit: boolean) => {
    setIsUpdatingLimit(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ limit_subscriber_bookings: newLimit })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar limitação de agendamentos:', error);
        toast.error('Erro ao atualizar configuração de agendamentos.');
        return;
      }

      setLimitSubscriberBookings(newLimit);
      toast.success(
        newLimit
          ? 'Assinantes agora só podem agendar dentro da mesma semana.'
          : 'Assinantes podem agendar qualquer data disponível.'
      );

      // Notificar o componente pai sobre a atualização
      if (onEstablishmentUpdate) {
        onEstablishmentUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar limitação de agendamentos:', error);
      toast.error('Erro ao atualizar configuração de agendamentos.');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  // Função para atualizar limitação de remarcação no mesmo dia
  const handleUpdatePreventSameDayReschedule = async (newLimit: boolean) => {
    setIsUpdatingSameDayLimit(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ prevent_same_day_reschedule: newLimit })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar limitação de remarcação no mesmo dia:', error);
        toast.error('Erro ao atualizar configuração de remarcação.');
        return;
      }

      setPreventSameDayReschedule(newLimit);
      toast.success(
        newLimit
          ? 'Assinantes não podem mais remarcar no mesmo dia após cancelar.'
          : 'Assinantes podem cancelar e remarcar livremente.'
      );

      // Notificar o componente pai sobre a atualização
      if (onEstablishmentUpdate) {
        onEstablishmentUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar limitação de remarcação no mesmo dia:', error);
      toast.error('Erro ao atualizar configuração de remarcação.');
    } finally {
      setIsUpdatingSameDayLimit(false);
    }
  };

  // Função para atualizar configuração de 1 agendamento por semana
  const handleUpdateOneWeekLimit = async (newLimit: boolean) => {
    setIsUpdatingOneWeekLimit(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ limit_subscribers_one_week: newLimit })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar limitação de 1 agendamento por semana:', error);
        toast.error('Erro ao atualizar configuração de 1 agendamento por semana.');
        return;
      }

      setLimitSubscribersOneWeek(newLimit);
      toast.success(
        newLimit
          ? 'Assinantes limitados a 1 agendamento por semana.'
          : 'Assinantes podem fazer múltiplos agendamentos por semana.'
      );

      // Notificar o componente pai sobre a atualização
      if (onEstablishmentUpdate) {
        onEstablishmentUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar limitação de 1 agendamento por semana:', error);
      toast.error('Erro ao atualizar configuração de 1 agendamento por semana.');
    } finally {
      setIsUpdatingOneWeekLimit(false);
    }
  };


  // Função para buscar profissionais do estabelecimento
  const fetchProfessionals = async () => {
    try {
      // Buscar o estabelecimento com os profissionais
      const { data: establishmentData, error: establishmentError } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishmentId)
        .single();

      if (establishmentError) {
        console.error('Erro ao buscar estabelecimento:', establishmentError);
        setProfessionals([]);
        return;
      }

      // Os profissionais estão em establishment.professionals como array JSONB
      const professionals = (establishmentData.professionals || []).map((prof: any) => ({
        id: prof.id || prof.name, // Usar id se existir, senão usar name como id
        full_name: prof.name,
        percentage: normalizeProfessionalPercentage(prof?.percentage),
      }));

      setProfessionals(professionals);

    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
      setProfessionals([]);
    }
  };

  // Função para buscar atendimentos de assinantes (do mês selecionado)
  const fetchSubscriberAttendances = async (month?: number, year?: number) => {
    try {
      // Usar mês/ano selecionado ou mês atual como padrão
      const targetMonth = month !== undefined ? month : selectedMonth;
      const targetYear = year !== undefined ? year : selectedYear;
      const firstDayOfMonth = new Date(targetYear, targetMonth, 1);
      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('subscriber_attendances')
        .select(`
          id,
          professional_name,
          attendance_date,
          repass_value,
          created_at,
          client_subscription_id
        `)
        .eq('establishment_id', establishmentId)
        .gte('attendance_date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('attendance_date', lastDayOfMonth.toISOString().split('T')[0])
        .order('attendance_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar atendimentos de assinantes:', error);
        return;
      }

      setSubscriberAttendances(data || []);
    } catch (error) {
      console.error('Erro ao buscar atendimentos de assinantes:', error);
    }
  };

  // ? Contagem mensal com saldo do mês anterior carregado para o mês selecionado.
  const fetchSubscriberAttendanceCounts = async (month?: number, year?: number) => {
    try {
      const targetMonth = month !== undefined ? month : selectedMonth;
      const targetYear = year !== undefined ? year : selectedYear;
      const targetDate = new Date(targetYear, targetMonth, 1);
      const currentMonthRange = getCalendarMonthDateRange(targetDate);
      const previousMonthRange = getPreviousCalendarMonthDateRange(targetDate);

      const { data: subs, error: subsErr } = await supabase
        .from('client_subscriptions')
        .select('id, start_date, end_date, monthly_limit')
        .eq('establishment_id', establishmentId);

      if (subsErr) {
        console.error('Erro ao buscar assinaturas para contagem:', subsErr);
        return;
      }

      const { data: rows, error } = await supabase
        .from('subscriber_attendances')
        .select('client_subscription_id, attendance_date')
        .eq('establishment_id', establishmentId)
        .gte('attendance_date', previousMonthRange.periodMin)
        .lte('attendance_date', currentMonthRange.periodMax);

      if (error) {
        console.error('Erro ao buscar contagem de atendimentos:', error);
        return;
      }

      const rowsBySubId: Record<string, any[]> = {};
      (rows || []).forEach((row: any) => {
        const id = String(row?.client_subscription_id || '');
        if (!id) return;
        if (!rowsBySubId[id]) rowsBySubId[id] = [];
        rowsBySubId[id].push(row);
      });

      const counts: Record<string, number> = {};
      const effectiveLimits: Record<string, number | null> = {};

      (subs || []).forEach((sub: any) => {
        const id = String(sub?.id || '');
        if (!id) return;

        const currentRange = clampDateRangeToSubscription(currentMonthRange, sub);
        const previousRange = clampDateRangeToSubscription(previousMonthRange, sub);
        const subRows = rowsBySubId[id] || [];
        const currentUsage = subRows.filter((row: any) =>
          isIsoDateWithinRange(String(row?.attendance_date || ''), currentRange)
        ).length;
        const previousUsage = subRows.filter((row: any) =>
          isIsoDateWithinRange(String(row?.attendance_date || ''), previousRange)
        ).length;
        const allowance = buildCarryoverMonthlyLimit(
          sub?.monthly_limit,
          currentUsage,
          previousUsage,
          false
        );

        counts[id] = allowance.currentMonthUsage;
        effectiveLimits[id] = allowance.effectiveLimit;
      });

      setSubscriberAttendanceCountsByClientSubId(counts);
      setSubscriberEffectiveLimitByClientSubId(effectiveLimits);
    } catch (e) {
      console.error('Erro ao buscar contagem mensal de atendimentos:', e);
    }
  };

  // ✅ Histórico de contagens (mês atual + meses anteriores) para exibir "Fev 1" etc.
  const fetchSubscriberAttendanceCountsHistory = async (month?: number, year?: number, monthsBack: number = 6) => {
    try {
      const targetMonth = month !== undefined ? month : selectedMonth;
      const targetYear = year !== undefined ? year : selectedYear;

      const start = new Date(targetYear, targetMonth - monthsBack, 1);
      const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
      const min = start.toISOString().split('T')[0];
      const max = end.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('subscriber_attendances')
        .select('client_subscription_id, attendance_date')
        .eq('establishment_id', establishmentId)
        .gte('attendance_date', min)
        .lte('attendance_date', max);

      if (error) {
        console.error('Erro ao buscar histórico de contagem de atendimentos:', error);
        return;
      }

      const history: Record<string, Record<string, number>> = {};
      (data || []).forEach((row: any) => {
        const id = String(row?.client_subscription_id || '');
        const dateStr = String(row?.attendance_date || '').slice(0, 10);
        if (!id || dateStr.length < 7) return;
        const ym = dateStr.slice(0, 7); // YYYY-MM
        if (!history[id]) history[id] = {};
        history[id][ym] = (history[id][ym] || 0) + 1;
      });

      setSubscriberAttendanceCountsHistoryByClientSubId(history);
    } catch (e) {
      console.error('Erro ao buscar histórico de contagem de atendimentos:', e);
    }
  };

  // Função para buscar comissões de venda de assinatura (do mês selecionado)
  const fetchSubscriptionSaleCommissions = async (month?: number, year?: number) => {
    try {
      const targetMonth = month !== undefined ? month : selectedMonth;
      const targetYear = year !== undefined ? year : selectedYear;
      const firstDayOfMonth = new Date(targetYear, targetMonth, 1);
      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('subscription_sale_commissions')
        .select('id, professional_name, commission_percent, commission_amount, created_at, client_subscription_id')
        .eq('establishment_id', establishmentId)
        .gte('created_at', firstDayOfMonth.toISOString())
        .lte('created_at', lastDayOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar comissões de venda de assinatura:', error);
        setSubscriptionSaleCommissions([]);
        return;
      }

      setSubscriptionSaleCommissions(data || []);
    } catch (error) {
      console.error('Erro ao buscar comissões de venda de assinatura:', error);
      setSubscriptionSaleCommissions([]);
    }
  };

  const loadSaleCommissionForClient = async (clientSubscriptionId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscription_sale_commissions')
        .select('id, professional_name, commission_percent, commission_amount')
        .eq('establishment_id', establishmentId)
        .eq('client_subscription_id', clientSubscriptionId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar comissão de venda:', error);
        setSaleCommissionProfessional('');
        setSaleCommissionPercent('');
        return;
      }

      if (!data) {
        setSaleCommissionProfessional('');
        setSaleCommissionPercent('');
        return;
      }

      setSaleCommissionProfessional(String(data.professional_name || ''));
      setSaleCommissionPercent(
        data.commission_percent !== null && data.commission_percent !== undefined
          ? String(data.commission_percent)
          : ''
      );
    } catch (e) {
      console.error('Erro ao carregar comissão de venda (catch):', e);
      setSaleCommissionProfessional('');
      setSaleCommissionPercent('');
    }
  };

  const MAX_SUBSCRIPTION_VALUE_CHANGES = 10;

  const parseSubscriptionValueChangeHistory = (raw: unknown): SubscriptionValueChangeHistoryEntry[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: any) => ({
        id: String(item?.id || '').trim(),
        changed_at: String(item?.changed_at || '').trim(),
        old_value: Number(item?.old_value || 0),
        new_value: Number(item?.new_value || 0),
        discount_amount: Number(item?.discount_amount || 0),
        changed_by: item?.changed_by ? String(item.changed_by) : null,
        note: item?.note ? String(item.note) : null,
      }))
      .filter((item) =>
        item.id &&
        item.changed_at &&
        Number.isFinite(item.old_value) &&
        Number.isFinite(item.new_value) &&
        Number.isFinite(item.discount_amount)
      );
  };

  const getBaseSubscriptionValueForClient = (clientSub: any): number => {
    const direct = Number(clientSub?.subscriptions?.value ?? clientSub?.subscription_value ?? 0);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fromList = subscriptions.find((s) => s.id === clientSub?.subscription_id)?.value;
    return Number(fromList || 0);
  };

  const getSubscriptionValueForClient = (clientSub: any): number => {
    const customValue = Number((clientSub as any)?.custom_subscription_value ?? NaN);
    if (Number.isFinite(customValue) && customValue > 0) return customValue;
    return getBaseSubscriptionValueForClient(clientSub);
  };

  const computeSaleCommissionAmount = (subscriptionValue: number, percent: number): number => {
    const raw = subscriptionValue * (percent / 100);
    return Math.round(raw * 100) / 100;
  };

  const resolveSaleCommissionMultiplier = async (clientSubscriptionId: string, subscriptionValue: number) => {
    try {
      const { data: saleRow, error } = await supabase
        .from('subscription_sale_commissions')
        .select('professional_name, commission_percent, commission_amount')
        .eq('establishment_id', establishmentId)
        .eq('client_subscription_id', clientSubscriptionId)
        .maybeSingle();

      if (error || !saleRow) {
        return { multiplier: 1, hasSaleDiscount: false, salePercent: 0 };
      }

      const salePercentRaw = Number(String((saleRow as any)?.commission_percent || '').replace(',', '.'));
      if (Number.isFinite(salePercentRaw) && salePercentRaw > 0) {
        const safePercent = Math.min(100, Math.max(0, salePercentRaw));
        return {
          multiplier: Math.max(0, 1 - safePercent / 100),
          hasSaleDiscount: true,
          salePercent: safePercent,
        };
      }

      // Compatibilidade: se o percentual estiver nulo em dado legado, usar commission_amount.
      const saleAmountRaw = Number((saleRow as any)?.commission_amount || 0);
      if (Number.isFinite(saleAmountRaw) && saleAmountRaw > 0 && Number.isFinite(subscriptionValue) && subscriptionValue > 0) {
        const inferredPercent = Math.min(100, Math.max(0, (saleAmountRaw / subscriptionValue) * 100));
        return {
          multiplier: Math.max(0, 1 - inferredPercent / 100),
          hasSaleDiscount: true,
          salePercent: Math.round(inferredPercent * 100) / 100,
        };
      }

      return { multiplier: 1, hasSaleDiscount: false, salePercent: 0 };
    } catch {
      return { multiplier: 1, hasSaleDiscount: false, salePercent: 0 };
    }
  };

  const saveSaleCommissionDebounced = (clientSub: any, nextProfessional: string, nextPercentStr: string) => {
    if (saleCommissionSaveTimeoutRef.current) {
      window.clearTimeout(saleCommissionSaveTimeoutRef.current);
    }

    saleCommissionSaveTimeoutRef.current = window.setTimeout(async () => {
      const percent = Number(String(nextPercentStr || '').replace(',', '.'));
      const professionalName = String(nextProfessional || '').trim();

      setIsSavingSaleCommission(true);
      try {
        // Remover comissão quando:
        // - profissional é limpo (demissão/troca de vendedor), OU
        // - percentual vazio/0
        const shouldRemoveCommission = !professionalName || !Number.isFinite(percent) || percent <= 0;
        if (shouldRemoveCommission) {
          const { error } = await supabase
            .from('subscription_sale_commissions')
            .delete()
            .eq('establishment_id', establishmentId)
            .eq('client_subscription_id', clientSub.id);

          if (error) throw error;

          await fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);
          setSaleCommissionLastSavedAt(Date.now());
          return;
        }

        const subscriptionValue = getSubscriptionValueForClient(clientSub);
        const amount = computeSaleCommissionAmount(subscriptionValue, percent);

        // Insert (se não existir) ou update (se existir) — evita "upsert" e problemas com RLS
        const { data: existing, error: existingErr } = await supabase
          .from('subscription_sale_commissions')
          .select('id')
          .eq('establishment_id', establishmentId)
          .eq('client_subscription_id', clientSub.id)
          .maybeSingle();

        if (existingErr) throw existingErr;

        if (existing?.id) {
          const { error } = await supabase
            .from('subscription_sale_commissions')
            .update({
              professional_name: professionalName,
              commission_percent: percent,
              commission_amount: amount
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('subscription_sale_commissions').insert({
            establishment_id: establishmentId,
            client_subscription_id: clientSub.id,
            professional_name: professionalName,
            commission_percent: percent,
            commission_amount: amount
          });
          if (error) throw error;
        }

        await fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);
        setSaleCommissionLastSavedAt(Date.now());
      } catch (err: any) {
        console.error('Erro ao salvar comissão de venda:', err);
        toast.error(err?.message || 'Erro ao salvar % de venda da assinatura.');
      } finally {
        setIsSavingSaleCommission(false);
      }
    }, 550);
  };

  // Função para buscar pagamentos de profissionais (do mês selecionado)
  const fetchProfessionalPayments = async (month?: number, year?: number) => {
    try {
      // Usar mês/ano selecionado ou mês atual como padrão
      const targetMonth = month !== undefined ? month : selectedMonth;
      const targetYear = year !== undefined ? year : selectedYear;
      const periodStart = new Date(targetYear, targetMonth, 1);
      const periodEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
      const targetForMonth = format(periodStart, 'yyyy-MM');

      // IMPORTANTE: Buscar apenas pagamentos via assinatura (payment_source = 'subscription')
      // Pagamentos do dashboard financeiro (payment_source = 'normal' ou NULL) NÃO devem entrar aqui
      const { data, error } = await supabase
        .from('professional_payments')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('payment_source', 'subscription') // Só pagamentos via assinatura
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar pagamentos:', error);
        return;
      }

      const paymentsInSelectedMonth = ((data || []) as any[]).filter((payment) => {
        const rawAmount = Number((payment as any)?.amount || 0);
        if (!Number.isFinite(rawAmount) || rawAmount <= 0) return false;

        const forMonth = String((payment as any)?.for_month || '').trim();
        if (forMonth) {
          return forMonth === targetForMonth;
        }

        const rawPaymentDate = String((payment as any)?.payment_date || '').trim();
        if (!rawPaymentDate) return false;
        const paymentDate = new Date(rawPaymentDate);
        if (Number.isNaN(paymentDate.getTime())) return false;
        return paymentDate >= periodStart && paymentDate <= periodEnd;
      });

      setProfessionalPayments(paymentsInSelectedMonth);
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
    }
  };

  // Função para pagar profissional (registrar pagamento e zerar valor)
  const handlePayProfessional = async (professionalName: string, amount: number) => {
    if (!confirm(`Confirma o pagamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)} para ${professionalName}?`)) {
      return;
    }

    try {
      // Buscar ID do profissional no array de profissionais
      const professional = professionals.find(p => p.full_name === professionalName);
      const professionalId = professional?.id || professionalName;
      const selectedForMonth = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM');
      const now = new Date();
      const isCurrentSelectedMonth =
        selectedYear === now.getFullYear() &&
        selectedMonth === now.getMonth();
      const paymentDateForRecord = isCurrentSelectedMonth
        ? now
        : new Date(selectedYear, selectedMonth + 1, 0, 12, 0, 0, 0);

      // Registrar pagamento (marcar como "via assinatura" pois vem do sistema de assinantes)
      const insertPayload: any = {
        establishment_id: establishmentId,
        professional_id: professionalId,
        professional_name: professionalName,
        amount: amount,
        payment_date: now.toISOString(),
        payment_source: 'subscription', // Marcar como pagamento via assinatura
        for_month: selectedForMonth,
      };

      let { error: paymentError } = await supabase
        .from('professional_payments')
        .insert(insertPayload);

      // Compatibilidade com bancos onde a coluna for_month ainda não existe.
      if (paymentError && String((paymentError as any)?.message || '').toLowerCase().includes('for_month')) {
        const legacyPayload = {
          establishment_id: establishmentId,
          professional_id: professionalId,
          professional_name: professionalName,
          amount: amount,
          payment_date: paymentDateForRecord.toISOString(),
          payment_source: 'subscription' as const,
        };
        const retry = await supabase
          .from('professional_payments')
          .insert(legacyPayload);
        paymentError = retry.error;
      }

      if (paymentError) {
        console.error('Erro ao registrar pagamento:', paymentError);
        toast.error('Erro ao registrar pagamento.');
        return;
      }

      toast.success(`Pagamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)} registrado para ${professionalName}!`);

      // Recarregar pagamentos e atendimentos para atualizar o cálculo
      await fetchProfessionalPayments(selectedMonth, selectedYear);
      await fetchSubscriberAttendances(selectedMonth, selectedYear);
      // Nota: O valor será zerado automaticamente no cálculo porque agora há um pagamento registrado
    } catch (error) {
      console.error('Erro ao pagar profissional:', error);
      toast.error('Erro ao processar pagamento.');
    }
  };

  // Função para buscar histórico de pagamentos de um profissional (TODOS os pagamentos via assinatura, não apenas do mês atual)
  // IMPORTANTE: Buscar apenas pagamentos com payment_source = 'subscription' (pagamentos do sistema de assinantes)
  // Pagamentos do dashboard financeiro (payment_source = 'normal' ou NULL) NÃO devem aparecer aqui
  const fetchProfessionalPaymentHistory = async (professionalName: string) => {
    try {
      const { data, error } = await supabase
        .from('professional_payments')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('professional_name', professionalName)
        .eq('payment_source', 'subscription') // Só pagamentos via assinatura
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico de pagamentos:', error);
        return [];
      }

      return ((data || []) as any[]).filter((payment) => {
        const rawAmount = Number((payment as any)?.amount || 0);
        return Number.isFinite(rawAmount) && rawAmount > 0;
      });
    } catch (error) {
      console.error('Erro ao buscar histórico de pagamentos:', error);
      return [];
    }
  };

  const refreshAfterPaymentChange = async (professionalName?: string) => {
    await fetchProfessionalPayments(selectedMonth, selectedYear);
    await fetchSubscriberAttendances(selectedMonth, selectedYear);
    await fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);
    if (professionalName) {
      const history = await fetchProfessionalPaymentHistory(professionalName);
      setProfessionalPaymentHistory(history);
    }
  };

  const deletePaymentRecord = async (payment: any) => {
    const paymentId = String(payment?.id || '').trim();
    if (!paymentId) return;

    if (!window.confirm('Tem certeza que deseja apagar este lançamento? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setReassigningPaymentId(paymentId);
      const { error } = await supabase
        .from('professional_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      toast.success('Lançamento apagado com sucesso.');
      await refreshAfterPaymentChange(selectedProfessionalForHistory);
    } catch (err: any) {
      console.error('Erro ao apagar lançamento:', err);
      toast.error(err?.message || 'Não foi possível apagar este lançamento.');
    } finally {
      setReassigningPaymentId(null);
    }
  };

  const returnPaymentToBarberCash = async (payment: any) => {
    const paymentId = String(payment?.id || '').trim();
    if (!paymentId) return;

    const professionalName = String(payment?.professional_name || selectedProfessionalForHistory || '').trim();
    const currentAmount = Math.abs(Number(payment?.amount || 0));
    if (!window.confirm(`Voltar ${fmtBRL(currentAmount)} para o caixa de ${professionalName}? Isso removerá este lançamento do histórico.`)) {
      return;
    }

    try {
      setReassigningPaymentId(paymentId);
      const { error } = await supabase
        .from('professional_payments')
        .delete()
        .eq('id', paymentId);
      if (error) throw error;

      toast.success('Valor voltou para o caixa e o lançamento foi removido.');
      await refreshAfterPaymentChange(selectedProfessionalForHistory);
    } catch (err: any) {
      console.error('Erro ao estornar pagamento:', err);
      toast.error(err?.message || 'Não foi possível voltar este valor para o caixa.');
    } finally {
      setReassigningPaymentId(null);
    }
  };

  const movePaymentByMonthDelta = async (payment: any, deltaMonths: number) => {
    const paymentId = String(payment?.id || '').trim();
    if (!paymentId) return;

    try {
      setReassigningPaymentId(paymentId);

      const currentForMonth = String(payment?.for_month || '').trim();
      let baseDate: Date | null = null;

      if (/^\d{4}-\d{2}$/.test(currentForMonth)) {
        baseDate = parse(`${currentForMonth}-01`, 'yyyy-MM-dd', new Date());
      } else {
        const rawPaymentDate = String(payment?.payment_date || '').trim();
        const parsedDate = rawPaymentDate ? new Date(rawPaymentDate) : null;
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
          baseDate = parsedDate;
        }
      }

      if (!baseDate || Number.isNaN(baseDate.getTime())) {
        toast.error('Não foi possível identificar o mês atual deste lançamento.');
        return;
      }

      const targetDate = addMonths(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1), deltaMonths);
      const targetForMonth = format(targetDate, 'yyyy-MM');
      const fallbackDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 12, 0, 0, 0).toISOString();

      let { error } = await supabase
        .from('professional_payments')
        .update({ for_month: targetForMonth } as any)
        .eq('id', paymentId);

      if (error && String((error as any)?.message || '').toLowerCase().includes('for_month')) {
        const retry = await supabase
          .from('professional_payments')
          .update({ payment_date: fallbackDate } as any)
          .eq('id', paymentId);
        error = retry.error as any;
      }

      if (error) throw error;

      toast.success(`Lançamento movido para ${targetForMonth}.`);
      await refreshAfterPaymentChange(selectedProfessionalForHistory);
    } catch (err: any) {
      console.error('Erro ao mover pagamento de mês:', err);
      toast.error(err?.message || 'Não foi possível mover este lançamento.');
    } finally {
      setReassigningPaymentId(null);
    }
  };

  const movePaymentToSelectedMonth = async (payment: any) => {
    const paymentId = String(payment?.id || '').trim();
    if (!paymentId) return;

    const selectedForMonth = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM');
    const fallbackDate = new Date(selectedYear, selectedMonth + 1, 0, 12, 0, 0, 0).toISOString();

    try {
      setReassigningPaymentId(paymentId);

      let { error } = await supabase
        .from('professional_payments')
        .update({ for_month: selectedForMonth } as any)
        .eq('id', paymentId);

      // Compatibilidade com banco antigo sem coluna for_month:
      // reposiciona a payment_date para o mês selecionado.
      if (error && String((error as any)?.message || '').toLowerCase().includes('for_month')) {
        const retry = await supabase
          .from('professional_payments')
          .update({ payment_date: fallbackDate } as any)
          .eq('id', paymentId);
        error = retry.error as any;
      }

      if (error) {
        throw error;
      }

      toast.success(`Pagamento movido para competência ${selectedForMonth}.`);
      await fetchProfessionalPayments(selectedMonth, selectedYear);
      if (selectedProfessionalForHistory) {
        const history = await fetchProfessionalPaymentHistory(selectedProfessionalForHistory);
        setProfessionalPaymentHistory(history);
      }
      await fetchSubscriberAttendances(selectedMonth, selectedYear);
      await fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);
    } catch (err: any) {
      console.error('Erro ao mover pagamento de competência:', err);
      toast.error(err?.message || 'Não foi possível mover este pagamento para o mês selecionado.');
    } finally {
      setReassigningPaymentId(null);
    }
  };

  // Função para buscar atendimentos de um cliente específico (lista do mês selecionado no painel — legado)
  const getClientAttendances = (clientSubscriptionId: string) => {
    return subscriberAttendances.filter(attendance =>
      attendance.client_subscription_id === clientSubscriptionId
    );
  };

  const buildAttendancesByProfessional = (attendances: any[], clientSubscriptionId: string) => {
    const clientPointsMode = isClientSubscriptionPointsMode(clientSubscriptionId);
    return attendances.reduce((acc, attendance) => {
      const professional = String(attendance.professional_name || '').trim() || 'Profissional não informado';
      if (!acc[professional]) {
        acc[professional] = {
          count: 0,
          totalValue: 0,
          pointsCount: 0,
          attendances: []
        };
      }
      acc[professional].count++;
      acc[professional].totalValue += getAttendanceEffectiveRepass(attendance);
      if (clientPointsMode) acc[professional].pointsCount += 1;
      acc[professional].attendances.push(attendance);
      return acc;
    }, {} as { [key: string]: { count: number; totalValue: number; pointsCount: number; attendances: any[] } });
  };

  // Função para agrupar atendimentos por profissional
  const getClientAttendancesByProfessional = (clientSubscriptionId: string) => {
    const attendances = getClientAttendances(clientSubscriptionId);
    return buildAttendancesByProfessional(attendances, clientSubscriptionId);
  };

  const loadAttendanceViewerData = async (cs: ClientSubscription, filter: AttendanceViewerFilter) => {
    setAttendanceViewerLoading(true);
    setAttendanceViewerError(null);
    try {
      let q = supabase
        .from('subscriber_attendances')
        .select('id, professional_name, attendance_date, repass_value, created_at, client_subscription_id')
        .eq('establishment_id', establishmentId)
        .eq('client_subscription_id', cs.id);

      if (filter.kind === 'period') {
        const targetDate = new Date(selectedYear, selectedMonth, 1);
        const currentRange = clampDateRangeToSubscription(getCalendarMonthDateRange(targetDate), cs);
        if (!currentRange) {
          setAttendanceViewerRows([]);
          return;
        }
        q = q.gte('attendance_date', currentRange.periodMin).lte('attendance_date', currentRange.periodMax);
      } else {
        const d = parseISO(`${filter.ym}-01`);
        const first = format(startOfMonth(d), 'yyyy-MM-dd');
        const last = format(endOfMonth(d), 'yyyy-MM-dd');
        q = q.gte('attendance_date', first).lte('attendance_date', last);
      }

      const { data, error } = await q.order('attendance_date', { ascending: false });
      if (error) throw error;
      setAttendanceViewerRows(data || []);
    } catch (e: any) {
      console.error('Erro ao carregar atendimentos (visualização):', e);
      const msg =
        e?.message ||
        e?.details ||
        e?.hint ||
        (typeof e === 'string' ? e : '') ||
        'Não foi possível carregar os atendimentos.';
      setAttendanceViewerError(String(msg));
      setAttendanceViewerRows([]);
    } finally {
      setAttendanceViewerLoading(false);
    }
  };

  const openAttendanceViewerForClient = async (cs: ClientSubscription, filter: AttendanceViewerFilter) => {
    setSelectedClientForView(cs);
    setAttendanceViewerFilter(filter);
    setShowViewAttendancesModal(true);
    await loadAttendanceViewerData(cs, filter);
  };

  // Função para adicionar atendimento
  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientForAttendance) {
      return;
    }
    // Data e profissional não são mais escolhidos aqui; use "Atendimento assinatura" na agenda para isso
    const attendanceDateToSave = format(new Date(), 'yyyy-MM-dd');
    const attendanceProfessionalToSave = 'Adicionado em Meus Assinantes';

    // ? Bloquear se bater o limite do cliente (não permitir 5/4)
    const baseLimit = Number((selectedClientForAttendance as any)?.monthly_limit || 0);
    const effectiveLimit = subscriberEffectiveLimitByClientSubId[String(selectedClientForAttendance.id)] ?? (Number.isFinite(baseLimit) && baseLimit > 0 ? baseLimit : null);
    const currentCount = subscriberAttendanceCountsByClientSubId[String(selectedClientForAttendance.id)] || 0;
    if (effectiveLimit !== null && effectiveLimit > 0 && currentCount >= effectiveLimit) {
      toast.error(`Limite atingido (${currentCount}/${effectiveLimit}). Aumente o limite para adicionar mais atendimentos.`);
      return;
    }

    setIsSavingAttendance(true);
    try {
      const sub = subscriptions.find((s: any) => String(s.id) === String((selectedClientForAttendance as any)?.subscription_id));
      const divideEnabled = Boolean((sub as any)?.divide_total_enabled);
      const fixedCommission = Number((sub as any)?.fixed_commission_value || 0);
      const pointsModeSubscription = !divideEnabled && !(fixedCommission > 0);
      if (!pointsModeSubscription && !attendanceValue) {
        toast.error('Informe o valor repassado ao profissional para adicionar o atendimento.');
        setIsSavingAttendance(false);
        return;
      }
      const subscriptionValue = Number((sub as any)?.value || 0);
      const saleData = await resolveSaleCommissionMultiplier(String((selectedClientForAttendance as any)?.id || ''), subscriptionValue);
      const hasSaleDiscount = saleData.hasSaleDiscount;
      const salePercent = saleData.salePercent;
      // Regra:
      // - modo pontos (0% repasse + sem dividir): repasse R$ 0 no registro.
      // - sem "Dividir valor total": lança repasse normal informado.
      // - com divisão ativa: divide o repasse pelo total de atendimentos.
      let repassValueToSave = pointsModeSubscription
        ? 0
        : Math.round(attendanceValue * saleData.multiplier * 100) / 100;

      // ✅ "Dividir valor total" (configurado NA ASSINATURA)
      // A comissão de venda já foi aplicada no multiplicador. Se dividir estiver ligado,
      // o repasse final vira (repasse_atual / qtd_atendimentos_da_assinatura).
      const divideFromSubscription = Number((sub as any)?.divide_total_attendances || 0);
      const divideFallbackFromClientLimit = Number((selectedClientForAttendance as any)?.monthly_limit || 0);
      const divideCount =
        Number.isFinite(divideFromSubscription) && divideFromSubscription > 0
          ? divideFromSubscription
          : Number.isFinite(divideFallbackFromClientLimit) && divideFallbackFromClientLimit > 0
            ? divideFallbackFromClientLimit
            : 0;
      if (divideEnabled) {
        if (!Number.isFinite(divideCount) || divideCount <= 0) {
          toast.error('Essa assinatura está com “Dividir valor total” ativo, mas sem “Qtd. atendimentos”. Edite a assinatura e preencha (ex: 4).');
          setIsSavingAttendance(false);
          return;
        }
        repassValueToSave = Math.round((repassValueToSave / divideCount) * 100) / 100;
      }

      const { error } = await supabase
        .from('subscriber_attendances')
        .insert({
          establishment_id: establishmentId,
          client_subscription_id: selectedClientForAttendance.id,
          professional_name: attendanceProfessionalToSave,
          attendance_date: attendanceDateToSave,
          repass_value: repassValueToSave,
          created_by: user?.id
        });

      if (error) {
        throw error;
      }

      const suffix = hasSaleDiscount
        ? ` (com desconto de venda ${salePercent}% aplicado)`
        : '';
      const valueMsg = pointsModeSubscription
        ? '1 ponto (repasse em R$ zerado neste plano).'
        : `Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(repassValueToSave)}.`;
      toast.success(
        `Atendimento adicionado para ${selectedClientForAttendance.profiles?.full_name} (${format(parse(attendanceDateToSave, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ptBR })}). ${valueMsg}${suffix}`
      );

      // Limpar formulário
      setAttendanceValue(0);
      setShowAddAttendanceModal(false);
      setSelectedClientForAttendance(null);

      // Recarregar dados
      await fetchSubscriberAttendances(selectedMonth, selectedYear);
      await fetchSubscriberAttendanceCounts(selectedMonth, selectedYear);
      await fetchSubscriberAttendanceCountsHistory(selectedMonth, selectedYear);

    } catch (error: any) {
      console.error('Erro ao adicionar atendimento:', error);
      toast.error(error.message || 'Erro ao adicionar atendimento.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Função para remover atendimento
  const handleRemoveAttendance = async (attendanceId: string, professionalName: string, attendanceDate: string, repassValue: number) => {
    if (!confirm(`Tem certeza que deseja remover o atendimento de ${professionalName} em ${format(parse(String(attendanceDate || '').slice(0, 10), 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ptBR })} (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(repassValue)})?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriber_attendances')
        .delete()
        .eq('id', attendanceId);

      if (error) {
        throw error;
      }

      toast.success('Atendimento removido com sucesso!');

      // Recarregar dados
      await fetchSubscriberAttendances(selectedMonth, selectedYear);
      await fetchSubscriberAttendanceCounts(selectedMonth, selectedYear);
      await fetchSubscriberAttendanceCountsHistory(selectedMonth, selectedYear);

      if (selectedClientForView && attendanceViewerFilter) {
        await loadAttendanceViewerData(selectedClientForView, attendanceViewerFilter);
      }

    } catch (error: any) {
      console.error('Erro ao remover atendimento:', error);
      toast.error(error.message || 'Erro ao remover atendimento.');
    }
  };

  // Funções de fetch
  const fetchSubscriptions = async () => {
    const { data, error } = await getSubscriptions(establishmentId);
    if (error) {
      console.error('Erro ao buscar tipos de assinatura:', error);
      toast.error('Erro ao carregar tipos de assinatura.');
    } else {
      setSubscriptions(data || []);
    }
  };

  // Reordenar assinaturas (salva automaticamente no banco)
  const handleMoveSubscription = async (subscriptionId: string, direction: 'up' | 'down') => {
    const currentIndex = subscriptions.findIndex((s) => s.id === subscriptionId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= subscriptions.length) return;

    // Reordenar localmente (otimista)
    const reordered = [...subscriptions];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Normalizar sort_order sequencial para evitar duplicidades e manter estabilidade
    const normalized = reordered.map((s, idx) => ({ ...s, sort_order: idx }));
    setSubscriptions(normalized);

    try {
      // IMPORTANTE: evitar upsert aqui. Em Postgres, "INSERT ... ON CONFLICT DO UPDATE"
      // pode acionar checagem de RLS de INSERT e falhar com "new row violates RLS policy".
      // Então fazemos UPDATE por id (apenas UPDATE/RLS).
      const results = await Promise.all(
        normalized.map((s) =>
          supabase
            .from('subscriptions')
            .update({ sort_order: (s as any).sort_order })
            .eq('id', s.id)
        )
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        throw firstError;
      }
    } catch (error: any) {
      console.error('Erro ao reordenar assinaturas:', error);
      toast.error(error?.message || 'Erro ao salvar nova ordem das assinaturas.');
      // Voltar para o estado do banco (garante consistência)
      fetchSubscriptions();
    }
  };

  const fetchClientSubscriptions = async () => {
    try {
      // Usar o novo sistema independente de assinantes
      const { data: newSubscribers, error: newError } = await getEstablishmentSubscribers(establishmentId);

      if (newError) {
        console.error('Erro ao buscar assinantes (novo sistema):', newError);
        // Fallback para o sistema antigo se necessário
        const { data: oldData, error: oldError } = await getClientSubscriptions(establishmentId, {});
        if (oldError) {
          console.error('Erro ao buscar assinantes (sistema antigo):', oldError);
          toast.error('Erro ao carregar assinantes.');
          return;
        }
        const dedupedOldData = deduplicateSubscriberRows((oldData || []) as ClientSubscription[]);
        setClientSubscriptions(dedupedOldData);
        return;
      }

      // Transformar dados do novo sistema para o formato esperado
      const transformedSubscribers = (newSubscribers || []).map(subscriber => ({
        ...subscriber,
        profiles: {
          full_name: subscriber.subscriber_name || 'Cliente Desconhecido',
          email: subscriber.subscriber_email || null,
          is_subscriber: true
        },
        client_whatsapp: subscriber.subscriber_whatsapp || 'N/A'
      }));

      const dedupedSubscribers = deduplicateSubscriberRows(transformedSubscribers as ClientSubscription[]);
      setClientSubscriptions(dedupedSubscribers);
    } catch (error) {
      console.error('Erro ao buscar assinantes:', error);
      toast.error('Erro ao carregar assinantes.');
    }
  };


  // REMOVIDO: A função fetchClients não é mais necessária aqui, pois os clientes vêm via prop
  /*
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_id')
        .eq('role', 'client');

      if (error) throw error;
      setClients(data as Profile[] || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes.');
    }
  };
  */

  useEffect(() => {
    if (establishmentId) {
      fetchSubscriptions();
      fetchClientSubscriptions();
      fetchProfessionals();
      fetchSubscriberAttendances(selectedMonth, selectedYear);
      fetchSubscriberAttendanceCounts(selectedMonth, selectedYear);
      fetchSubscriberAttendanceCountsHistory(selectedMonth, selectedYear);
      fetchProfessionalPayments(selectedMonth, selectedYear);
      fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);

      // Recuperação automática de clientes na inicialização
      const autoRecover = async () => {
        try {
          const { autoRecoverClients } = await import('../utils/recoverClientsFromAppointments');
          const result = await autoRecoverClients(establishmentId);

          if (result.recovered > 0) {
            // Recarregar dados após recuperação
            fetchClientSubscriptions();
            if (onClientUpdated) onClientUpdated();
          }
        } catch (error) {
          console.error('Erro na recuperação automática:', error);
        }
      };

      // Executar recuperação automática após um pequeno delay
      const timeoutId = setTimeout(autoRecover, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [establishmentId]);

  // Recarregar dados quando o mês/ano selecionado mudar
  useEffect(() => {
    if (establishmentId) {
      fetchSubscriberAttendances(selectedMonth, selectedYear);
      fetchSubscriberAttendanceCounts(selectedMonth, selectedYear);
      fetchSubscriberAttendanceCountsHistory(selectedMonth, selectedYear);
      fetchProfessionalPayments(selectedMonth, selectedYear);
      fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear, establishmentId]);


  // Handlers para criação de assinatura
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newSubscriptionName ||
      !newSubscriptionValue ||
      newSubscriptionWeekdays.length === 0
    ) {
      toast.error('Preencha todos os campos para criar uma assinatura.');
      return;
    }
    try {
      const valorComissaoDiariaCalculado = Math.round((newSubscriptionValue * (newPercentualComissaoDiaria || 0) / 100) * 100) / 100;
      const normalizedDividedServices = normalizeDividedServices(newDividedServices);

      const divideAttendancesNum = Number(String(newDivideTotalAttendances || '').replace(',', '.'));
      if (newDivideTotalEnabled) {
        if (!Number.isFinite(divideAttendancesNum) || divideAttendancesNum <= 0) {
          toast.error('Informe a quantidade de atendimentos para “Dividir valor total” (ex: 4).');
          return;
        }
      }

      if (normalizedDividedServices.length === 0) {
        toast.error('Preencha os “Serviços oferecidos na assinatura” com pelo menos 1 serviço válido (nome, duração e limite).');
        return;
      }

      const { error } = await createSubscription(
        establishmentId,
        newSubscriptionName,
        newSubscriptionValue,
        1, // Duração fixa de 1 mês (não será mais usada)
        newSubscriptionWeekdays, // Adicionar os dias da semana
        undefined, // Novo padrão obrigatório: serviços oferecidos com duração por serviço
        valorComissaoDiariaCalculado, // Valor em R$ calculado a partir do percentual
        newSubscriptionDescription, // Adicionar descrição
        newDivideTotalEnabled,
        newDivideTotalEnabled ? divideAttendancesNum : null,
        true,
        normalizedDividedServices,
        newSubscriptionLabelColor || null,
        true,
        true
      );
      if (error) {
        throw error;
      }
      toast.success('Assinatura criada com sucesso!');
      setNewSubscriptionName('');
      setNewSubscriptionValue(0);
      setNewPercentualComissaoDiaria(0);
      setNewSubscriptionDuration(30); // Reset para 30 minutos
      setNewSubscriptionWeekdays([]);
      setNewSubscriptionDescription(''); // Limpar descrição
      setNewDivideTotalEnabled(false);
      setNewDivideTotalAttendances('');
      setNewDivideServicesEnabled(true);
      setNewDividedServices([createEmptyDividedService()]);
      setNewSubscriptionLabelColor('');
      fetchSubscriptions(); // Atualiza a lista
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      toast.error(error.message || 'Erro ao criar assinatura.');
    }
  };


  // Handler para adicionar assinante usando o novo sistema independente
  const handleAddClientSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubscriptionToAdd || !newClientName || !newClientPhone || !startDate || !endDate) {
      toast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    try {
      // Normalizar telefone para padrao unico (DDD + numero, sem 55)
      const normalizedPhone = normalizePhoneDigits(newClientPhone);

      // Usar o novo sistema independente de assinantes
      const { data, error } = await createIndependentSubscriber({
        name: newClientName,
        whatsapp: normalizedPhone,
        email: newClientEmail || undefined,
        payment_method: newSubscriberPaymentMethod || undefined,
        professional_id: newSubscriberProfessionalId || undefined,
        professional_name: newSubscriberProfessionalId ? getProfessionalNameById(newSubscriberProfessionalId) || undefined : undefined,
        observation: newSubscriberObservation.trim().slice(0, 150) || undefined,
        subscription_id: selectedSubscriptionToAdd,
        establishment_id: establishmentId,
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        throw error;
      }

      toast(`✅ ${newClientName} adicionado como assinante!`, 'success');

      // Limpar formulário
      setSelectedSubscriptionToAdd('');
      setSelectedClientToAdd('');
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setNewSubscriberPaymentMethod('');
      setNewSubscriberProfessionalId('');
      setNewSubscriberObservation('');
      setStartDate('');
      setEndDate('');

      // Recarregar lista de assinantes
      await fetchClientSubscriptions();

    } catch (error: any) {
      console.error('Erro ao adicionar assinante:', error);
      toast(error.message || 'Erro ao adicionar assinante.', 'error');
    }
  };

  // Handler para mudar status de pagamento
  const handleTogglePaymentStatus = async (clientSubscription: ClientSubscription, newStatus: 'paid' | 'unpaid') => {
    // Se o status não mudou, não fazer nada
    if (clientSubscription.payment_status === newStatus) {
      return;
    }

    try {
      const updatePayload: any = {
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      };
      if (newStatus === 'paid') {
        const paymentDate = getPaymentDateForImmediateStatusChange();
        const renewedEndDate = getRenewedEndDateFromPaymentDate(paymentDate);
        updatePayload.last_payment_date = paymentDate;
        updatePayload.end_date = renewedEndDate;
      }

      // FORÇAR atualização direta no banco - SEM lógica automática
      let { error } = await supabase
        .from('client_subscriptions')
        .update(updatePayload)
        .eq('id', clientSubscription.id);

      // Compatibilidade com bancos antigos sem coluna last_payment_date.
      if (error && String(error.message || '').toLowerCase().includes('last_payment_date')) {
        ({ error } = await supabase
          .from('client_subscriptions')
          .update({
            payment_status: newStatus,
            ...(newStatus === 'paid'
              ? { end_date: getRenewedEndDateFromPaymentDate(getPaymentDateForImmediateStatusChange()) }
              : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', clientSubscription.id));
      }

      if (error) {
        throw error;
      }

      if (newStatus === 'paid') {
        const renewedEndDate = getRenewedEndDateFromPaymentDate(getPaymentDateForImmediateStatusChange());
        toast(`Status FORÇADO para Pago e vencimento renovado para ${formatIsoDateSafe(renewedEndDate, renewedEndDate)}!`, 'success');
      } else {
        toast('Status FORÇADO para Não Pago!', 'success');
      }
      fetchClientSubscriptions(); // Atualiza a lista
    } catch (error: any) {
      console.error('Erro ao atualizar status de pagamento:', error);
      toast(error.message || 'Erro ao atualizar status de pagamento.', 'error');
    }
  };

  // Handler para deletar assinatura
  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (window.confirm('Tem certeza que deseja deletar esta assinatura? Todos os assinantes vinculados a ela permanecerão, mas sem a referência da assinatura.')) {
      try {
        const { error } = await deleteSubscription(subscriptionId);
        if (error) {
          throw error;
        }
        toast.success('Assinatura deletada com sucesso!');
        fetchSubscriptions();
      } catch (error: any) {
        console.error('Erro ao deletar assinatura:', error);
        toast.error(error.message || 'Erro ao deletar assinatura.');
      }
    }
  };

  // Handler para ocultar/desocultar assinatura
  const handleToggleHideSubscription = async (subscriptionId: string, currentHiddenState: boolean) => {
    const action = currentHiddenState ? 'desocultar' : 'ocultar';
    const confirmMessage = currentHiddenState
      ? 'Deseja desocultar esta assinatura? Ela voltará a aparecer no Booking para novos clientes.'
      : 'Deseja ocultar esta assinatura? Ela não aparecerá mais no Booking para novos clientes (assinantes existentes não serão afetados).';

    if (window.confirm(confirmMessage)) {
      try {
        const { error } = await supabase
          .from('subscriptions')
          .update({ is_hidden: !currentHiddenState })
          .eq('id', subscriptionId);

        if (error) {
          throw error;
        }

        toast.success(`Assinatura ${action === 'ocultar' ? 'ocultada' : 'desocultada'} com sucesso!`);
        fetchSubscriptions();
      } catch (error: any) {
        console.error(`Erro ao ${action} assinatura:`, error);
        toast.error(error.message || `Erro ao ${action} assinatura.`);
      }
    }
  };

  const isSubscriptionPixEnabled = (sub: Subscription): boolean =>
    Boolean((sub as any)?.payment_pix_enabled ?? true);

  const isSubscriptionCardEnabled = (sub: Subscription): boolean =>
    Boolean((sub as any)?.payment_card_enabled ?? true);

  const handleToggleSubscriptionPaymentMethod = async (
    subscriptionId: string,
    method: 'pix' | 'card'
  ) => {
    const currentSubscription = subscriptions.find((s) => String(s.id) === String(subscriptionId));
    if (!currentSubscription) return;

    const currentPixEnabled = isSubscriptionPixEnabled(currentSubscription);
    const currentCardEnabled = isSubscriptionCardEnabled(currentSubscription);

    let nextPixEnabled = currentPixEnabled;
    let nextCardEnabled = currentCardEnabled;

    if (method === 'pix') {
      const wantsEnablePix = !currentPixEnabled;
      if (!wantsEnablePix && !currentCardEnabled) {
        toast.error('Não é possível desativar o PIX quando o Cartão já está desativado.');
        return;
      }
      nextPixEnabled = wantsEnablePix;
    } else {
      const wantsEnableCard = !currentCardEnabled;
      if (wantsEnableCard) {
        nextCardEnabled = true;
      } else {
        // Regra solicitada: ao desativar cartão, o PIX liga automaticamente.
        nextCardEnabled = false;
        nextPixEnabled = true;
      }
    }

    setSubscriptions((prev) =>
      prev.map((sub) =>
        String(sub.id) === String(subscriptionId)
          ? ({
            ...sub,
            payment_pix_enabled: nextPixEnabled,
            payment_card_enabled: nextCardEnabled,
          } as Subscription)
          : sub
      )
    );

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          payment_pix_enabled: nextPixEnabled,
          payment_card_enabled: nextCardEnabled,
        } as any)
        .eq('id', subscriptionId)
        .eq('establishment_id', establishmentId);

      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('payment_pix_enabled') || message.includes('payment_card_enabled')) {
          toast.error(
            'Falta migration para ativar PIX/Cartão por assinatura. Rode o SQL novo no Supabase.'
          );
          fetchSubscriptions();
          return;
        }
        throw error;
      }

      toast.success(
        `Pagamento da assinatura atualizado: PIX ${nextPixEnabled ? 'ativo' : 'desativado'} • Cartão ${nextCardEnabled ? 'ativo' : 'desativado'}.`
      );
    } catch (error: any) {
      console.error('Erro ao atualizar formas de pagamento da assinatura:', error);
      toast.error(error?.message || 'Erro ao atualizar formas de pagamento da assinatura.');
      fetchSubscriptions();
    }
  };

  // Função para salvar descrição, nome, dias e duração
  const handleSaveDescription = async () => {
    if (!selectedSubscriptionForEdit) return;

    // Validações
    if (!editName.trim()) {
      toast.error('O nome da assinatura é obrigatório.');
      return;
    }

    if (editWeekdays.length === 0) {
      toast.error('Selecione pelo menos um dia da semana.');
      return;
    }

    const nextValue = Number(String(editSubscriptionValue || '').replace(',', '.'));
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      toast.error('O valor da assinatura deve ser maior que zero.');
      return;
    }

    const nextPercent = Number(String(editRepassePercent || '').replace(',', '.'));
    if (!Number.isFinite(nextPercent) || nextPercent < 0 || nextPercent > 100) {
      toast.error('A % de repasse deve estar entre 0 e 100.');
      return;
    }

    const round2 = (v: number) => Math.round(v * 100) / 100;
    const nextFixedCommissionValue = round2(nextValue * (nextPercent / 100));
    const nextDivideEnabled = Boolean(editDivideTotalEnabled);
    const nextDivideAttendancesNum = Number(String(editDivideTotalAttendances || '').replace(',', '.'));
    const nextDivideServicesEnabled = true; // Novo padrão obrigatório
    let nextDividedServices = normalizeDividedServices(editDividedServices);
    if (nextDividedServices.length === 0 && selectedSubscriptionForEdit) {
      nextDividedServices = [buildDefaultOfferedServiceFromSubscription(selectedSubscriptionForEdit)];
    }
    if (nextDivideEnabled) {
      if (!Number.isFinite(nextDivideAttendancesNum) || nextDivideAttendancesNum <= 0) {
        toast.error('Informe a quantidade de atendimentos para “Dividir valor total” (ex: 4).');
        return;
      }
    }
    if (nextDividedServices.length === 0) {
      toast.error('Adicione pelo menos 1 serviço válido em “Serviços oferecidos na assinatura” (nome, duração e limite).');
      return;
    }

    try {
      const legacyDuration = deriveLegacyServiceDurationFromOffered(nextDividedServices, selectedSubscriptionForEdit);
      const payload = {
        description: editDescription.trim() || null,
        name: editName.trim(),
        value: nextValue,
        weekdays: editWeekdays,
        service_duration: legacyDuration,
        fixed_commission_value: nextFixedCommissionValue,
        divide_total_enabled: nextDivideEnabled,
        divide_total_attendances: nextDivideEnabled ? nextDivideAttendancesNum : null,
        divide_services_enabled: true,
        divided_services: nextDividedServices,
        label_color: editSubscriptionLabelColor || null,
      };
      let { data: updatedRow, error } = await supabase
        .from('subscriptions')
        .update(payload)
        .eq('id', selectedSubscriptionForEdit.id)
        .eq('establishment_id', establishmentId)
        .select('id')
        .single();

      if (error && String((error as any)?.message || '').toLowerCase().includes('label_color')) {
        const fallbackPayload: any = { ...payload };
        delete fallbackPayload.label_color;
        ({ data: updatedRow, error } = await supabase
          .from('subscriptions')
          .update(fallbackPayload)
          .eq('id', selectedSubscriptionForEdit.id)
          .eq('establishment_id', establishmentId)
          .select('id')
          .single());
      }

      if (error) {
        throw error;
      }
      if (!updatedRow) {
        toast.error('Assinatura não encontrada ou sem permissão para editar.');
        return;
      }

      // Atualizar lista na hora (evita “voltar em 30 min” ao reabrir o modal)
      setSubscriptions(prev =>
        prev.map((s) =>
          s.id === selectedSubscriptionForEdit.id
            ? { ...s, ...payload }
            : s
        )
      );

      const syncOutcome = await syncFutureSubscriberAppointmentsDuration(
        selectedSubscriptionForEdit.id,
        nextDividedServices
      );
      if (syncOutcome === 'noop') {
        toast.success('Assinatura atualizada com sucesso.');
      }
      setShowEditDescriptionModal(false);
      setSelectedSubscriptionForEdit(null);
      setEditDescription('');
      setEditName('');
      setEditWeekdays([]);
      setEditDuration(30);
      setEditSubscriptionValue('');
      setEditRepassePercent('');
      setEditDivideTotalEnabled(false);
      setEditDivideTotalAttendances('');
      setEditDivideServicesEnabled(true);
      setEditDividedServices([]);
      setEditSubscriptionLabelColor('');
      fetchSubscriptions(); // Revalidar lista com o servidor
    } catch (error: any) {
      console.error('Erro ao salvar assinatura:', error);
      const msg = error?.message || error?.error_description || 'Erro ao salvar assinatura.';
      toast.error(msg);
    }
  };

  // Função para salvar link personalizado
  const handleSaveLink = async () => {
    if (!selectedSubscriptionForLinkEdit) return;

    try {
      const linkValue = editLink.trim() || null;

      // Validar URL se não estiver vazio
      if (linkValue && !linkValue.match(/^https?:\/\//)) {
        toast.error('O link deve começar com http:// ou https://');
        return;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ custom_link: linkValue })
        .eq('id', selectedSubscriptionForLinkEdit.id);

      if (error) {
        throw error;
      }

      toast.success(selectedSubscriptionForLinkEdit.custom_link ? 'Link atualizado com sucesso!' : 'Link adicionado com sucesso!');
      setShowEditLinkModal(false);
      setSelectedSubscriptionForLinkEdit(null);
      setEditLink('');
      fetchSubscriptions(); // Atualizar lista
    } catch (error: any) {
      console.error('Erro ao salvar link:', error);
      toast.error(error.message || 'Erro ao salvar link.');
    }
  };

  // Função para salvar link de cartão de crédito (fluxo manual)
  const handleSaveCreditCardLink = async () => {
    if (!selectedSubscriptionForCreditCardLinkEdit) return;

    try {
      const linkValue = editCreditCardLink.trim() || null;

      // Validar URL se não estiver vazio
      if (linkValue && !linkValue.match(/^https?:\/\//)) {
        toast.error('O link deve começar com http:// ou https://');
        return;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ credit_card_link: linkValue } as any)
        .eq('id', selectedSubscriptionForCreditCardLinkEdit.id);

      if (error) {
        throw error;
      }

      toast.success(
        selectedSubscriptionForCreditCardLinkEdit.credit_card_link
          ? 'Link do cartão atualizado com sucesso!'
          : 'Link do cartão adicionado com sucesso!'
      );
      setShowEditCreditCardLinkModal(false);
      setSelectedSubscriptionForCreditCardLinkEdit(null);
      setEditCreditCardLink('');
      fetchSubscriptions(); // Atualizar lista
    } catch (error: any) {
      console.error('Erro ao salvar link do cartão:', error);
      toast.error(error.message || 'Erro ao salvar link do cartão.');
    }
  };

  // Handler para deletar/limpar profissional do controle
  const handleDeleteProfessionalFromControl = async (professionalName: string) => {
    const monthName = monthNames[selectedMonth];
    if (window.confirm(`Tem certeza que deseja LIMPAR todos os registros de atendimento do profissional "${professionalName}" de ${monthName} ${selectedYear}?\n\nIsso irá ZERAR o valor acumulado e apagar o histórico de atendimentos deste profissional no mês.\n\nEsta ação NÃO PODE ser desfeita!`)) {
      try {
        // Calcular período do mês selecionado
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const firstDayStr = firstDay.toISOString().split('T')[0]; // YYYY-MM-DD

        // Último dia do mês selecionado
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        const lastDayStr = lastDay.toISOString().split('T')[0]; // YYYY-MM-DD

        // Deletar todos os subscriber_attendances deste profissional no mês selecionado
        const { error } = await supabase
          .from('subscriber_attendances')
          .delete()
          .eq('professional_name', professionalName)
          .eq('establishment_id', establishmentId)
          .gte('attendance_date', firstDayStr)
          .lte('attendance_date', lastDayStr);

        if (error) {
          throw error;
        }

        toast.success(`Profissional "${professionalName}" removido do controle com sucesso!`);

        // Recarregar dados
        fetchSubscriberAttendances(selectedMonth, selectedYear);
      } catch (error: any) {
        console.error('Erro ao deletar profissional do controle:', error);
        toast.error(error.message || 'Erro ao limpar profissional do controle.');
      }
    }
  };

  // Handler para deletar assinante
  const handleDeleteClientSubscription = async (clientSubscriptionId: string, clientName: string) => {
    if (window.confirm(`Tem certeza que deseja remover ${clientName} da lista de assinantes?`)) {
      try {
        // Buscar o client_id antes de deletar
        const clientSub = clientSubscriptions.find(cs => cs.id === clientSubscriptionId);
        const clientId = clientSub?.client_id;

        // Usar o novo sistema de assinantes
        const { error } = await removeSubscriber(clientSubscriptionId);
        if (error) {
          throw error;
        }

        toast('Assinante removido com sucesso!', 'success');
        fetchClientSubscriptions();
      } catch (error: any) {
        console.error('Erro ao remover assinante:', error);
        toast(error.message || 'Erro ao remover assinante.', 'error');
      }
    }
  };

  // Handler para atualizar data de término
  const handleUpdateEndDate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientForEdit || !newEndDate || !newStartDate) {
      toast.error('Preencha os dados obrigatórios.');
      return;
    }

    const nextName = String(editSubscriberName || '').trim();
    const nextPhone = normalizePhoneDigits(editSubscriberPhone);
    const nextSubscriptionId = String(editSubscriberSubscriptionId || '').trim();
    if (!nextName) {
      toast.error('Informe o nome do assinante.');
      return;
    }
    if (!nextPhone) {
      toast.error('Informe o telefone do assinante.');
      return;
    }
    if (!nextSubscriptionId) {
      toast.error('Selecione uma assinatura.');
      return;
    }

    setIsSavingEndDate(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(newEndDate);
      endDate.setHours(0, 0, 0, 0);

      // Determinar novo status baseado na data
      const newStatus = endDate < today ? 'unpaid' : 'paid';
      const shouldStampPaymentDate =
        newStatus === 'paid' && String(selectedClientForEdit.payment_status || '').toLowerCase() !== 'paid';
      const paymentDateForMonth = getPaymentDateForSelectedMonth();

      // Log da alteração para auditoria
      const logData = {
        subscriber_id: selectedClientForEdit.id,
        subscriber_name: nextName || selectedClientForEdit.profiles?.full_name || 'Cliente Desconhecido',
        old_end_date: selectedClientForEdit.end_date,
        new_end_date: newEndDate,
        old_status: selectedClientForEdit.payment_status,
        new_status: newStatus,
        changed_by: user?.id,
        changed_at: new Date().toISOString(),
        establishment_id: establishmentId
      };

      // Atualizar no banco de dados
      const updatePayload: any = {
        subscription_id: nextSubscriptionId,
        start_date: newStartDate,
        end_date: newEndDate,
        subscriber_name: nextName,
        subscriber_whatsapp: nextPhone,
        subscriber_email: String(editSubscriberEmail || '').trim() || null,
        payment_status: newStatus,
        subscriber_payment_method: editSubscriberPaymentMethod || null,
        subscriber_professional_id: editSubscriberProfessionalId || null,
        subscriber_professional_name: editSubscriberProfessionalId ? getProfessionalNameById(editSubscriberProfessionalId) || null : null,
        subscriber_observation: editSubscriberObservation.trim().slice(0, 150) || null,
        updated_at: new Date().toISOString()
      };
      if (shouldStampPaymentDate) {
        updatePayload.last_payment_date = paymentDateForMonth;
      }

      let { error } = await supabase
        .from('client_subscriptions')
        .update(updatePayload)
        .eq('id', selectedClientForEdit.id);

      const errMsg = String(error?.message || '').toLowerCase();
      if (
        error &&
        (
          errMsg.includes('subscriber_name') ||
          errMsg.includes('subscriber_whatsapp') ||
          errMsg.includes('subscriber_email') ||
          errMsg.includes('subscriber_payment_method') ||
          errMsg.includes('subscriber_professional_id') ||
          errMsg.includes('subscriber_professional_name') ||
          errMsg.includes('subscriber_observation') ||
          errMsg.includes('last_payment_date')
        )
      ) {
        const fallbackPayload: any = {
          subscription_id: nextSubscriptionId,
          start_date: newStartDate,
          end_date: newEndDate,
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        };
        if (shouldStampPaymentDate) {
          fallbackPayload.last_payment_date = paymentDateForMonth;
        }

        ({ error } = await supabase
          .from('client_subscriptions')
          .update(fallbackPayload)
          .eq('id', selectedClientForEdit.id));

        // Se o banco realmente não tiver last_payment_date, tenta uma última vez sem o campo.
        if (error && String(error.message || '').toLowerCase().includes('last_payment_date')) {
          ({ error } = await supabase
            .from('client_subscriptions')
            .update({
              subscription_id: nextSubscriptionId,
              start_date: newStartDate,
              end_date: newEndDate,
              payment_status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedClientForEdit.id));
        }
      }

      if (error) {
        throw error;
      }

      // Registrar log de auditoria
      await logAuditChange(logData);

      // Determinar mensagem de sucesso baseada no status
      const statusMessage = newStatus === 'paid' ? 'ativo/pago' : 'vencido';
      const startDateFormatted = new Date(newStartDate).toLocaleDateString('pt-BR');
      const endDateFormatted = new Date(newEndDate).toLocaleDateString('pt-BR');

      toast.success(`Datas atualizadas: ${startDateFormatted} a ${endDateFormatted}. Status: ${statusMessage}`);

      // Fechar modal e limpar dados
      setShowEditEndDateModal(false);
      setSelectedClientForEdit(null);
      setNewEndDate('');
      setNewStartDate('');
      setEditSubscriberName('');
      setEditSubscriberPhone('');
      setEditSubscriberEmail('');
      setEditSubscriberSubscriptionId('');
      setEditSubscriberPaymentMethod('');
      setEditSubscriberProfessionalId('');
      setEditSubscriberObservation('');

      // Recarregar dados
      await fetchClientSubscriptions();

    } catch (error: any) {
      console.error('Erro ao atualizar data de término:', error);
      toast.error(error.message || 'Erro ao atualizar data de término.');
    } finally {
      setIsSavingEndDate(false);
    }
  };

  // Função para abrir modal de edição
  const openEditEndDateModal = (clientSubscription: ClientSubscription) => {
    setSelectedClientForEdit(clientSubscription);
    setNewEndDate(clientSubscription.end_date);
    setNewStartDate(clientSubscription.start_date);
    setEditSubscriberName(String((clientSubscription as any)?.subscriber_name || clientSubscription.profiles?.full_name || ''));
    setEditSubscriberPhone(normalizePhoneDigits(String((clientSubscription as any)?.subscriber_whatsapp || clientSubscription.client_whatsapp || '')));
    setEditSubscriberEmail(String((clientSubscription as any)?.subscriber_email || clientSubscription.profiles?.email || ''));
    setEditSubscriberSubscriptionId(String(clientSubscription.subscription_id || ''));
    setEditSubscriberPaymentMethod(String((clientSubscription as any)?.subscriber_payment_method || ''));
    setEditSubscriberProfessionalId(String((clientSubscription as any)?.subscriber_professional_id || ''));
    setEditSubscriberObservation(String((clientSubscription as any)?.subscriber_observation || ''));
    setShowEditEndDateModal(true);
  };

  const buildDefaultOfferedServiceFromSubscription = (subscription: any): DividedSubscriptionService => {
    const limitRaw = Number((subscription as any)?.divide_total_attendances || 0);
    const fallbackLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 999;
    return {
      id: `svc_legacy_${String(subscription?.id || Date.now())}`,
      name: String(subscription?.name || 'Serviço da assinatura').trim() || 'Serviço da assinatura',
      duration: Number(subscription?.service_duration || 30) > 0 ? Number(subscription?.service_duration || 30) : 30,
      limit: fallbackLimit,
    };
  };

  const syncFutureSubscriberAppointmentsDuration = async (
    subscriptionId: string,
    offeredServices: DividedSubscriptionService[]
  ): Promise<'noop' | 'skipped' | 'updated'> => {
    const safeSubscriptionId = String(subscriptionId || '').trim();
    if (!safeSubscriptionId || !Array.isArray(offeredServices) || offeredServices.length === 0) return 'noop';

    const serviceById = new Map<string, DividedSubscriptionService>();
    const serviceByNameKey = new Map<string, DividedSubscriptionService>();
    offeredServices.forEach((service) => {
      const id = String(service.id || '').trim();
      const nameKey = normalizeNameKey(service.name || '');
      if (id) serviceById.set(id, service);
      if (nameKey) serviceByNameKey.set(nameKey, service);
    });

    try {
      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, status, duration, subscriber_service_id, subscriber_service_name, service, additional_products')
        .eq('establishment_id', establishmentId)
        .eq('subscription_id', safeSubscriptionId)
        .eq('is_subscriber', true)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', todayIso);

      if (error) {
        const errMsg = String(error.message || '').toLowerCase();
        const isLegacySchema =
          error.code === '42703' ||
          errMsg.includes('subscriber_service_id') ||
          errMsg.includes('subscription_id');
        if (!isLegacySchema) {
          console.warn('⚠️ Não foi possível sincronizar duração dos agendamentos de assinante:', error);
        }
        return 'noop';
      }

      const rows = (appointments || []) as any[];
      if (rows.length === 0) return 'noop';

      const parseExtraDuration = (raw: unknown): number => {
        if (!Array.isArray(raw)) return 0;
        return raw.reduce((sum, item: any) => sum + (Number(item?.duration || 0) || 0), 0);
      };

      const resolveBaseDuration = (apt: any): number => {
        const byId = serviceById.get(String(apt?.subscriber_service_id || '').trim());
        if (byId && Number(byId.duration) > 0) return Number(byId.duration);

        const rawName = String(apt?.subscriber_service_name || apt?.service || '').trim();
        if (!rawName) return 0;
        const rawNameKey = normalizeNameKey(rawName);

        const splitParts = rawName
          .split('+')
          .map((part) => normalizeNameKey(part))
          .filter(Boolean);

        if (splitParts.length > 1) {
          const total = splitParts.reduce((sum, key) => {
            const found = serviceByNameKey.get(key);
            return sum + (found ? Number(found.duration || 0) : 0);
          }, 0);
          if (total > 0) return total;
        }

        const exact = serviceByNameKey.get(rawNameKey);
        if (exact && Number(exact.duration) > 0) return Number(exact.duration);

        for (const [key, found] of serviceByNameKey.entries()) {
          if (key && rawNameKey.includes(key) && Number(found.duration) > 0) {
            return Number(found.duration);
          }
        }

        return 0;
      };

      const pendingUpdates: { id: string; nextDuration: number }[] = [];
      for (const apt of rows) {
        const baseDuration = resolveBaseDuration(apt);
        if (!(baseDuration > 0)) continue;
        const extraDuration = parseExtraDuration((apt as any)?.additional_products);
        const nextDuration = Math.max(1, Math.round(baseDuration + extraDuration));
        const currentDuration = Math.max(0, Number((apt as any)?.duration || 0));
        if (nextDuration === currentDuration) continue;
        pendingUpdates.push({ id: String(apt.id), nextDuration });
      }

      if (pendingUpdates.length === 0) {
        return 'noop';
      }

      const ok = window.confirm(
        `Encontramos ${rows.length} agendamento(ns) futuro(s) deste plano (pendentes ou confirmados).\n\n` +
          `${pendingUpdates.length} deles terão a DURAÇÃO recalculada conforme os serviços que você acabou de salvar (o horário de término na grade pode mudar).\n\n` +
          `O plano já está salvo.\n\n` +
          `Deseja aplicar essa sincronização na agenda agora?\n\n` +
          `Cancelar = manter as durações antigas nesses agendamentos já marcados.`
      );
      if (!ok) {
        toast.success('Plano salvo. Nenhum agendamento futuro foi alterado (sincronização da agenda cancelada).');
        return 'skipped';
      }

      let updatedCount = 0;
      for (const u of pendingUpdates) {
        const { error: updateErr } = await supabase
          .from('appointments')
          .update({ duration: u.nextDuration } as any)
          .eq('id', u.id);
        if (!updateErr) updatedCount += 1;
      }

      if (updatedCount > 0) {
        toast.success(
          `${updatedCount} agendamento(s) futuro(s) tiveram a duração ajustada para bater com o plano atual.`
        );
        return 'updated';
      }
      return 'noop';
    } catch (syncError) {
      console.warn('⚠️ Erro ao sincronizar duração dos agendamentos futuros de assinante:', syncError);
      return 'noop';
    }
  };

  const openLimitModal = (clientSubscription: ClientSubscription) => {
    setSelectedClientForLimit(clientSubscription);
    setMonthlyLimit((clientSubscription as any).monthly_limit || null);
    setShowLimitModal(true);
  };

  const openAdjustValueModal = (clientSubscription: ClientSubscription) => {
    const currentValue = getSubscriptionValueForClient(clientSubscription);
    setSelectedClientForValueAdjust(clientSubscription);
    setAdjustedSubscriptionValue(
      Number.isFinite(currentValue) && currentValue > 0
        ? String(currentValue.toFixed(2).replace('.', ','))
        : ''
    );
    setAdjustValueNote('');
    setShowAdjustValueModal(true);
  };

  const handleSaveAdjustedValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForValueAdjust) {
      toast.error('Assinante não selecionado.');
      return;
    }

    const nextValue = Number(String(adjustedSubscriptionValue || '').replace(',', '.'));
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }

    const currentValue = getSubscriptionValueForClient(selectedClientForValueAdjust);
    const currentRounded = Math.round(currentValue * 100);
    const nextRounded = Math.round(nextValue * 100);
    if (currentRounded === nextRounded) {
      toast.error('O novo valor é igual ao valor atual.');
      return;
    }

    const oldHistory = parseSubscriptionValueChangeHistory(
      (selectedClientForValueAdjust as any)?.subscription_value_change_history
    );
    if (oldHistory.length >= MAX_SUBSCRIPTION_VALUE_CHANGES) {
      toast.error(`Este assinante já atingiu o limite de ${MAX_SUBSCRIPTION_VALUE_CHANGES} alterações de valor.`);
      return;
    }

    const planValue = Number(getBaseSubscriptionValueForClient(selectedClientForValueAdjust));
    const roundedNextValue = Math.round(nextValue * 100) / 100;
    const roundedCurrentValue = Math.round(currentValue * 100) / 100;
    const discountAmount = Number.isFinite(planValue)
      ? Math.max(0, Math.round((planValue - roundedNextValue) * 100) / 100)
      : 0;

    const historyEntry: SubscriptionValueChangeHistoryEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      changed_at: new Date().toISOString(),
      old_value: roundedCurrentValue,
      new_value: roundedNextValue,
      discount_amount: discountAmount,
      changed_by: user?.id || null,
      note: adjustValueNote.trim().slice(0, 120) || null,
    };

    const nextHistory = [historyEntry, ...oldHistory].slice(0, MAX_SUBSCRIPTION_VALUE_CHANGES);

    setIsSavingAdjustedValue(true);
    try {
      const { error } = await supabase
        .from('client_subscriptions')
        .update({
          custom_subscription_value: roundedNextValue,
          subscription_value_change_history: nextHistory,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedClientForValueAdjust.id);

      if (error) {
        const errMsg = String(error.message || '').toLowerCase();
        if (
          error.code === '42703' ||
          errMsg.includes('custom_subscription_value') ||
          errMsg.includes('subscription_value_change_history')
        ) {
          toast.error('Falta migration para alteração de valor de assinante. Rode o SQL da migration e tente novamente.');
          return;
        }
        throw error;
      }

      toast.success('Valor do assinante atualizado com sucesso.');
      setShowAdjustValueModal(false);
      setSelectedClientForValueAdjust(null);
      setAdjustedSubscriptionValue('');
      setAdjustValueNote('');
      await fetchClientSubscriptions();
    } catch (error: any) {
      console.error('Erro ao salvar valor ajustado da assinatura:', error);
      toast.error(error?.message || 'Erro ao salvar o novo valor da assinatura.');
    } finally {
      setIsSavingAdjustedValue(false);
    }
  };

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientForLimit) {
      toast.error('Cliente não selecionado.');
      return;
    }

    setIsSavingLimit(true);
    try {
      const { error } = await supabase
        .from('client_subscriptions')
        .update({
          monthly_limit: monthlyLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedClientForLimit.id);

      if (error) throw error;

      const limitText = monthlyLimit ? `${monthlyLimit} agendamentos` : 'sem limite';
      toast.success(`Limite definido: ${limitText} por mês para ${selectedClientForLimit.profiles?.full_name || 'Cliente'}`);

      // Fechar modal e limpar dados
      setShowLimitModal(false);
      setSelectedClientForLimit(null);
      setMonthlyLimit(null);

      // Recarregar dados
      await fetchClientSubscriptions();

    } catch (error: any) {
      console.error('Erro ao salvar limite:', error);
      toast.error(error.message || 'Erro ao salvar limite.');
    } finally {
      setIsSavingLimit(false);
    }
  };

  // Função para registrar logs de auditoria
  const logAuditChange = async (logData: {
    subscriber_id: string;
    subscriber_name: string;
    old_end_date: string;
    new_end_date: string;
    old_status: string;
    new_status: string;
    changed_by: string;
    establishment_id: string;
  }) => {
    try {
      // Criar uma tabela de logs se não existir (opcional)
      // Por enquanto, vamos apenas logar no console e salvar no localStorage para auditoria local
      const auditLog = {
        ...logData,
        timestamp: new Date().toISOString(),
        action: 'end_date_update'
      };

      // Salvar no localStorage para auditoria local
      const existingLogs = JSON.parse(localStorage.getItem('subscriber_audit_logs') || '[]');
      existingLogs.push(auditLog);

      // Manter apenas os últimos 100 logs para não sobrecarregar o localStorage
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }

      localStorage.setItem('subscriber_audit_logs', JSON.stringify(existingLogs));

      // Aqui você pode implementar o envio para uma tabela de logs no banco se necessário
      // await supabase.from('audit_logs').insert(auditLog);

    } catch (error) {
      console.error('❌ Erro ao registrar log de auditoria:', error);
    }
  };

  // Função para checagem diária automática de vencimento
  const checkDailyExpiration = async () => {
    if (clientSubscriptions.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let hasChanges = false;

    for (const cs of clientSubscriptions) {
      const endDate = parseIsoDateSafe(cs.end_date);
      if (!endDate) continue;
      endDate.setHours(0, 0, 0, 0);

      // Se a data de término já passou e o status ainda não foi atualizado
      if (endDate < today && cs.payment_status === 'paid') {
        try {
          await supabase
            .from('client_subscriptions')
            .update({
              payment_status: 'unpaid',
              updated_at: new Date().toISOString()
            })
            .eq('id', cs.id);

          hasChanges = true;
        } catch (error) {
          console.error(`❌ Erro ao atualizar status de ${cs.profiles?.full_name}:`, error);
        }
      }
    }

    // Recarregar dados se houve mudanças
    if (hasChanges) {
      await fetchClientSubscriptions();
    }
  };

  // Lógica para resetar status de pagamento baseado na DATA DE FIM
  useEffect(() => {
    const checkAndResetPayments = async () => {
      if (clientSubscriptions.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
      let hasChanges = false;

      for (const cs of clientSubscriptions) {
        const endDate = new Date(cs.end_date);
        endDate.setHours(0, 0, 0, 0);

        // Se a data de fim passou E está marcado como 'paid', marcar como 'unpaid'
        if (today > endDate && cs.payment_status === 'paid') {
          try {
            // Atualizar diretamente no banco
            const { error } = await supabase
              .from('client_subscriptions')
              .update({
                payment_status: 'unpaid',
                updated_at: new Date().toISOString()
              })
              .eq('id', cs.id);

            if (error) {
              console.error(`Erro ao marcar como não pago:`, error);
            } else {
              hasChanges = true;
            }
          } catch (error) {
            console.error(`Erro ao resetar pagamento para ${cs.profiles?.full_name || 'Desconhecido'}:`, error);
          }
        }
      }

      // Só re-fetch se houve mudanças para evitar loop infinito
      if (hasChanges) {
        fetchClientSubscriptions();
      }
    };

    // Executar checagem diária e reset baseado na data de fim
    const timeoutId = setTimeout(async () => {
      await checkDailyExpiration(); // Nova função de checagem diária
      await checkAndResetPayments(); // Nova lógica baseada na data de fim
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [establishmentId, clientSubscriptions.length]); // Incluir clientSubscriptions.length para reagir a mudanças

  const selectedReferenceDate = useMemo(() => new Date(selectedYear, selectedMonth, 1), [selectedMonth, selectedYear]);
  const monthStart = useMemo(() => startOfMonth(selectedReferenceDate), [selectedReferenceDate]);
  const monthEnd = useMemo(() => endOfMonth(selectedReferenceDate), [selectedReferenceDate]);

  const getSubscriptionValue = (cs: ClientSubscription): number => {
    const value = Number(getSubscriptionValueForClient(cs));
    return Number.isFinite(value) ? value : 0;
  };

  const getNetFromSubscription = (
    grossValue: number,
    providerRaw?: string | null,
    subscriberPaymentMethodRaw?: string | null,
    subscriptionPaymentOrderIdRaw?: string | null
  ): number => {
    if (!Number.isFinite(grossValue) || grossValue <= 0) return 0;

    const provider = String(providerRaw || '').toLowerCase().trim();
    const subscriberPaymentMethod = String(subscriberPaymentMethodRaw || '').toLowerCase().trim();
    const taxaPlataforma = 1;
    const configuredCreditTax = Number(establishment?.credit_card_tax_percentage);
    const configuredDebitTax = Number(establishment?.debit_card_tax_percentage);
    const hasConfiguredCreditTax = Number.isFinite(configuredCreditTax) && configuredCreditTax >= 0;
    const hasConfiguredDebitTax = Number.isFinite(configuredDebitTax) && configuredDebitTax >= 0;

    const hasPaymentMethod = subscriberPaymentMethod.length > 0;
    if (!hasPaymentMethod) {
      // Regra solicitada: sem forma de pagamento definida no assinante, não desconta taxa.
      return Math.max(0, Math.round(grossValue * 100) / 100);
    }

    const methodIsCredit = subscriberPaymentMethod === 'credito' || subscriberPaymentMethod === 'credit_card';
    const methodIsDebit = subscriberPaymentMethod === 'debito' || subscriberPaymentMethod === 'debit_card';
    const methodIsPix = subscriberPaymentMethod === 'pix';

    const isCredit = methodIsCredit;
    const isDebit = methodIsDebit;
    const isPix = methodIsPix;

    if (isCredit) {
      const taxaPercentual = hasConfiguredCreditTax ? (configuredCreditTax / 100) : 4.99 / 100;
      const netValue = grossValue - taxaPlataforma - (grossValue * taxaPercentual);
      return Math.max(0, Math.round(netValue * 100) / 100);
    } else if (isDebit) {
      const taxaPercentual = hasConfiguredDebitTax ? (configuredDebitTax / 100) : 1.99 / 100;
      const netValue = grossValue - taxaPlataforma - (grossValue * taxaPercentual);
      return Math.max(0, Math.round(netValue * 100) / 100);
    } else if (isPix) {
      const isMercadoPago = provider.includes('mercadopago');
      const isPagarme = provider.includes('pagarme');
      const isPixMercadoPago =
        isMercadoPago || (!isPagarme && methodIsPix && useMercadoPagoSubscriptionPix && !usePagarmeSubscriptionPix);
      const taxaPercentual = isPixMercadoPago ? 0.99 / 100 : 1.19 / 100;
      const netValue = grossValue - taxaPlataforma - (grossValue * taxaPercentual);
      return Math.max(0, Math.round(netValue * 100) / 100);
    }

    return Math.max(0, Math.round(grossValue * 100) / 100);
  };

  const isSubscriptionActiveInSelectedMonth = (cs: ClientSubscription): boolean => {
    const startDate = parseIsoDateSafe(cs.start_date);
    const endDate = parseIsoDateSafe(cs.end_date);

    // Se começou depois do mês selecionado, não deve contar neste mês.
    if (startDate && startDate > monthEnd) return false;
    // Se terminou antes do mês selecionado, não deve contar neste mês.
    if (endDate && endDate < monthStart) return false;

    return true;
  };

  const isActivePaidSubscriber = (cs: ClientSubscription): boolean => {
    if (String(cs.payment_status || '').toLowerCase() !== 'paid') return false;
    return isSubscriptionActiveInSelectedMonth(cs);
  };

  const isSubscriptionActiveByEndDate = (cs: ClientSubscription): boolean => {
    return isSubscriptionActiveInSelectedMonth(cs);
  };

  // Bruto = MRR atual (somente assinaturas ativas e pagas)
  const brutoAtivo = clientSubscriptions.reduce((sum, cs) => {
    if (!isActivePaidSubscriber(cs)) return sum;
    return sum + getSubscriptionValue(cs);
  }, 0);

  // Calcular total de repasses (Lucro Líquido = Lucro Bruto - Repasses)
  // Inclui atendimentos + comissão de venda de assinatura (não é atendimento)
  const totalRepasses = useMemo(() => {
    const attendancesSum = subscriberAttendances.reduce((sum, attendance) => {
      return sum + getAttendanceEffectiveRepass(attendance);
    }, 0);

    const saleCommissionsSum = subscriptionSaleCommissions.reduce((sum, item) => {
      return sum + (parseFloat(item.commission_amount) || 0);
    }, 0);

    return attendancesSum + saleCommissionsSum;
  }, [subscriberAttendances, subscriptionSaleCommissions, divideEnabledByClientSubscriptionId, clientSubscriptions, subscriptions]);

  // Líquido = Bruto - taxas de gateway/plataforma (assinaturas ativas)
  const liquidoAtivo = clientSubscriptions.reduce((sum, cs) => {
    if (!isActivePaidSubscriber(cs)) return sum;
    const grossValue = getSubscriptionValue(cs);
    return sum + getNetFromSubscription(
      grossValue,
      (cs as any)?.subscription_payment_provider,
      (cs as any)?.subscriber_payment_method,
      (cs as any)?.subscription_payment_order_id
    );
  }, 0);

  // Entradas do mês: somente pagamentos de assinatura que aconteceram no mês selecionado
  // (renovação e/ou entrada de novo assinante), sem herdar mês anterior.
  const emContaEntradasCents = clientSubscriptions.reduce((sum, cs) => {
    if (String(cs.payment_status || '').toLowerCase() !== 'paid') return sum;

    const rawPaymentDate = String((cs as any)?.last_payment_date || '').trim();
    const rawFallbackDate = String(cs.start_date || '').trim();
    const dateToCheckRaw = rawPaymentDate || rawFallbackDate;
    if (!dateToCheckRaw) return sum;

    const paymentDate = parseISO(dateToCheckRaw);
    if (Number.isNaN(paymentDate.getTime())) return sum;
    if (paymentDate < monthStart || paymentDate > monthEnd) return sum;

    return sum + toCents(getSubscriptionValue(cs));
  }, 0);

  // Saídas do mês: pagamentos realizados para profissionais no módulo de assinantes
  // (já filtrados por competência/mês em fetchProfessionalPayments).
  // Mantém sinal para suportar estorno (valor negativo volta para o caixa).
  const emContaSaidasCents = professionalPayments.reduce((sum, payment) => {
    const amount = Number((payment as any)?.amount || 0);
    if (!Number.isFinite(amount) || amount === 0) return sum;
    return sum + toCents(amount);
  }, 0);

  // Em conta atual do mês = entradas - saídas (nunca negativo na UI)
  const emContaEntradasMes = fromCents(emContaEntradasCents);
  const emContaSaidasMes = fromCents(emContaSaidasCents);
  const emContaMes = fromCents(Math.max(0, emContaEntradasCents - emContaSaidasCents));

  const emContaBreakdown = useMemo(() => {
    return clientSubscriptions
      .map((cs) => {
        if (String(cs.payment_status || '').toLowerCase() !== 'paid') return null;

        const rawPaymentDate = String((cs as any)?.last_payment_date || '').trim();
        const rawFallbackDate = String(cs.start_date || '').trim();
        const dateToCheckRaw = rawPaymentDate || rawFallbackDate;
        if (!dateToCheckRaw) return null;

        const paymentDate = parseISO(dateToCheckRaw);
        if (Number.isNaN(paymentDate.getTime())) return null;
        if (paymentDate < monthStart || paymentDate > monthEnd) return null;

        const value = getSubscriptionValue(cs);
        if (!Number.isFinite(value) || value <= 0) return null;

        const startDateRaw = String(cs.start_date || '').trim();
        const startDate = startDateRaw ? parseISO(startDateRaw) : null;
        const isNewSubscriber =
          Boolean(startDate) &&
          startDate != null &&
          !Number.isNaN(startDate.getTime()) &&
          format(startDate, 'yyyy-MM-dd') === format(paymentDate, 'yyyy-MM-dd');

        return {
          id: String(cs.id || ''),
          clientName: String(cs.profiles?.full_name || 'Cliente').trim() || 'Cliente',
          planName: String(cs.subscriptions?.name || 'Plano').trim() || 'Plano',
          paymentDate,
          value,
          typeLabel: isNewSubscriber ? 'Novo assinante' : 'Renovação',
        };
      })
      .filter((row): row is {
        id: string;
        clientName: string;
        planName: string;
        paymentDate: Date;
        value: number;
        typeLabel: string;
      } => Boolean(row))
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }, [clientSubscriptions, monthEnd, monthStart]);

  const liquidoAtivoBreakdown = useMemo(() => {
    return clientSubscriptions
      .filter((cs) => isActivePaidSubscriber(cs))
      .map((cs) => {
        const bruto = getSubscriptionValue(cs);
        const liquido = getNetFromSubscription(
          bruto,
          (cs as any)?.subscription_payment_provider,
          (cs as any)?.subscriber_payment_method,
          (cs as any)?.subscription_payment_order_id
        );
        const rawEndDate = String(cs.end_date || '').trim();
        const endDate = rawEndDate ? parseISO(rawEndDate) : null;
        return {
          id: String(cs.id || ''),
          clientName: String(cs.profiles?.full_name || 'Cliente').trim() || 'Cliente',
          planName: String(cs.subscriptions?.name || 'Plano').trim() || 'Plano',
          endDate,
          bruto,
          liquido,
        };
      })
      .sort((a, b) => b.liquido - a.liquido);
  }, [clientSubscriptions]);

  const totalAtivosBreakdown = useMemo(() => {
    return clientSubscriptions
      .filter((cs) => isSubscriptionActiveByEndDate(cs))
      .map((cs) => ({
        id: String(cs.id || ''),
        clientName: String(cs.profiles?.full_name || 'Cliente').trim() || 'Cliente',
        planName: String(cs.subscriptions?.name || 'Plano').trim() || 'Plano',
        paymentStatus: String(cs.payment_status || '').toLowerCase(),
        value: getSubscriptionValue(cs),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'pt-BR'));
  }, [clientSubscriptions]);

  const naoPagosBreakdown = useMemo(() => {
    return clientSubscriptions
      .filter((cs) => String(cs.payment_status || '').toLowerCase() === 'unpaid')
      .map((cs) => {
        const active = isSubscriptionActiveByEndDate(cs);
        return {
          id: String(cs.id || ''),
          clientName: String(cs.profiles?.full_name || 'Cliente').trim() || 'Cliente',
          planName: String(cs.subscriptions?.name || 'Plano').trim() || 'Plano',
          value: getSubscriptionValue(cs),
          reminderCount: getBillingReminderCount(cs),
          bucket: active ? 'Ativo sem pagamento' : 'Vencido sem pagamento',
        };
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'pt-BR'));
  }, [clientSubscriptions]);

  const clientSubscriptionById = useMemo(() => {
    const map = new Map<string, ClientSubscription>();
    clientSubscriptions.forEach((cs) => map.set(String(cs.id || ''), cs));
    return map;
  }, [clientSubscriptions]);

  // Saldo (assinantes): entradas PIX líquidas do mês selecionado - pagamentos do mês.
  // O desconto (taxa + R$1,00) é aplicado por pagamento individual.
  const hasPagarmeConnectedForSubscribers = !!String(establishment?.pagarme_recipient_id || '').trim();
  const hasMercadoPagoConnectedForSubscribers = !!String(establishment?.mercadopago_access_token || '').trim();
  const hasAnySubscriptionGatewayConnected = hasPagarmeConnectedForSubscribers || hasMercadoPagoConnectedForSubscribers;
  const pixEntradasLiquidasMesCents = clientSubscriptions.reduce((sum, cs) => {
    if (!hasAnySubscriptionGatewayConnected) return sum;
    if (String(cs.payment_status || '').toLowerCase() !== 'paid') return sum;

    const rawPaymentDate = String((cs as any)?.last_payment_date || '').trim();
    const rawFallbackDate = String(cs.start_date || '').trim();
    const dateToCheckRaw = rawPaymentDate || rawFallbackDate;
    if (!dateToCheckRaw) return sum;

    const paymentDate = parseISO(dateToCheckRaw);
    if (Number.isNaN(paymentDate.getTime())) return sum;
    if (paymentDate < monthStart || paymentDate > monthEnd) return sum;

    const paymentMethod = String((cs as any)?.subscriber_payment_method || '').toLowerCase().trim();
    if (paymentMethod !== 'pix') return sum;
    const provider = String((cs as any)?.subscription_payment_provider || '').toLowerCase();
    const isIntegratedProvider = provider.includes('pagarme') || provider.includes('mercadopago');
    if (!isIntegratedProvider) return sum;

    const bruto = Number(getSubscriptionValue(cs));
    if (!Number.isFinite(bruto) || bruto <= 0) return sum;

    const liquido = getNetFromSubscription(
      bruto,
      provider,
      (cs as any)?.subscriber_payment_method,
      (cs as any)?.subscription_payment_order_id
    );
    return sum + toCents(liquido);
  }, 0);

  const saldoAssinantes = fromCents(Math.max(0, pixEntradasLiquidasMesCents - emContaSaidasCents));
  // Regra de exibição:
  // - Mercado Pago: valor cai direto na conta do estabelecimento, então não mostrar card de "Saldo (assinantes)".
  // - Pagar.me sem Mercado Pago: mantém card de saldo operacional.
  const shouldShowSubscribersBalanceCard =
    hasPagarmeConnectedForSubscribers &&
    !hasMercadoPagoConnectedForSubscribers &&
    !useMercadoPagoSubscriptionPix;

  const [isRefreshingSaldoAssinantes, setIsRefreshingSaldoAssinantes] = useState(false);
  const handleRefreshSaldoAssinantes = async () => {
    if (isRefreshingSaldoAssinantes) return;
    setIsRefreshingSaldoAssinantes(true);
    try {
      await fetchClientSubscriptions();
      await fetchSubscriberAttendances(selectedMonth, selectedYear);
      await fetchSubscriberAttendanceCounts(selectedMonth, selectedYear);
      await fetchSubscriberAttendanceCountsHistory(selectedMonth, selectedYear);
      await fetchProfessionalPayments(selectedMonth, selectedYear);
      await fetchSubscriptionSaleCommissions(selectedMonth, selectedYear);
      toast.success('Saldo atualizado!');
    } catch (e) {
      console.error('Erro ao atualizar saldo de assinantes:', e);
      toast.error('Não foi possível atualizar agora.');
    } finally {
      setIsRefreshingSaldoAssinantes(false);
    }
  };

  const totalAssinantes = clientSubscriptions.filter(cs => isSubscriptionActiveByEndDate(cs)).length;

  // Contar assinantes não pagos (ativos e vencidos)
  const assinantesNaoPagos = clientSubscriptions.filter(cs => {
    return cs.payment_status === 'unpaid'; // Todos os não pagos, independente da data
  }).length;

  // Filtrar assinantes pela pesquisa
  const filteredClientSubscriptions = clientSubscriptions.filter(cs => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    const clientName = cs.profiles?.full_name?.toLowerCase() || '';
    const clientEmail = cs.profiles?.email?.toLowerCase() || '';
    const clientWhatsapp = cs.client_whatsapp?.toLowerCase() || '';
    const subscriptionName = cs.subscriptions?.name?.toLowerCase() || '';

    return (
      clientName.includes(searchLower) ||
      clientEmail.includes(searchLower) ||
      clientWhatsapp.includes(searchLower) ||
      subscriptionName.includes(searchLower)
    );
  });


  // Função para mudar o mês selecionado
  const handleMonthChange = async (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    await fetchSubscriberAttendances(month, year);
    await fetchSubscriberAttendanceCounts(month, year);
    await fetchSubscriberAttendanceCountsHistory(month, year);
    await fetchProfessionalPayments(month, year);
    await fetchSubscriptionSaleCommissions(month, year);
  };

  // Função para ir para o mês anterior
  const goToPreviousMonth = () => {
    const newMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const newYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    handleMonthChange(newMonth, newYear);
  };

  // Função para ir para o mês seguinte
  const goToNextMonth = () => {
    const newMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const newYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    handleMonthChange(newMonth, newYear);
  };

  // Função para voltar ao mês atual
  const goToCurrentMonth = () => {
    const now = new Date();
    handleMonthChange(now.getMonth(), now.getFullYear());
  };

  const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();

  useEffect(() => {
    setShowEmContaBreakdown(false);
    setShowLiquidoAtivoBreakdown(false);
    setShowTotalAtivosBreakdown(false);
    setShowNaoPagosBreakdown(false);
  }, [selectedMonth, selectedYear]);

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800 text-white">
        {/* Vídeo (topo da página de assinantes) */}
        <div className="mb-4 sm:mb-6">
          <div className="rounded-xl overflow-hidden border border-gray-700 bg-black">
            <div className="relative w-full max-w-[380px] sm:max-w-none mx-auto h-0 pb-[177.78%] sm:pb-[56.25%]">
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/JZD4R2f0mLM"
                title="Vídeo - Meus Assinantes"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-gray-300">
            Se preferir, abra no YouTube.{' '}
            <a
              href="https://www.youtube.com/watch?v=JZD4R2f0mLM"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 underline font-semibold"
            >
              Abrir video
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Resumo de Assinaturas</h2>

          {/* Seletor de Mês/Ano */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={goToPreviousMonth}
              className="px-3 py-1.5 bg-[#2a2b2c] hover:bg-[#3a3b3c] text-white rounded-lg transition-colors text-sm font-medium"
              title="Mês anterior"
            >
              ←
            </button>

            <div className="flex items-center gap-2 bg-[#2a2b2c] px-3 py-1.5 rounded-lg">
              <span className="text-sm sm:text-base font-medium text-white">
                {monthNames[selectedMonth]} {selectedYear}
              </span>
            </div>

            <button
              onClick={goToNextMonth}
              className="px-3 py-1.5 bg-[#2a2b2c] hover:bg-[#3a3b3c] text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Próximo mês"
              disabled={selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear()}
            >
              →
            </button>

            {!isCurrentMonth && (
              <button
                onClick={goToCurrentMonth}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
                title="Voltar ao mês atual"
              >
                Hoje
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="text-center sm:text-left rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-2">
            <p className="text-xs sm:text-sm text-gray-300">Bruto (ativos pagos):</p>
            <p className="text-lg sm:text-2xl font-bold text-green-400">{fmtBRL(brutoAtivo)}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowLiquidoAtivoBreakdown((prev) => !prev)}
            className="text-center sm:text-left rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-2 transition-colors hover:bg-blue-500/10"
            title="Clique para ver quem compõe o Líquido (ativos pagos)"
          >
            <p className="text-xs sm:text-sm text-gray-300">Líquido (ativos pagos):</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-400">{fmtBRL(liquidoAtivo)}</p>
            <p className="text-[11px] text-blue-200/80 mt-1">
              {showLiquidoAtivoBreakdown ? 'Ocultar lista' : 'Clique para ver lista'}
            </p>
          </button>
          <div className="text-center sm:text-left rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-2">
            <p className="text-xs sm:text-sm text-emerald-200 font-semibold">Entradas do mês:</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-300">{fmtBRL(emContaEntradasMes)}</p>
            <p className="text-[11px] text-emerald-200/80 mt-1">Pagamentos de assinatura no período</p>
          </div>
          <div className="text-center sm:text-left rounded-lg border border-rose-500/30 bg-rose-500/5 px-2 py-2">
            <p className="text-xs sm:text-sm text-rose-200 font-semibold">Pagamentos abatidos:</p>
            <p className={`text-lg sm:text-2xl font-bold ${emContaSaidasMes >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {emContaSaidasMes >= 0 ? '- ' : '+ '}{fmtBRL(Math.abs(emContaSaidasMes))}
            </p>
            <p className="text-[11px] text-rose-200/80 mt-1">Saídas líquidas (pagamentos - estornos)</p>
          </div>
          <button
            type="button"
            onClick={() => setShowEmContaBreakdown((prev) => !prev)}
            className="text-center sm:text-left rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-2 transition-colors hover:bg-emerald-500/10"
            title="Clique para ver quem compõe o Em conta"
          >
            <p className="text-xs sm:text-sm text-emerald-300 font-semibold">Em conta (mês, após pagamentos):</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-300">{fmtBRL(emContaMes)}</p>
            <p className="text-[11px] text-emerald-200/80 mt-1">
              {showEmContaBreakdown ? 'Ocultar lista' : 'Clique para ver lista'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setShowTotalAtivosBreakdown((prev) => !prev)}
            className="text-center sm:text-left rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-2 py-2 transition-colors hover:bg-indigo-500/10"
            title="Clique para ver a lista de assinantes ativos"
          >
            <p className="text-xs sm:text-sm text-gray-300">Total de assinantes ativos:</p>
            <p className="text-lg sm:text-2xl font-bold text-primary">{totalAssinantes}</p>
            <p className="text-[11px] text-indigo-200/80 mt-1">
              {showTotalAtivosBreakdown ? 'Ocultar lista' : 'Clique para ver lista'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setShowNaoPagosBreakdown((prev) => !prev)}
            className="text-center sm:text-left rounded-lg border border-rose-500/30 bg-rose-500/5 px-2 py-2 transition-colors hover:bg-rose-500/10"
            title="Clique para ver a lista de não pagos"
          >
            <p className="text-xs sm:text-sm text-gray-300">Não pagos (ativos + vencidos):</p>
            <p className="text-lg sm:text-2xl font-bold text-red-400">{assinantesNaoPagos}</p>
            <p className="text-[11px] text-rose-200/80 mt-1">
              {showNaoPagosBreakdown ? 'Ocultar lista' : 'Clique para ver lista'}
            </p>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Fórmula do Em conta: <span className="text-emerald-300 font-semibold">{fmtBRL(emContaEntradasMes)}</span> - <span className="text-rose-300 font-semibold">{fmtBRL(emContaSaidasMes)}</span> = <span className="text-cyan-300 font-semibold">{fmtBRL(emContaMes)}</span>
        </p>

        {showLiquidoAtivoBreakdown && (
          <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm sm:text-base font-bold text-blue-200">
                Composição do Líquido (ativos pagos)
              </h3>
              <span className="text-xs text-blue-200/80">
                Total: {fmtBRL(liquidoAtivo)}
              </span>
            </div>
            {liquidoAtivoBreakdown.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-300">
                Nenhum assinante ativo e pago encontrado.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {liquidoAtivoBreakdown.map((item) => (
                  <div key={item.id} className="rounded-md border border-blue-500/20 bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.clientName}</p>
                        <p className="text-xs text-gray-300 truncate">
                          {item.planName}
                          {item.endDate && !Number.isNaN(item.endDate.getTime()) ? ` • Vence em ${format(item.endDate, 'dd/MM/yyyy')}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-extrabold text-blue-300 whitespace-nowrap">{fmtBRL(item.liquido)}</p>
                    </div>
                    <p className="text-[11px] text-blue-200/70 mt-1">Bruto: {fmtBRL(item.bruto)} • Líquido: {fmtBRL(item.liquido)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showEmContaBreakdown && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm sm:text-base font-bold text-emerald-200">
                Composição do Em conta ({monthNames[selectedMonth]} {selectedYear})
              </h3>
              <span className="text-xs text-emerald-200/80">
                Total: {fmtBRL(emContaMes)}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-emerald-500/20 bg-black/20 px-2 py-1.5">
                <span className="text-gray-300">Entradas</span>
                <p className="text-emerald-300 font-bold">{fmtBRL(emContaEntradasMes)}</p>
              </div>
              <div className="rounded border border-rose-500/20 bg-black/20 px-2 py-1.5">
                <span className="text-gray-300">Pagamentos aos profissionais</span>
                <p className={`font-bold ${emContaSaidasMes >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {emContaSaidasMes >= 0 ? '- ' : '+ '}{fmtBRL(Math.abs(emContaSaidasMes))}
                </p>
              </div>
              <div className="rounded border border-cyan-500/20 bg-black/20 px-2 py-1.5">
                <span className="text-gray-300">Em conta final</span>
                <p className="text-cyan-300 font-bold">{fmtBRL(emContaMes)}</p>
              </div>
            </div>

            {emContaBreakdown.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-300">
                Nenhum pagamento de assinatura encontrado neste mês.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {emContaBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-emerald-500/20 bg-black/20 px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.clientName}</p>
                      <p className="text-xs text-gray-300 truncate">
                        {item.planName} • {item.typeLabel} • {format(item.paymentDate, 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-300 whitespace-nowrap">
                      {fmtBRL(item.value)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {professionalPayments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-rose-500/20">
                <p className="text-xs sm:text-sm text-rose-200 font-semibold mb-2">
                  Pagamentos que foram abatidos deste mês
                </p>
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                  {professionalPayments.map((payment: any, index: number) => (
                    <div
                      key={String(payment.id || `${payment.professional_name || 'payment'}-${index}`)}
                      className="rounded-md border border-rose-500/20 bg-black/20 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {String(payment.professional_name || 'Profissional')}
                        </p>
                        <p className="text-xs text-gray-300 truncate">
                          {(() => {
                            const dt = new Date(String(payment.payment_date || ''));
                            if (Number.isNaN(dt.getTime())) return 'Data inválida';
                            return format(dt, 'dd/MM/yyyy HH:mm');
                          })()}
                        </p>
                      </div>
                      <p className={`text-sm font-extrabold whitespace-nowrap ${Number(payment.amount || 0) >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {Number(payment.amount || 0) >= 0 ? '- ' : '+ '}{fmtBRL(Math.abs(Number(payment.amount || 0)))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showTotalAtivosBreakdown && (
          <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm sm:text-base font-bold text-indigo-200">
                Lista de assinantes ativos
              </h3>
              <span className="text-xs text-indigo-200/80">
                Total: {totalAssinantes}
              </span>
            </div>
            {totalAtivosBreakdown.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-300">
                Nenhum assinante ativo encontrado.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {totalAtivosBreakdown.map((item) => (
                  <div key={item.id} className="rounded-md border border-indigo-500/20 bg-black/20 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.clientName}</p>
                      <p className="text-xs text-gray-300 truncate">
                        {item.planName} • {item.paymentStatus === 'paid' ? 'Pago' : 'Não pago'}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-indigo-300 whitespace-nowrap">{fmtBRL(item.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showNaoPagosBreakdown && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm sm:text-base font-bold text-rose-200">
                Lista de não pagos (ativos + vencidos)
              </h3>
              <span className="text-xs text-rose-200/80">
                Total: {assinantesNaoPagos}
              </span>
            </div>
            {naoPagosBreakdown.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-300">
                Nenhum assinante não pago encontrado.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {naoPagosBreakdown.map((item) => (
                  <div key={item.id} className="rounded-md border border-rose-500/20 bg-black/20 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.clientName}</p>
                      <p className="text-xs text-gray-300 truncate">
                        {item.planName} • {item.bucket}
                      </p>
                      <p className="text-[11px] text-rose-200/80 mt-1">
                        {item.reminderCount} cobrança{item.reminderCount === 1 ? '' : 's'} feita{item.reminderCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-sm font-extrabold text-rose-300 whitespace-nowrap">{fmtBRL(item.value)}</p>
                      <button
                        type="button"
                        onClick={() => {
                          const cs = clientSubscriptionById.get(item.id);
                          if (!cs) {
                            toast.error('Não foi possível localizar este assinante para enviar cobrança.');
                            return;
                          }
                          handleSendBillingReminder(cs);
                        }}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                        title="Enviar cobrança por WhatsApp"
                      >
                        💬 Enviar cobrança
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saldo + Sacar (assinantes) */}
        {shouldShowSubscribersBalanceCard && (
          <div className="mt-4 rounded-lg border border-green-500/20 bg-black/20 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs text-gray-300">Saldo (assinantes)</div>
              <div className="text-xl font-extrabold text-green-200">{fmtBRL(saldoAssinantes)}</div>
              <div className="mt-1 text-[11px] text-gray-300/80">
                * PIX líquido do mês (R$1,00 + taxa por pagamento) - pagamentos de profissionais no mês.
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={isRefreshingSaldoAssinantes}
                onClick={handleRefreshSaldoAssinantes}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Atualizar
              </button>
              <button
                type="button"
                disabled={isRefreshingSaldoAssinantes || saldoAssinantes <= 0}
                onClick={() => {
                  if (saldoAssinantes <= 0) {
                    toast.error('Seu saldo de assinantes está zerado.');
                    return;
                  }
                  const whatsappNumber = '5548991265320';
                  const message = `Quero sacar meu valor (assinantes): ${fmtBRL(saldoAssinantes)}\nEstabelecimento: ${String(establishmentId)}`;
                  openWhatsAppWithBusinessPriority(whatsappNumber, message);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Sacar
              </button>
            </div>
          </div>
        )}

        {/* Controle por Profissional */}
        {(subscriberAttendances.length > 0 || subscriptionSaleCommissions.length > 0) && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Controle por Profissional</h3>
            <div className="space-y-3">
              {Object.entries(
                (() => {
                  const acc: {
                    [key: string]: {
                      totalValue: number;
                      pointsFromAttendances: number;
                      attendanceCount: number;
                      uniqueClientIds: Set<string>;
                      saleCommissionCount: number;
                    };
                  } = {};

                  subscriberAttendances.forEach((attendance: any) => {
                    const professional = String(attendance.professional_name || '').trim() || 'Profissional';
                    if (!acc[professional]) {
                      acc[professional] = {
                        totalValue: 0,
                        pointsFromAttendances: 0,
                        attendanceCount: 0,
                        uniqueClientIds: new Set<string>(),
                        saleCommissionCount: 0,
                      };
                    }
                    acc[professional].totalValue += getAttendanceEffectiveRepass(attendance);
                    acc[professional].attendanceCount += 1;

                    const clientSubId = String(attendance.client_subscription_id || '');
                    if (clientSubId) {
                      acc[professional].uniqueClientIds.add(clientSubId);
                      if (isClientSubscriptionPointsMode(clientSubId)) {
                        acc[professional].pointsFromAttendances += 1;
                      }
                    }
                  });

                  subscriptionSaleCommissions.forEach((item: any) => {
                    const professional = String(item.professional_name || '').trim() || 'Profissional';
                    if (!acc[professional]) {
                      acc[professional] = {
                        totalValue: 0,
                        pointsFromAttendances: 0,
                        attendanceCount: 0,
                        uniqueClientIds: new Set<string>(),
                        saleCommissionCount: 0,
                      };
                    }
                    acc[professional].totalValue += parseFloat(item.commission_amount) || 0;
                    acc[professional].saleCommissionCount += 1;
                  });

                  // Transformar em objeto simples para o Object.entries sem perder os Sets
                  // (Sets seguem existindo dentro do objeto, só não fazemos JSON/stringify)
                  return acc as any;
                })()
              ).map(([professional, info]) => {
                const isOwnerProfessional = isOwnerProfessionalByName(professional);
                const totalValue = (info as any)?.totalValue || 0;
                const pointsFromAttendances = (info as any)?.pointsFromAttendances || 0;
                const attendanceCount = (info as any)?.attendanceCount || 0;
                const uniqueClientsCount = (info as any)?.uniqueClientIds?.size || 0;
                const saleCommissionCount = (info as any)?.saleCommissionCount || 0;
                const clientIdsForLabels = Array.from((info as any)?.uniqueClientIds || []) as string[];
                const clientRowsForList = clientIdsForLabels.map((cid) => {
                  const name = clientNameBySubIdMap.get(cid) || 'Cliente';
                  if (!isClientSubscriptionPointsMode(cid)) return { cid, label: name };
                  const cs = (clientSubscriptions || []).find((c: any) => String(c?.id) === String(cid));
                  const monthly = cs ? getSubscriptionValue(cs as ClientSubscription) : 0;
                  return { cid, label: `${name} (mensalidade ${fmtBRL(monthly)})` };
                });
                const preview = clientRowsForList
                  .slice(0, 3)
                  .map((r) => r.label)
                  .join(', ');
                const remaining = Math.max(0, clientRowsForList.length - 3);

                // Calcular total pago para este profissional no mês atual
                // IMPORTANTE: Considerar apenas pagamentos feitos via assinatura (payment_source = 'subscription')
                // Pagamentos do dashboard financeiro (payment_source = 'normal' ou NULL) NÃO devem entrar aqui
                const totalPaid = professionalPayments
                  .filter(p =>
                    p.professional_name === professional &&
                    p.payment_source === 'subscription' // Só pagamentos via assinatura
                  )
                  .reduce((sum, p) => sum + (p.amount || 0), 0);

                // Valor pendente = total acumulado - total pago
                const pendingValue = isOwnerProfessional ? 0 : Math.max(0, totalValue - totalPaid);

                return (
                  <div key={professional} className="flex justify-between items-center bg-[#2a2b2c] rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{professional}</p>
                      {isOwnerProfessional && (
                        <p className="text-[11px] text-emerald-400 mt-0.5">
                          Dono (100%): não gera pagamento para si mesmo no controle de assinaturas.
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        Valor total acumulado de {monthNames[selectedMonth]} {selectedYear}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Atendimentos: <span className="text-white font-semibold">{attendanceCount}</span>
                        {' '}• Assinantes atendidos: <span className="text-white font-semibold">{uniqueClientsCount}</span>
                        {pointsFromAttendances > 0 ? (
                          <>
                            {' '}• <span className="text-amber-200 font-semibold">{pointsFromAttendances} ponto(s)</span>
                            <span className="text-gray-500"> (repasse 0% sem dividir valor)</span>
                          </>
                        ) : null}
                        {saleCommissionCount > 0 ? (
                          <>
                            {' '}• Vendas (bônus): <span className="text-white font-semibold">{saleCommissionCount}</span>
                          </>
                        ) : null}
                      </p>
                      {clientRowsForList.length > 0 && (
                        <>
                          {clientRowsForList.length <= 3 ? (
                            <p className="text-[11px] text-gray-500 mt-1">
                              Clientes:{' '}
                              <span className="text-gray-300">
                                {clientRowsForList.map((r) => r.label).join(', ')}
                              </span>
                            </p>
                          ) : (
                            <details className="mt-1">
                              <summary className="text-[11px] text-gray-500 cursor-pointer select-none">
                                Clientes: <span className="text-gray-300">{preview}{remaining > 0 ? ` +${remaining}` : ''}</span>{' '}
                                <span className="text-gray-500">(ver lista)</span>
                              </summary>
                              <div className="mt-2 max-h-24 overflow-y-auto pr-1">
                                <ul className="space-y-0.5">
                                  {[...clientRowsForList]
                                    .sort((a, b) => a.label.localeCompare(b.label))
                                    .map((row) => (
                                      <li key={row.cid} className="text-[11px] text-gray-300">
                                        {row.label}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {pointsFromAttendances > 0 && totalValue <= 0 && saleCommissionCount === 0 ? (
                          <>
                            <p className="text-lg font-bold text-amber-300">{pointsFromAttendances} ponto(s)</p>
                            <p className="text-[10px] text-gray-500 max-w-[10rem] ml-auto leading-tight">
                              Sem repasse em R$ neste modo; feche valores no fim do mês conforme a política da equipe.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className={`text-lg font-bold ${pendingValue > 0 ? 'text-green-400' : pointsFromAttendances > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                              {pendingValue > 0 || totalValue > 0 || saleCommissionCount > 0
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingValue)
                                : pointsFromAttendances > 0
                                  ? `${pointsFromAttendances} ponto(s)`
                                  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingValue)}
                            </p>
                            {pointsFromAttendances > 0 && (totalValue > 0 || saleCommissionCount > 0) && (
                              <p className="text-xs text-amber-200/90">+ {pointsFromAttendances} ponto(s)</p>
                            )}
                          </>
                        )}
                        {totalPaid > 0 && (
                          <p className="text-xs text-gray-500 line-through">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                          </p>
                        )}
                      </div>
                      {pendingValue > 0 && (
                        <>
                          <button
                            onClick={() => handlePayProfessional(professional, pendingValue)}
                            className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded transition-colors"
                          >
                            Pagar
                          </button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          setSelectedProfessionalForHistory(professional);
                          const history = await fetchProfessionalPaymentHistory(professional);
                          setProfessionalPaymentHistory(history);
                          setShowHistoryModal(true);
                        }}
                        className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded transition-colors"
                      >
                        Histórico
                      </button>
                      <button
                        onClick={() => handleDeleteProfessionalFromControl(professional)}
                        className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded transition-colors flex items-center gap-1"
                        title={`Apagar todos os registros deste profissional de ${monthNames[selectedMonth]} ${selectedYear}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Apagar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Configurações de Agendamento para Assinantes */}
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800 text-white">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Configurações de Agendamento</h2>
        <div className="space-y-3 sm:space-y-4">

          {/* Primeira opção - Layout melhorado para mobile */}
          <div className="bg-[#2a2b2c] rounded-lg border border-gray-600 overflow-hidden">
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-white mb-2 leading-tight">
                    Limitar agendamentos de assinantes
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    Se ativada, os assinantes só poderão agendar dentro da mesma semana.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Exemplo: Se hoje é sexta-feira, o assinante só poderá agendar até domingo.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={limitSubscriberBookings}
                      onChange={(e) => handleUpdateSubscriberBookingLimit(e.target.checked)}
                      disabled={isUpdatingLimit}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>
            </div>

            {isUpdatingLimit && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  <span className="text-xs sm:text-sm">Atualizando configuração...</span>
                </div>
              </div>
            )}
          </div>

          {/* Segunda opção - Layout melhorado para mobile */}
          <div className="bg-[#2a2b2c] rounded-lg border border-gray-600 overflow-hidden">
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-white mb-2 leading-tight">
                    Clientes assinantes não podem desmarcar e remarcar no mesmo dia
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    Se ativada, quando um assinante cancelar um agendamento, não poderá remarcar para o mesmo dia.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Exemplo: Se hoje é terça-feira e o assinante desmarcou, não poderá remarcar na terça-feira.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preventSameDayReschedule}
                      onChange={(e) => handleUpdatePreventSameDayReschedule(e.target.checked)}
                      disabled={isUpdatingSameDayLimit}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>
            </div>

            {isUpdatingSameDayLimit && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  <span className="text-xs sm:text-sm">Atualizando configuração...</span>
                </div>
              </div>
            )}
          </div>

          {/* Terceira opção - 1 agendamento por semana */}
          <div className="bg-[#2a2b2c] rounded-lg border border-gray-600 overflow-hidden">
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-white mb-2 leading-tight">
                    1 agendamento na semana
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    Ao ativar essa opção seu cliente assinante só poderá fazer um agendamento na mesma semana. Ele ainda pode cancelar agendamento, só assim ele consegue agendar novamente na mesma semana nos respectivos dias do serviço.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Exemplo: Se o assinante já tem agendamento na semana, não pode fazer outro até cancelar o atual.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={limitSubscribersOneWeek}
                      onChange={(e) => handleUpdateOneWeekLimit(e.target.checked)}
                      disabled={isUpdatingOneWeekLimit}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>
            </div>

            {isUpdatingOneWeekLimit && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  <span className="text-xs sm:text-sm">Atualizando configuração...</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>


      {/* Criação de Assinatura */}
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <form onSubmit={handleCreateSubscription} className="space-y-4">
          <div>
            <label htmlFor="subscriptionName" className="block text-sm font-medium text-gray-400 mb-1">Nome da Assinatura</label>
            <input
              type="text"
              id="subscriptionName"
              value={newSubscriptionName}
              onChange={(e) => setNewSubscriptionName(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              placeholder="Ex: Plano Mensal, Assinatura VIP"
              required
            />
          </div>
          <div>
            <label htmlFor="subscriptionValue" className="block text-sm font-medium text-gray-400 mb-1">Valor da Assinatura (R$)</label>
            <input
              type="number"
              id="subscriptionValue"
              value={newSubscriptionValue}
              onChange={(e) => {
                const v = Number(e.target.value);
                const nextValue = Number.isFinite(v) ? v : 0;
                setNewSubscriptionValue(nextValue);
                // Regra: só pode definir % depois de definir o valor da assinatura
                if (nextValue <= 0) {
                  setNewPercentualComissaoDiaria(0);
                }
              }}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div>
            <label htmlFor="percentualComissaoDiaria" className="block text-sm font-medium text-gray-400 mb-1">
              Comissão por serviço diário dessa assinatura (%)
            </label>
            <input
              type="number"
              id="percentualComissaoDiaria"
              value={newPercentualComissaoDiaria}
              onChange={(e) => {
                const p = Number(e.target.value);
                const nextPercent = Number.isFinite(p) ? p : 0;
                // Limites defensivos
                setNewPercentualComissaoDiaria(Math.max(0, Math.min(100, nextPercent)));
              }}
              disabled={newSubscriptionValue <= 0}
              className={`w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500 ${newSubscriptionValue <= 0 ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              step="0.1"
              min="0"
              max="100"
              placeholder={newSubscriptionValue <= 0 ? 'Preencha o valor da assinatura primeiro' : 'Ex: 5, 10, 12.5'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {newSubscriptionValue <= 0
                ? 'Primeiro preencha o valor da assinatura para habilitar o percentual.'
                : (() => {
                  const valorComissao = Math.round((newSubscriptionValue * (newPercentualComissaoDiaria || 0) / 100) * 100) / 100;
                  const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorComissao);
                  return `Isso dá ${valorFormatado} por serviço diário (calculado em cima do valor da assinatura).`;
                })()}
            </p>
          </div>

          {/* ✅ Nova configuração da assinatura: Dividir valor total */}
          <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <input
                type="checkbox"
                checked={newDivideTotalEnabled}
                onChange={(e) => setNewDivideTotalEnabled(e.target.checked)}
              />
              👉 Dividir valor total
            </label>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Se ativar, o sistema divide o valor líquido da assinatura pela quantidade de atendimentos e só depois aplica o repasse do profissional.
            </p>
            <div className="mt-2">
              <label className="block text-xs text-gray-400 mb-1">Qtd. atendimentos da assinatura</label>
              <input
                type="number"
                min={1}
                step={1}
                value={newDivideTotalAttendances}
                onChange={(e) => setNewDivideTotalAttendances(e.target.value)}
                disabled={!newDivideTotalEnabled}
                className={`w-full px-3 py-2 bg-black/30 rounded-lg border border-white/10 text-white focus:outline-none focus:border-gray-500 ${!newDivideTotalEnabled ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                placeholder="Ex: 4"
              />
            </div>
          </div>
          <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              👉 Serviços oferecidos na assinatura <span className="text-amber-300 text-xs">(obrigatório)</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              O assinante escolherá 1 ou mais serviços desta lista no booking. Preencha nome, duração e limite de cada serviço.
            </p>
            <div className="mt-3 space-y-3">
              {newDividedServices.map((service, index) => (
                <div key={service.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-300 font-semibold">Serviço {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => setNewDividedServices((prev) => prev.filter((item) => item.id !== service.id))}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={service.name}
                      onChange={(e) =>
                        setNewDividedServices((prev) =>
                          prev.map((item) => (item.id === service.id ? { ...item, name: e.target.value } : item))
                        )
                      }
                      placeholder="Nome do serviço"
                      className="w-full px-3 py-2 bg-[#111213] rounded-lg border border-white/10 text-white focus:outline-none focus:border-gray-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Tempo (minutos)</label>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={service.duration}
                          onChange={(e) =>
                            setNewDividedServices((prev) =>
                              prev.map((item) => (item.id === service.id ? { ...item, duration: Number(e.target.value || 0) } : item))
                            )
                          }
                          placeholder="Ex: 30"
                          className="w-full px-3 py-2 bg-[#111213] rounded-lg border border-white/10 text-white focus:outline-none focus:border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Limite de atendimentos</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={service.limit}
                          onChange={(e) =>
                            setNewDividedServices((prev) =>
                              prev.map((item) => (item.id === service.id ? { ...item, limit: Number(e.target.value || 0) } : item))
                            )
                          }
                          placeholder="Ex: 4"
                          className="w-full px-3 py-2 bg-[#111213] rounded-lg border border-white/10 text-white focus:outline-none focus:border-gray-500"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Tempo = duração do serviço no agendamento. Limite = quantas vezes esse serviço pode ser usado na assinatura.
                    </p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNewDividedServices((prev) => [...prev, createEmptyDividedService()])}
                className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm text-gray-200 hover:bg-white/5 transition-colors"
              >
                + Adicionar serviço
              </button>
            </div>
          </div>
          <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-white">🏷️ Etiqueta</p>
              <button
                type="button"
                onClick={() => setNewSubscriptionLabelColor('')}
                className="text-xs text-gray-300 hover:text-white"
              >
                Limpar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {subscriptionLabelPalette.map((color) => {
                const selected = newSubscriptionLabelColor === color;
                return (
                  <button
                    key={`new-subscription-color-${color}`}
                    type="button"
                    onClick={() => setNewSubscriptionLabelColor(color)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${selected ? 'border-white scale-110' : 'border-white/30 hover:border-white/60'}`}
                    style={{ backgroundColor: color }}
                    title="Selecionar cor da etiqueta"
                  />
                );
              })}
            </div>
          </div>
          {!newDivideServicesEnabled && (
            <div>
              <label htmlFor="subscriptionDuration" className="block text-sm font-medium text-gray-400 mb-1">Duração do Serviço (minutos)</label>
              <select
                id="subscriptionDuration"
                value={newSubscriptionDuration}
                onChange={(e) => setNewSubscriptionDuration(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
                required
              >
                <option value={5}>5 minutos</option>
                <option value={10}>10 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={40}>40 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>1 hora</option>
                <option value={75}>1 hora e 15 minutos</option>
                <option value={90}>1 hora e 30 minutos</option>
                <option value={105}>1 hora e 45 minutos</option>
                <option value={120}>2 horas</option>
                <option value={135}>2 horas e 15 minutos</option>
                <option value={150}>2 horas e 30 minutos</option>
                <option value={165}>2 horas e 45 minutos</option>
                <option value={180}>3 horas</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Dias da Semana</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'monday', label: 'Segunda-feira' },
                { value: 'tuesday', label: 'Terça-feira' },
                { value: 'wednesday', label: 'Quarta-feira' },
                { value: 'thursday', label: 'Quinta-feira' },
                { value: 'friday', label: 'Sexta-feira' },
                { value: 'saturday', label: 'Sábado' },
                { value: 'sunday', label: 'Domingo' }
              ].map((day) => (
                <label key={day.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSubscriptionWeekdays.includes(day.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewSubscriptionWeekdays([...newSubscriptionWeekdays, day.value]);
                      } else {
                        setNewSubscriptionWeekdays(newSubscriptionWeekdays.filter(d => d !== day.value));
                      }
                    }}
                    className="w-4 h-4 text-gray-700 bg-[#2a2b2c] border-gray-600 rounded focus:ring-gray-500"
                  />
                  <span className="text-sm text-gray-300">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="subscriptionDescription" className="block text-sm font-medium text-gray-400 mb-1">
              Descrição (opcional - até 150 caracteres)
            </label>
            <textarea
              id="subscriptionDescription"
              value={newSubscriptionDescription}
              onChange={(e) => setNewSubscriptionDescription(e.target.value)}
              placeholder="Ex: Essa assinatura inclui cortes ilimitados durante o mês."
              maxLength={150}
              rows={3}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
            />
            <p className="text-xs text-gray-500 mt-1">
              {newSubscriptionDescription.length}/150 caracteres
            </p>
          </div>
          <button type="submit" className="btn-primary w-full">
            <Plus className="h-5 w-5 mr-2" /> Criar Assinatura
          </button>
        </form>
      </div>

      {/* Lista de Tipos de Assinatura */}
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <h2 className="text-xl font-semibold mb-4">Tipos de Assinatura Criados</h2>

        {/* Vídeo (Tipos de Assinatura Criados) */}
        <div className="mb-4 sm:mb-6">
          <div className="rounded-xl overflow-hidden border border-gray-700 bg-black">
            <div className="relative w-full max-w-[380px] sm:max-w-none mx-auto h-0 pb-[177.78%] sm:pb-[56.25%]">
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/JZD4R2f0mLM"
                title="Vídeo - Tipos de Assinatura Criados"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-gray-300">
            Se preferir, abra no YouTube.{' '}
            <a
              href="https://www.youtube.com/watch?v=JZD4R2f0mLM"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 underline font-semibold"
            >
              Abrir video
            </a>
          </div>
        </div>

        {/* Título */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">Criar Novo Tipo de Assinatura</h3>

          {/* Opção Pagar.me (PIX manual) - Só mostrar se tiver recipient_id configurado */}
          {String(establishment?.pagarme_recipient_id || '').trim() && (
            <div
              className="relative overflow-hidden rounded-xl p-[1px] mb-5 shadow-[0_0_0_1px_rgba(34,197,94,0.18)]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(34,197,94,0.55), rgba(59,130,246,0.35), rgba(34,197,94,0.18))',
              }}
            >
              {/* brilho suave */}
              <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-green-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

              <div className="bg-[#0f1112] border border-white/10 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                      <span className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase bg-green-500/15 border border-green-500/30 text-green-200">
                        ⭐ Recomendado
                      </span>
                      <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                        Usar recorrência pagarme{' '}
                        <span className="text-green-200/90 font-extrabold">(taxas mais baixas)</span>
                      </p>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">
                      As taxas da Pagar.me são baixas: <span className="font-semibold">1,19% + R$1,00</span>.
                      <span className="font-semibold text-amber-200"> A cobrança recorrente mensal acontece apenas no Cartão de crédito.</span>
                      No PIX, o pagamento continua manual (sem cobrança automática).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const recipientId = String(establishment?.pagarme_recipient_id || '').trim();
                      if (!usePagarmeSubscriptionPix && !recipientId) {
                        toast.error('Você precisa criar e colocar seus dados de recebimento (Recebedor Pagar.me) nas Configurações.');
                        return;
                      }
                      handleUpdateUsePagarmeSubscriptionPix(!usePagarmeSubscriptionPix);
                    }}
                    disabled={
                      isUpdatingPagarmeSubscriptionPix ||
                      (!usePagarmeSubscriptionPix && !String(establishment?.pagarme_recipient_id || '').trim()) ||
                      !String(establishment?.pagarme_recipient_id || '').trim() // Desabilitar se não tiver recipient_id
                    }
                    className={`shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold transition-all border shadow-lg ${usePagarmeSubscriptionPix
                      ? 'bg-green-600 text-white border-green-500/40 hover:bg-green-700'
                      : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                      } ${(isUpdatingPagarmeSubscriptionPix || !String(establishment?.pagarme_recipient_id || '').trim()) ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-[0.98]'
                      }`}
                    title={
                      !String(establishment?.pagarme_recipient_id || '').trim()
                        ? 'Você precisa criar e colocar seus dados de recebimento (Recebedor Pagar.me) nas Configurações primeiro'
                        : !usePagarmeSubscriptionPix && !String(establishment?.pagarme_recipient_id || '').trim()
                          ? 'Você precisa criar e colocar seus dados de recebimento (Recebedor Pagar.me)'
                          : undefined
                    }
                  >
                    {usePagarmeSubscriptionPix ? 'ATIVADO' : 'ATIVAR'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Quando ativado, no Booking o botão <span className="text-gray-300 font-semibold">Assinar</span> abre o fluxo de pagamento da Pagar.me.
                  <span className="text-gray-300 font-semibold"> Cartão = recorrência mensal automática</span>; PIX = pagamento manual.
                  Quando desativado, mantém o comportamento atual (link da assinatura ou WhatsApp).
                </p>
              </div>
            </div>
          )}

          {/* Opção Mercado Pago (PIX manual) - sempre mostrar; se não conectado, orientar a conectar */}
          <div
            className="relative overflow-hidden rounded-xl p-[1px] mb-5 shadow-[0_0_0_1px_rgba(34,197,94,0.18)]"
            style={{
              background:
                'linear-gradient(135deg, rgba(34,197,94,0.55), rgba(59,130,246,0.35), rgba(34,197,94,0.18))',
            }}
          >
            {/* brilho suave */}
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-green-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

            <div className="bg-[#0f1112] border border-white/10 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                    <span className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase bg-green-500/15 border border-green-500/30 text-green-200">
                      ⭐ Recomendado
                    </span>
                    <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                      Usar recorrência Mercado Pago{' '}
                      <span className="text-green-200/90 font-extrabold">(taxas mais baixas)</span>
                    </p>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    As taxas do Mercado Pago são baixas: <span className="font-semibold">0.99% (PIX) + R$1,00</span> da plataforma.
                  </p>
                  <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                    <span className="font-semibold text-amber-200">No cartão para assinatura mensal, o sistema cria recorrência oficial (Preapproval) do Mercado Pago.</span>{' '}
                    Se a conta conectada não tiver permissão para recorrência, o sistema mostra aviso claro para reconectar o Mercado Pago e ativar permissões de Assinaturas/Preapproval.
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    No PIX, o pagamento continua <span className="font-semibold">manual</span> (sem cobrança automática).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const accessToken = String(establishment?.mercadopago_access_token || '').trim();
                    if (!useMercadoPagoSubscriptionPix && !accessToken) {
                      toast.error('Você precisa conectar sua conta do Mercado Pago nas Configurações para ativar.');
                      return;
                    }
                    handleUpdateUseMercadoPagoSubscriptionPix(!useMercadoPagoSubscriptionPix);
                  }}
                  disabled={
                    isUpdatingMercadoPagoSubscriptionPix
                  }
                  className={`shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold transition-all border shadow-lg ${useMercadoPagoSubscriptionPix
                    ? 'bg-green-600 text-white border-green-500/40 hover:bg-green-700'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                    } ${isUpdatingMercadoPagoSubscriptionPix ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-[0.98]'
                    }`}
                  title={
                    !useMercadoPagoSubscriptionPix && !String(establishment?.mercadopago_access_token || '').trim()
                      ? 'Você precisa conectar sua conta do Mercado Pago nas Configurações'
                      : undefined
                  }
                >
                  {useMercadoPagoSubscriptionPix ? 'ATIVADO' : 'ATIVAR'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Quando ativado, no Booking o botão <span className="text-gray-300 font-semibold">Assinar</span> abre o fluxo de pagamento do Mercado Pago.
                <span className="text-gray-300 font-semibold"> Cartão (assinatura mensal)</span>: recorrência automática oficial.
                <span className="text-gray-300 font-semibold"> PIX</span>: sempre manual.
                Quando desativado, mantém o comportamento atual (link da assinatura ou WhatsApp).
              </p>
              {!useMercadoPagoSubscriptionPix && !String(establishment?.mercadopago_access_token || '').trim() && (
                <p className="text-xs text-yellow-200/90 mt-2">
                  ⚠️ Para ativar essa opção, você precisa <span className="font-semibold">conectar sua conta do Mercado Pago</span> nas Configurações.
                </p>
              )}
            </div>
          </div>

          {/* Mostrar assinaturas por completo no Booking */}
          <div
            className="relative overflow-hidden rounded-xl p-[1px] mb-5 shadow-[0_0_0_1px_rgba(99,102,241,0.20)]"
            style={{
              background:
                'linear-gradient(135deg, rgba(99,102,241,0.55), rgba(34,197,94,0.22), rgba(99,102,241,0.18))',
            }}
          >
            <div className="bg-[#0f1112] border border-white/10 rounded-xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                    Mostrar assinaturas toda na pagina
                  </p>
                  <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                    ao ativar essa opção seu sistema ficara igual da foto ao lado suas assinaturas ficaram aparecendo na tela por completo sem
                    necessidade de clicar em ( PLANOS MENSAIS) para ver as assinatura mas sim tera escrito encima planos mensais e as assinaturas
                    abaixo já todas
                  </p>

                  {/* Prévia (mobile/tablet) */}
                  <div className="mt-3 lg:hidden">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-2 overflow-hidden">
                      <img
                        src="/planos67.png"
                        alt="Prévia - Planos mensais no booking"
                        className="w-full h-auto rounded-lg object-contain max-h-[240px] mx-auto"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 w-full lg:w-[420px]">
                  {/* Prévia (PC) */}
                  <div className="hidden lg:block mb-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-2 overflow-hidden">
                      <img
                        src="/planos67.png"
                        alt="Prévia - Planos mensais no booking"
                        className="w-full h-auto rounded-lg object-contain max-h-[220px] mx-auto"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateShowSubscriptionsFullpage(!showSubscriptionsFullpage)}
                    disabled={isUpdatingShowSubscriptionsFullpage}
                    className={`w-full px-5 py-2.5 rounded-xl font-extrabold transition-all border shadow-lg ${showSubscriptionsFullpage
                      ? 'bg-indigo-600 text-white border-indigo-500/40 hover:bg-indigo-700'
                      : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                      } ${isUpdatingShowSubscriptionsFullpage ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-[0.98]'
                      }`}
                    title={showSubscriptionsFullpage ? 'Desativar' : 'Ativar'}
                  >
                    {showSubscriptionsFullpage ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {subscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum tipo de assinatura criado ainda.</p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className={`p-3 rounded-lg ${sub.is_hidden ? 'bg-[#2a2520] border-yellow-700/50' : 'bg-[#242628] border-gray-700'} border flex justify-between items-center ${sub.is_hidden ? 'opacity-75' : ''}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-lg">{sub.name}</p>
                    {sub.is_hidden && (
                      <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-500 text-xs rounded-full border border-yellow-600/30">
                        👁️ Oculta
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.value)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSubscriptionPaymentMethod(sub.id, 'pix')}
                      className={`px-2.5 py-1 rounded-md text-xs font-extrabold border transition-colors ${isSubscriptionPixEnabled(sub)
                          ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                          : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                        }`}
                      title={isSubscriptionPixEnabled(sub) ? 'Desativar PIX nesta assinatura' : 'Ativar PIX nesta assinatura'}
                    >
                      PIX {isSubscriptionPixEnabled(sub) ? 'ATIVO' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSubscriptionPaymentMethod(sub.id, 'card')}
                      className={`px-2.5 py-1 rounded-md text-xs font-extrabold border transition-colors ${isSubscriptionCardEnabled(sub)
                          ? 'bg-sky-600/20 border-sky-500/40 text-sky-300 hover:bg-sky-600/30'
                          : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                        }`}
                      title={isSubscriptionCardEnabled(sub) ? 'Desativar Cartão nesta assinatura' : 'Ativar Cartão nesta assinatura'}
                    >
                      Cartão {isSubscriptionCardEnabled(sub) ? 'ATIVO' : 'OFF'}
                    </button>
                  </div>
                  {Boolean((sub as any)?.divide_services_enabled) && (
                    <p className="text-emerald-300 text-xs mt-1">
                      ✂️ Serviços oferecidos na assinatura ({parseDividedServices((sub as any)?.divided_services).length} serviço(s))
                    </p>
                  )}
                  {sub.weekdays && sub.weekdays.length > 0 && (
                    <p className="text-gray-400 text-xs mt-1">
                      📅 {sub.weekdays.map(day => {
                        const dayNames = {
                          'monday': 'Seg',
                          'tuesday': 'Ter',
                          'wednesday': 'Qua',
                          'thursday': 'Qui',
                          'friday': 'Sex',
                          'saturday': 'Sáb',
                          'sunday': 'Dom'
                        };
                        return dayNames[day as keyof typeof dayNames] || day;
                      }).join(', ')}
                    </p>
                  )}
                  {sub.is_hidden && (
                    <p className="text-gray-500 text-xs mt-1">
                      ⚠️ Não aparece no Booking para novos clientes
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col -my-1">
                    <button
                      type="button"
                      onClick={() => handleMoveSubscription(sub.id, 'up')}
                      disabled={subscriptions[0]?.id === sub.id}
                      className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors p-1"
                      title="Mover para cima"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSubscription(sub.id, 'down')}
                      disabled={subscriptions[subscriptions.length - 1]?.id === sub.id}
                      className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors p-1"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSubscriptionForEdit(sub);
                      setEditDescription(sub.description || '');
                      setEditName(sub.name || '');
                      setEditWeekdays(sub.weekdays || []);
                      setEditDuration(sub.service_duration || 30);
                      setEditSubscriptionValue(String(Number(sub.value || 0).toFixed(2)).replace('.', ','));
                      {
                        const fixed = Number((sub as any).fixed_commission_value || 0);
                        const base = Number(sub.value || 0);
                        const pct = base > 0 && fixed > 0 ? (fixed / base) * 100 : 0;
                        setEditRepassePercent(String(Math.round(pct * 100) / 100).replace('.', ','));
                      }
                      setEditDivideTotalEnabled(Boolean((sub as any)?.divide_total_enabled));
                      setEditDivideTotalAttendances(
                        Number.isFinite(Number((sub as any)?.divide_total_attendances)) && Number((sub as any)?.divide_total_attendances) > 0
                          ? String(Number((sub as any)?.divide_total_attendances))
                          : ''
                      );
                      const parsedOfferedServices = parseDividedServices((sub as any)?.divided_services);
                      setEditDivideServicesEnabled(true);
                      setEditDividedServices(
                        parsedOfferedServices.length > 0
                          ? parsedOfferedServices
                          : [buildDefaultOfferedServiceFromSubscription(sub)]
                      );
                      setEditSubscriptionLabelColor(String((sub as any)?.label_color || ''));
                      setShowEditDescriptionModal(true);
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                    title="Editar Assinatura"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSubscriptionPlanAuditLogs(sub)}
                    className="text-gray-600 hover:text-sky-400 transition-colors"
                    title="Histórico completo de alterações neste plano (data/hora/segundo e usuário quando disponível)"
                  >
                    <History className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSubscriptionForLinkEdit(sub);
                      setEditLink(sub.custom_link || '');
                      setShowEditLinkModal(true);
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                    title={sub.custom_link ? "Editar Meu Link" : "Adicionar Meu Link"}
                  >
                    🔗
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSubscriptionForCreditCardLinkEdit(sub);
                      setEditCreditCardLink((sub as any).credit_card_link || '');
                      setShowEditCreditCardLinkModal(true);
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                    title={(sub as any).credit_card_link ? "Editar Link cartão de crédito" : "Adicionar Link cartão de crédito"}
                  >
                    💳
                  </button>
                  <button
                    onClick={() => handleToggleHideSubscription(sub.id, sub.is_hidden || false)}
                    className={`${sub.is_hidden ? 'text-gray-600 hover:text-gray-800' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                    title={sub.is_hidden ? "Desocultar Assinatura (voltar a mostrar no Booking)" : "Ocultar Assinatura (não aparece no Booking para novos clientes)"}
                  >
                    {sub.is_hidden ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSubscription(sub.id)}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                    title="Deletar Assinatura"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar Assinante */}
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Adicionar Assinante</h2>
          <button
            onClick={() => setShowRecoveryModal(true)}
            className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            title="Recuperar clientes dos agendamentos"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Recuperar Clientes
          </button>
        </div>
        <form onSubmit={handleAddClientSubscription} className="space-y-4">
          <div>
            <label htmlFor="selectSubscription" className="block text-sm font-medium text-gray-400 mb-1">Escolher Serviço/Assinatura</label>
            <select
              id="selectSubscription"
              value={selectedSubscriptionToAdd}
              onChange={(e) => setSelectedSubscriptionToAdd(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 text-white focus:outline-none focus:border-gray-500"
              required
            >
              <option value="">Selecione uma assinatura</option>
              {subscriptions.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.value)})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="selectedClientToAdd" className="block text-sm font-medium text-gray-400 mb-1">
              Clientes da sua lista
            </label>
            <input
              type="text"
              id="selectedClientToAdd"
              value={selectedClientToAdd}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedClientToAdd(value);
                // Só preenche automaticamente quando o usuário realmente escolhe um item da lista
                tryApplySelectedKnownClient(value);
              }}
              list="knownClientsLookupList"
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              placeholder="Pesquisar cliente já cadastrado (opcional)"
            />
            <datalist id="knownClientsLookupList">
              {knownClientLookupItems.map((item) => (
                <option key={item.value} value={item.value} />
              ))}
            </datalist>
            <p className="text-xs text-gray-500 mt-1">
              Se selecionar um cliente da lista, nome/telefone/e-mail serão preenchidos automaticamente.
            </p>
          </div>
          <div>
            <label htmlFor="newClientName" className="block text-sm font-medium text-gray-400 mb-1">Nome do Cliente</label>
            <input
              type="text"
              id="newClientName"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              placeholder="Digite o nome do cliente"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Campo livre: você pode digitar o nome manualmente.
            </p>
          </div>
          <div>
            <label htmlFor="newClientPhone" className="block text-sm font-medium text-gray-400 mb-1">Número de Telefone</label>
            <input
              type="tel"
              id="newClientPhone"
              value={newClientPhone}
              onChange={(e) => setNewClientPhone(e.target.value)}
              onBlur={(e) => {
                const sanitized = normalizePhoneDigits(e.target.value);
                if (sanitized !== newClientPhone) {
                  setNewClientPhone(sanitized);
                }
              }}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              placeholder="Digite o número de telefone"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Campo livre: preencher aqui não altera nome/e-mail automaticamente.
            </p>
          </div>
          <div>
            <label htmlFor="newClientEmail" className="block text-sm font-medium text-gray-400 mb-1">E-mail (opcional)</label>
            <input
              type="email"
              id="newClientEmail"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              placeholder="Digite o e-mail do cliente (opcional)"
            />
          </div>
          <div>
            <label htmlFor="newSubscriberPaymentMethod" className="block text-sm font-medium text-gray-400 mb-1">Forma de Pagamento (opcional)</label>
            <select
              id="newSubscriberPaymentMethod"
              value={newSubscriberPaymentMethod}
              onChange={(e) => setNewSubscriberPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 text-white focus:outline-none focus:border-gray-500"
            >
              <option value="">Selecione (opcional)</option>
              {availablePaymentMethods.map((method) => (
                <option key={method} value={method}>
                  {getPaymentMethodLabel(method)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="newSubscriberProfessionalId" className="block text-sm font-medium text-gray-400 mb-1">
              Qual profissional vai atender esse cliente?
            </label>
            <select
              id="newSubscriberProfessionalId"
              value={newSubscriberProfessionalId}
              onChange={(e) => setNewSubscriberProfessionalId(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 text-white focus:outline-none focus:border-gray-500"
            >
              <option value="">Todos</option>
              {(professionals || []).map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="newSubscriberObservation" className="block text-sm font-medium text-gray-400 mb-1">Observação (opcional)</label>
            <textarea
              id="newSubscriberObservation"
              value={newSubscriberObservation}
              onChange={(e) => setNewSubscriberObservation(e.target.value.slice(0, 150))}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500 text-white resize-none"
              placeholder="Escreva uma observação (até 150 caracteres)"
              rows={3}
              maxLength={150}
            />
            <p className="text-xs text-gray-500 mt-1">
              {newSubscriberObservation.length}/150
            </p>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-400 mb-1">Data de Início</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              required
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-400 mb-1">Data de Término</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-gray-500"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            <Users className="h-5 w-5 mr-2" /> Adicionar Assinante
          </button>
        </form>
      </div>

      {/* Lista Meus Assinantes */}
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800 text-white">
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Meus Assinantes</h2>
        </div>

        {/* Barra de Pesquisa - Melhorada para mobile */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquisar assinantes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400 text-sm sm:text-base"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-xs text-gray-400 mt-1 sm:mt-2">
              {filteredClientSubscriptions.length} de {clientSubscriptions.length} assinante(s) encontrado(s)
            </p>
          )}
        </div>
        {clientSubscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum assinante cadastrado ainda.</p>
        ) : filteredClientSubscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum assinante encontrado para "{searchTerm}".</p>
        ) : (
          <div className="space-y-3">
            {filteredClientSubscriptions.map((cs) => {
              const isPaid = cs.payment_status === 'paid';
              const isExpired = isPastIsoDateSafe(cs.end_date);
              const baseLimit = Number((cs as any)?.monthly_limit || 0);
              const effectiveLimit = subscriberEffectiveLimitByClientSubId[String(cs.id)] ?? (Number.isFinite(baseLimit) && baseLimit > 0 ? baseLimit : null);
              const concludedCount = subscriberAttendanceCountsByClientSubId[String(cs.id)] || 0;

              // Lógica de status: vencido APENAS se data passou (independente do pagamento)
              const isVencido = isExpired;

              // Estilo visual baseado no status
              const cardBg = isVencido ? 'bg-red-800/90' : 'bg-green-600';
              const textColor = 'text-white';
              const borderStyle = isVencido ? 'border-red-500' : 'border-green-500';

              return (
                <div key={cs.id} className={`${cardBg} rounded-lg p-3 sm:p-4 w-full overflow-hidden border-2 ${borderStyle}`}>
                  {/* Nome do cliente */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold text-base sm:text-lg ${textColor} truncate`}>
                        {cs.profiles?.full_name || 'Cliente Desconhecido'}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(concludedCount > 0 || (effectiveLimit !== null && effectiveLimit > 0)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openAttendanceViewerForClient(cs, { kind: 'period' });
                            }}
                            className="bg-black/30 text-white text-xs px-2 py-1 rounded-full font-extrabold hover:bg-black/50 border border-white/10 cursor-pointer transition-colors"
                            title="Ver quais profissionais concluíram atendimentos no mês selecionado"
                          >
                            {effectiveLimit !== null && effectiveLimit > 0
                              ? `${concludedCount} de ${effectiveLimit}`
                              : `${concludedCount} concluído(s)`}
                          </button>
                        )}

                        {/* Meses anteriores (ex.: Fev 1) */}
                        {(() => {
                          const hist = subscriberAttendanceCountsHistoryByClientSubId[String(cs.id)] || {};
                          const items: { label: string; count: number; ym: string }[] = [];
                          const pad2 = (n: number) => String(n).padStart(2, '0');
                          const ymKey = (y: number, m0: number) => `${y}-${pad2(m0 + 1)}`;

                          // Mostrar até 3 meses anteriores com contagem > 0
                          for (let i = 1; i <= 3; i++) {
                            const d = new Date(selectedYear, selectedMonth - i, 1);
                            const y = d.getFullYear();
                            const m0 = d.getMonth();
                            const key = ymKey(y, m0);
                            const c = Number(hist[key] || 0);
                            if (Number.isFinite(c) && c > 0) {
                              const ab = monthAbbr[m0] || String(m0 + 1);
                              const suffix = y !== selectedYear ? `/${String(y).slice(-2)}` : '';
                              items.push({ label: `${ab}${suffix}`, count: c, ym: key });
                            }
                          }

                          if (!items.length) return null;
                          return (
                            <div className="flex items-center gap-1">
                              {items.map((it) => (
                                <button
                                  type="button"
                                  key={`${it.ym}-${it.count}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void openAttendanceViewerForClient(cs, { kind: 'month', ym: it.ym });
                                  }}
                                  className="bg-black/20 text-white/90 text-[11px] px-2 py-1 rounded-full font-bold border border-white/10 hover:bg-black/35 cursor-pointer transition-colors"
                                  title={`Ver profissionais — atendimentos em ${it.label}`}
                                >
                                  {it.label} {it.count}
                                </button>
                              ))}
                            </div>
                          );
                        })()}

                        {isVencido && (
                          <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                            VENCIDO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações do plano - Layout otimizado para mobile */}
                  <div className="space-y-2 mb-3">
                    <div className={`text-xs sm:text-sm ${textColor}/90 leading-relaxed`}>
                      {(() => {
                        const planValue = Number(cs.subscriptions?.value || cs.subscription_value || 0);
                        const paidValue = getSubscriptionValueForClient(cs);
                        const hasCustomValue = Number((cs as any)?.custom_subscription_value || 0) > 0;
                        const discountAmount = Math.max(0, planValue - paidValue);
                        return (
                          <>
                            <span className="font-medium">Plano:</span><br className="sm:hidden" />
                            <span className="sm:inline">{cs.subscriptions?.name || 'Plano não identificado'}</span><br className="sm:hidden" />
                            <span className="sm:inline sm:ml-1">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(planValue || 0)}</span>
                            <br />
                            <span className="font-medium">Valor pago:</span>{' '}
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidValue || 0)}</span>
                            {hasCustomValue && discountAmount > 0 && (
                              <span className="ml-1 text-emerald-200">
                                (desconto {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountAmount)})
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {String((cs as any)?.subscriber_payment_method || '').trim() && (
                      <div className={`text-xs sm:text-sm ${textColor}/90`}>
                        <span className="font-medium">Forma de Pagamento:</span>{' '}
                        {getPaymentMethodLabel(String((cs as any).subscriber_payment_method))}
                      </div>
                    )}
                    <div className={`text-xs sm:text-sm ${textColor}/90`}>
                      <span className="font-medium">Profissional para agendamento:</span>{' '}
                      {String((cs as any)?.subscriber_professional_name || '').trim() || 'Todos'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className={`${textColor}/90`}>
                        <span className="font-medium">Início:</span><br />
                        {formatIsoDateSafe(cs.start_date)}
                      </div>
                      <div className={`${textColor}/90`}>
                        <span className="font-medium">Fim:</span><br />
                        {formatIsoDateSafe(cs.end_date)}
                      </div>
                    </div>
                  </div>

                  {/* Informações de contato - Layout melhorado para mobile */}
                  <div className="space-y-2 mb-4">
                    {String((cs as any)?.subscriber_observation || '').trim() && (
                      <div className={`text-xs sm:text-sm ${textColor}/80 break-words`}>
                        📝 {String((cs as any).subscriber_observation).trim()}
                      </div>
                    )}
                    {cs.client_whatsapp && cs.client_whatsapp !== 'N/A' && (() => {
                      // Limpar e formatar o número para o WhatsApp
                      let cleanNumber = cs.client_whatsapp.replace(/\D/g, '');

                      // Garantir que tenha código do país (55 para Brasil)
                      if (cleanNumber.length === 11 && cleanNumber.startsWith('11')) {
                        // Número do Rio de Janeiro: 21993908102 -> 5521993908102
                        cleanNumber = '55' + cleanNumber;
                      } else if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
                        // Outros números de 11 dígitos: adicionar 55
                        cleanNumber = '55' + cleanNumber;
                      } else if (cleanNumber.length === 10) {
                        // Números de 10 dígitos: adicionar 55 + DDD
                        cleanNumber = '55' + cleanNumber;
                      } else if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
                        // Já tem código do país, manter
                        cleanNumber = cleanNumber;
                      } else if (cleanNumber.length < 10) {
                        // Número muito curto, não formatar
                        cleanNumber = cleanNumber;
                      }

                      const whatsappNumber = cleanNumber;
                      const displayNumber = cs.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');

                      return (
                        <div className={`flex items-center gap-2 text-xs sm:text-sm ${textColor}/80`}>
                          <span className="text-lg">📱</span>
                          <span className="flex-1 truncate">WhatsApp: {displayNumber}</span>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              openWhatsAppWithBusinessPriority(whatsappNumber, '');
                            }}
                            className="text-gray-600 hover:text-gray-800 transition-colors flex-shrink-0"
                            title={`Abrir WhatsApp: ${displayNumber}`}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                            </svg>
                          </a>
                        </div>
                      );
                    })()}
                    {cs.profiles?.email && (
                      <div className={`flex items-center gap-2 text-xs sm:text-sm ${textColor}/80`}>
                        <span className="text-lg">📧</span>
                        <span className="flex-1 truncate">Email: {cs.profiles.email}</span>
                        <a
                          href={`mailto:${cs.profiles.email}`}
                          className="text-gray-600 hover:text-gray-800 transition-colors flex-shrink-0"
                          title="Enviar email"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Botões de ação - Layout otimizado para mobile */}
                  <div className="space-y-2 sm:space-y-0">
                    {/* Dropdown de status de pagamento */}
                    <div className="relative">
                      <select
                        value={cs.payment_status}
                        onChange={(e) => handleTogglePaymentStatus(cs, e.target.value as 'paid' | 'unpaid')}
                        className={`w-full appearance-none px-3 py-2 pr-8 text-xs sm:text-sm font-medium rounded-lg border-0 outline-none transition-all cursor-pointer shadow-sm ${isPaid
                          ? 'bg-green-600 text-white hover:bg-green-700 focus:bg-green-700'
                          : 'bg-red-600 text-white hover:bg-red-700 focus:bg-red-700'
                          }`}
                      >
                        <option value="paid" className="bg-white text-green-700">✓ Pago</option>
                        <option value="unpaid" className="bg-white text-red-700">✗ Não Pago</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Botões de ação em grid para mobile */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void openAttendanceViewerForClient(cs, { kind: 'period' });
                        }}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                      >
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Atendimentos</span>
                        <span className="sm:hidden">Ver</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClientForAttendance(cs);
                          const subscription = subscriptions.find(sub => sub.id === cs.subscription_id);
                          const divideEnabled = Boolean((subscription as any)?.divide_total_enabled);
                          const fixedCommission = subscription?.fixed_commission_value;
                          // Sem divisão, usa o repasse normal configurado na assinatura
                          setAttendanceValue(
                            fixedCommission && fixedCommission > 0
                              ? fixedCommission
                              : 0
                          );
                          // Carregar comissão de venda (se existir)
                          loadSaleCommissionForClient(cs.id);
                          setSaleCommissionLastSavedAt(null);
                          setShowAddAttendanceModal(true);
                        }}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">(Profissional vendedor)</span>
                        <span className="sm:hidden">(Prof. vendedor)</span>
                      </button>
                      <button
                        onClick={() => openEditEndDateModal(cs)}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                        title="Editar assinante"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Editar Assinante</span>
                        <span className="sm:hidden">Editar</span>
                      </button>
                      <button
                        onClick={() => openLimitModal(cs)}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                        title="Definir limite de agendamentos por mês"
                      >
                        <span className="text-xs sm:text-sm">🔢</span>
                        <span className="hidden sm:inline ml-1">Limitar Cliente</span>
                        <span className="sm:hidden ml-1">Limite</span>
                      </button>
                      <button
                        onClick={() => openAdjustValueModal(cs)}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                        title="Alterar valor pago da assinatura"
                      >
                        <span className="text-xs sm:text-sm">💸</span>
                        <span className="hidden sm:inline ml-1">Alterar Valor</span>
                        <span className="sm:hidden ml-1">Valor</span>
                      </button>
                      <button
                        onClick={() => handleSendBillingReminder(cs)}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700 shadow-md"
                        title="Enviar cobrança por WhatsApp"
                      >
                        <span className="text-xs sm:text-sm">💬</span>
                        <span className="hidden sm:inline ml-1">Enviar cobrança</span>
                        <span className="sm:hidden ml-1">Cobrança</span>
                      </button>
                      <div className="col-span-2 sm:col-span-6 text-[11px] text-gray-300">
                        {getBillingReminderCount(cs)} cobrança{getBillingReminderCount(cs) === 1 ? '' : 's'} feita{getBillingReminderCount(cs) === 1 ? '' : 's'}
                      </div>
                    </div>

                    {/* Botão remover em linha separada */}
                    <button
                      onClick={() => handleDeleteClientSubscription(cs.id, cs.profiles?.full_name || 'Cliente')}
                      className="w-full inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-black text-white hover:bg-gray-800 border border-gray-700"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Recuperação de Clientes */}
      <ClientRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        establishmentId={establishmentId}
        onClientsRecovered={() => {
          fetchClientSubscriptions();
          if (onClientUpdated) onClientUpdated();
        }}
      />

      {/* Modal para Adicionar Atendimento */}
      {showAddAttendanceModal && selectedClientForAttendance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Adicionar Atendimento</h3>
              <button
                onClick={() => {
                  setShowAddAttendanceModal(false);
                  setSelectedClientForAttendance(null);
                  setAttendanceValue(0);
                  setSaleCommissionProfessional('');
                  setSaleCommissionPercent('');
                  setSaleCommissionLastSavedAt(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg">
              <p className="text-sm text-gray-400">Cliente:</p>
              <p className="text-white font-medium">{selectedClientForAttendance.profiles?.full_name}</p>
            </div>

            <div className="space-y-4">
              {/* Resumo: quanto é a assinatura, após repasse/venda, quanto fica por atendimento */}
              <div>
                {(() => {
                  const clientSubscription = selectedClientForAttendance;
                  const subscription = subscriptions.find(sub => sub.id === clientSubscription.subscription_id);
                  const fixedCommission = subscription?.fixed_commission_value;
                  const percent = Number(String(saleCommissionPercent || '').replace(',', '.'));
                  const hasSaleDiscount = Boolean(saleCommissionProfessional) && Number.isFinite(percent) && percent > 0;
                  const multiplier = hasSaleDiscount ? Math.max(0, 1 - percent / 100) : 1;
                  const round2 = (v: number) => Math.round(v * 100) / 100;

                  if (fixedCommission && fixedCommission > 0) {
                    const finalWithDiscount = round2(Number(fixedCommission) * multiplier);
                    const subscriptionValue = Number((subscription as any)?.value || 0);
                    const netTotal = round2(subscriptionValue * multiplier);
                    const divideEnabled = Boolean((subscription as any)?.divide_total_enabled);
                    const divideFromSubscription = Number((subscription as any)?.divide_total_attendances || 0);
                    const divideFallbackFromClientLimit = Number((clientSubscription as any)?.monthly_limit || 0);
                    const divideCount =
                      Number.isFinite(divideFromSubscription) && divideFromSubscription > 0
                        ? divideFromSubscription
                        : Number.isFinite(divideFallbackFromClientLimit) && divideFallbackFromClientLimit > 0
                          ? divideFallbackFromClientLimit
                          : 0;
                    const dividedValue =
                      divideEnabled && Number.isFinite(divideCount) && divideCount > 0 ? round2(netTotal / divideCount) : null;
                    const percentFromFixed =
                      Number.isFinite(subscriptionValue) && subscriptionValue > 0
                        ? Math.round((Number(fixedCommission) / subscriptionValue) * 10000) / 100
                        : null;
                    const finalDividedRepass =
                      divideEnabled && Number.isFinite(divideCount) && divideCount > 0 ? round2(finalWithDiscount / divideCount) : null;
                    return (
                      <>
                        <div className="text-sm font-medium text-gray-400 mb-2">Valor Repassado ao Profissional (R$)</div>
                        {/* Bloco igual à imagem: Dividir valor total com todas as explicações */}
                        {divideEnabled && (
                          <div className="mb-2 p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
                            <div className="text-sm text-white font-semibold">👉 Dividir valor total (ativo na assinatura)</div>
                            <div className="mt-2 text-xs text-gray-200 space-y-1">
                              <div>
                                Valor líquido da assinatura <strong className="text-white">{fmtBRL(netTotal)}</strong>
                                {hasSaleDiscount ? <span className="text-gray-300"> (venda {percent}%)</span> : null}
                              </div>
                              <div>
                                Qtd. atendimentos <strong className="text-white">{divideCount > 0 ? divideCount : '—'}</strong>
                              </div>
                              <div>
                                Valor por atendimento: <strong className="text-white">{dividedValue !== null ? fmtBRL(dividedValue) : '—'}</strong>
                              </div>
                              <div>
                                Repasse configurado: <strong className="text-white">{percentFromFixed !== null ? `${percentFromFixed}%` : '—'}</strong>
                              </div>
                              <div>
                                Profissional recebe: <strong className="text-white">{finalDividedRepass !== null ? fmtBRL(finalDividedRepass) : '—'}</strong> por atendimento
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-lg">
                          <p className="text-xs text-gray-700">
                            ✅ Valor fixo configurado: R$ {fixedCommission.toFixed(2).replace('.', ',')} (não editável)
                          </p>
                          {hasSaleDiscount && (
                            <p className="text-xs text-gray-700 mt-1">
                              🔻 Com desconto de venda ({percent}%):{' '}
                              <strong>R$ {finalWithDiscount.toFixed(2).replace('.', ',')}</strong>
                              {divideEnabled && finalDividedRepass !== null ? (
                                <> — com “Dividir valor total”: <strong>{fmtBRL(finalDividedRepass)}</strong> por atendimento</>
                              ) : (
                                <> — sem “Dividir valor total”, o atendimento só conta consumo (repasso salvo: <strong>R$ 0,00</strong>)</>
                              )}
                            </p>
                          )}
                        </div>
                      </>
                    );
                  } else {
                    const subscriptionValueElse = Number((subscription as any)?.value || 0);
                    const netTotalElse = round2(subscriptionValueElse * multiplier);
                    const finalWithDiscount = round2(Number(attendanceValue || 0) * multiplier);
                    return (
                      <>
                        <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg mb-2">
                          <div className="text-xs text-gray-300">Valor da assinatura</div>
                          <div className="text-white font-bold">{fmtBRL(subscriptionValueElse)}</div>
                          {hasSaleDiscount && (
                            <div className="text-xs text-gray-400 mt-1">
                              Após comissão de venda ({percent}%): <strong className="text-white">{fmtBRL(netTotalElse)}</strong>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-lg">
                          <p className="text-xs text-gray-700">
                            ⚠️ Nenhum valor fixo de repasse configurado nesta assinatura. Use &quot;✅ Atendimento assinatura&quot; na agenda para registrar atendimentos.
                          </p>
                          {hasSaleDiscount && finalWithDiscount > 0 && (
                            <p className="text-xs text-gray-700 mt-1">
                              🔻 Com desconto de venda ({percent}%): <strong>R$ {finalWithDiscount.toFixed(2).replace('.', ',')}</strong>
                            </p>
                          )}
                        </div>
                      </>
                    );
                  }
                })()}
              </div>

              {/* Comissão por venda da assinatura (NÃO é atendimento) */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm font-semibold text-white mb-2">
                  % do profissional por venda da assinatura (SALVA AUTOMATICAMENTE)
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Bônus de venda (paga 1x). Ao escolher o profissional e o %, já salva sozinho.
                </p>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="saleCommissionProfessional" className="block text-sm font-medium text-gray-400 mb-1">
                      Profissional que vendeu a assinatura
                    </label>
                    <select
                      id="saleCommissionProfessional"
                      value={saleCommissionProfessional}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSaleCommissionProfessional(next);
                        if (!next) {
                          // Ao remover o profissional vendedor, limpar percentual e persistir remoção.
                          setSaleCommissionPercent('');
                          saveSaleCommissionDebounced(selectedClientForAttendance, '', '');
                          return;
                        }
                        saveSaleCommissionDebounced(selectedClientForAttendance, next, saleCommissionPercent);
                      }}
                      className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                    >
                      <option value="">Sem profissional vendedor</option>
                      {professionals.map((professional) => (
                        <option key={professional.id} value={professional.full_name}>
                          {professional.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="saleCommissionPercent" className="block text-sm font-medium text-gray-400 mb-1">
                      Percentual (%)
                    </label>
                    <input
                      type="number"
                      id="saleCommissionPercent"
                      value={saleCommissionPercent}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSaleCommissionPercent(next);
                        saveSaleCommissionDebounced(selectedClientForAttendance, saleCommissionProfessional, next);
                      }}
                      className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="Ex: 10"
                      disabled={!saleCommissionProfessional}
                    />
                    <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-lg">
                      {(() => {
                        const subscriptionValue = getSubscriptionValueForClient(selectedClientForAttendance);
                        const percent = Number(String(saleCommissionPercent || '').replace(',', '.'));
                        const canCalc = saleCommissionProfessional && Number.isFinite(percent) && percent > 0 && subscriptionValue > 0;
                        const amount = canCalc ? computeSaleCommissionAmount(subscriptionValue, percent) : 0;
                        const lastSavedLabel =
                          saleCommissionLastSavedAt
                            ? `✅ Salvo automaticamente às ${new Date(saleCommissionLastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                            : '';
                        return (
                          <p className="text-xs text-gray-700">
                            {saleCommissionProfessional
                              ? canCalc
                                ? `✅ Vai somar ${fmtBRL(amount)} no caixa do profissional (1x) — assinatura: ${fmtBRL(subscriptionValue)}`
                                : `ℹ️ Coloque um % para calcular em cima de ${fmtBRL(subscriptionValue)}`
                              : '⚠️ Selecione o profissional para habilitar o percentual.'}
                            {isSavingSaleCommission && (
                              <span className="ml-2 text-gray-500">Salvando...</span>
                            )}
                            {!isSavingSaleCommission && lastSavedLabel && (
                              <span className="ml-2 text-green-700 font-semibold">{lastSavedLabel}</span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal para editar data de término */}
      {showEditEndDateModal && selectedClientForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 w-full max-w-lg border border-gray-800 max-h-[92vh] overflow-y-auto my-3 sm:my-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Editar Assinante</h3>
              <button
                onClick={() => {
                  setShowEditEndDateModal(false);
                  setSelectedClientForEdit(null);
                  setNewEndDate('');
                  setNewStartDate('');
                  setEditSubscriberName('');
                  setEditSubscriberPhone('');
                  setEditSubscriberEmail('');
                  setEditSubscriberSubscriptionId('');
                  setEditSubscriberPaymentMethod('');
                  setEditSubscriberProfessionalId('');
                  setEditSubscriberObservation('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg">
              <p className="text-sm text-gray-400">Cliente:</p>
              <p className="text-white font-medium">{selectedClientForEdit.profiles?.full_name}</p>
              <p className="text-xs text-gray-400 mt-1">
                Início atual: {formatIsoDateSafe(selectedClientForEdit.start_date)}
              </p>
              <p className="text-xs text-gray-400">
                Término atual: {formatIsoDateSafe(selectedClientForEdit.end_date)}
              </p>
            </div>

            <form onSubmit={handleUpdateEndDate} className="space-y-4">
              <div>
                <label htmlFor="editSubscriberName" className="block text-sm font-medium text-gray-400 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  id="editSubscriberName"
                  value={editSubscriberName}
                  onChange={(e) => setEditSubscriberName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="editSubscriberPhone" className="block text-sm font-medium text-gray-400 mb-1">
                  Número de Telefone
                </label>
                <input
                  type="tel"
                  id="editSubscriberPhone"
                  value={editSubscriberPhone}
                  onChange={(e) => setEditSubscriberPhone(e.target.value)}
                  onBlur={(e) => setEditSubscriberPhone(normalizePhoneDigits(e.target.value))}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="editSubscriberEmail" className="block text-sm font-medium text-gray-400 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  id="editSubscriberEmail"
                  value={editSubscriberEmail}
                  onChange={(e) => setEditSubscriberEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                />
              </div>

              <div>
                <label htmlFor="editSubscriberSubscriptionId" className="block text-sm font-medium text-gray-400 mb-1">
                  Assinatura
                </label>
                <select
                  id="editSubscriberSubscriptionId"
                  value={editSubscriberSubscriptionId}
                  onChange={(e) => setEditSubscriberSubscriptionId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                >
                  <option value="">Selecione uma assinatura</option>
                  {subscriptions.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(sub.value || 0))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="newStartDate" className="block text-sm font-medium text-gray-400 mb-1">
                  Nova Data de Início
                </label>
                <input
                  type="date"
                  id="newStartDate"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="newEndDate" className="block text-sm font-medium text-gray-400 mb-1">
                  Nova Data de Término
                </label>
                <input
                  type="date"
                  id="newEndDate"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="editSubscriberPaymentMethod" className="block text-sm font-medium text-gray-400 mb-1">
                  Forma de Pagamento (opcional)
                </label>
                <select
                  id="editSubscriberPaymentMethod"
                  value={editSubscriberPaymentMethod}
                  onChange={(e) => setEditSubscriberPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="">Selecione (opcional)</option>
                  {availablePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {getPaymentMethodLabel(method)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="editSubscriberProfessionalId" className="block text-sm font-medium text-gray-400 mb-1">
                  Qual profissional vai atender esse cliente?
                </label>
                <select
                  id="editSubscriberProfessionalId"
                  value={editSubscriberProfessionalId}
                  onChange={(e) => setEditSubscriberProfessionalId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="">Todos</option>
                  {(professionals || []).map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="editSubscriberObservation" className="block text-sm font-medium text-gray-400 mb-1">
                  Observação (opcional)
                </label>
                <textarea
                  id="editSubscriberObservation"
                  value={editSubscriberObservation}
                  onChange={(e) => setEditSubscriberObservation(e.target.value.slice(0, 150))}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white resize-none"
                  placeholder="Escreva uma observação (até 150 caracteres)"
                  rows={3}
                  maxLength={150}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {editSubscriberObservation.length}/150
                </p>
              </div>

              {/* Informações sobre o impacto da mudança */}
              {newStartDate && newEndDate && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const startDate = new Date(newStartDate);
                const endDate = new Date(newEndDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);

                const isStartValid = startDate <= endDate;
                const isEndFuture = endDate > today;
                const isEndToday = endDate.getTime() === today.getTime();

                return (
                  <div className={`p-3 rounded-lg border ${isStartValid && isEndFuture
                    ? 'bg-green-900/20 border-green-600/30'
                    : 'bg-red-900/20 border-red-600/30'
                    }`}>
                    <p className={`text-xs ${isStartValid && isEndFuture ? 'text-green-400' : 'text-red-400'
                      }`}>
                      {!isStartValid
                        ? `❌ Data de início deve ser anterior à data de término`
                        : isEndFuture
                          ? `✅ Plano ficará ATIVO de ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} até ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
                          : isEndToday
                            ? `⚠️ Plano ficará VENCIDO hoje (${format(endDate, 'dd/MM/yyyy', { locale: ptBR })})`
                            : `❌ Plano ficará VENCIDO (venceu em ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })})`
                      }
                    </p>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-[#1a1b1c]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEndDateModal(false);
                    setSelectedClientForEdit(null);
                    setNewEndDate('');
                    setNewStartDate('');
                    setEditSubscriberName('');
                    setEditSubscriberPhone('');
                    setEditSubscriberEmail('');
                    setEditSubscriberSubscriptionId('');
                    setEditSubscriberPaymentMethod('');
                    setEditSubscriberProfessionalId('');
                    setEditSubscriberObservation('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEndDate}
                  className="flex-1 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSavingEndDate ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para visualizar atendimentos do cliente */}
      {showViewAttendancesModal && selectedClientForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-2xl border border-gray-800 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Atendimentos do Cliente</h3>
                {attendanceViewerFilter?.kind === 'month' ? (
                  <p className="text-xs text-gray-400 mt-1">
                    {format(parseISO(`${attendanceViewerFilter.ym}-01`), "MMMM yyyy", { locale: ptBR })}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Mês selecionado (com saldo carregado do mês anterior, quando sobrar)</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowViewAttendancesModal(false);
                  setSelectedClientForView(null);
                  setAttendanceViewerFilter(null);
                  setAttendanceViewerRows([]);
                  setAttendanceViewerError(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg">
              <p className="text-sm text-gray-400">Cliente:</p>
              <p className="text-white font-medium">{selectedClientForView.profiles?.full_name}</p>
            </div>

            {(() => {
              const viewClientPointsMode = isClientSubscriptionPointsMode(String(selectedClientForView.id));

              if (attendanceViewerLoading) {
                return (
                  <div className="text-center text-gray-400 py-10">
                    <p className="text-sm">Carregando atendimentos…</p>
                  </div>
                );
              }

              if (attendanceViewerError) {
                return (
                  <div className="text-center text-red-300 py-8 px-2">
                    <p className="text-sm">{attendanceViewerError}</p>
                  </div>
                );
              }

              const clientAttendances = attendanceViewerRows;
              const attendancesByProfessional = buildAttendancesByProfessional(
                clientAttendances,
                selectedClientForView.id
              );

              if (clientAttendances.length === 0) {
                return (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-sm">Nenhum atendimento registrado neste filtro.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {viewClientPointsMode && (
                    <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                      Plano em <strong>modo pontos</strong> (repasse 0% sem dividir valor): cada atendimento conta como ponto para o profissional; a mensalidade do cliente é só referência para fechar o mês.
                    </p>
                  )}
                  <div className="bg-[#2a2b2c] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Resumo por Profissional</h4>
                    <div className="space-y-3">
                      {Object.entries(attendancesByProfessional).map(([professional, data]) => (
                        <div key={professional} className="flex justify-between items-center bg-[#1a1b1c] rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-white">{professional}</p>
                            <p className="text-xs text-gray-400">{data.count} atendimento(s)</p>
                          </div>
                          <div className="text-right">
                            {viewClientPointsMode ? (
                              <>
                                <p className="text-sm font-bold text-amber-300">{data.pointsCount} ponto(s)</p>
                                <p className="text-xs text-gray-400">Modo pontos</p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-green-400">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.totalValue)}
                                </p>
                                <p className="text-xs text-gray-400">Total repassado</p>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#2a2b2c] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Detalhamento dos Atendimentos</h4>
                    <div className="space-y-2">
                      {clientAttendances.map((attendance) => (
                        <div key={attendance.id} className="flex justify-between items-center bg-[#1a1b1c] rounded-lg p-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                              {String(attendance.professional_name || '').trim() || 'Profissional não informado'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {format(parse(String(attendance.attendance_date || '').slice(0, 10), 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-blue-400">
                                {viewClientPointsMode
                                  ? '1 ponto'
                                  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                      getAttendanceEffectiveRepass(attendance)
                                    )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttendance(
                                attendance.id,
                                String(attendance.professional_name || '').trim() || 'Profissional não informado',
                                attendance.attendance_date,
                                getAttendanceEffectiveRepass(attendance)
                              )}
                              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Remover atendimento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Histórico de alterações do plano de assinatura */}
      {showSubscriptionPlanAuditModal && subscriptionPlanAuditFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-lg mx-4 border border-gray-700 my-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-lg font-semibold text-white pr-2">
                Histórico — {subscriptionPlanAuditFor.name}
              </h3>
              <button
                type="button"
                onClick={closeSubscriptionPlanAuditModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3 shrink-0">
              Abaixo, o resumo em português diz o que mudou (ex.: tempo 30 → 45 min). Data e hora vêm do servidor com precisão de segundos. O bloco “Detalhe técnico” é só para suporte ou conferência avançada.
            </p>

            {subscriptionPlanAuditLoading && (
              <p className="text-gray-300 text-sm">Carregando histórico…</p>
            )}

            {subscriptionPlanAuditError && (
              <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-100 text-sm p-3 mb-3 shrink-0">
                {subscriptionPlanAuditError}
                <p className="text-xs text-red-200/80 mt-2">
                  Se a mensagem indicar que a tabela não existe, aplique a migration <span className="font-mono">20260415133000_subscription_plan_audit_log.sql</span> no Supabase.
                </p>
              </div>
            )}

            {!subscriptionPlanAuditLoading && !subscriptionPlanAuditError && subscriptionPlanAuditRows.length === 0 && (
              <p className="text-gray-400 text-sm">Nenhum evento registrado para este plano (ou a auditoria ainda não estava ativa quando houve mudanças).</p>
            )}

            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
              {subscriptionPlanAuditRows.map((row) => {
                const when = format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
                const op = String(row.operation || '').toUpperCase();
                const actor = formatPlanAuditActorLine(row.actor_user_id);
                return (
                  <div
                    key={row.id}
                    className="rounded-lg border border-white/10 bg-[#242628] p-3 text-sm text-gray-200"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{when}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded border ${op === 'DELETE'
                          ? 'border-red-500/50 text-red-300 bg-red-950/30'
                          : op === 'INSERT'
                            ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30'
                            : 'border-sky-500/50 text-sky-200 bg-sky-950/30'
                          }`}
                      >
                        {op === 'INSERT' ? 'CRIAÇÃO' : op === 'DELETE' ? 'EXCLUSÃO' : 'ALTERAÇÃO'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2 leading-snug">{actor}</p>
                    <div className="rounded-md bg-black/25 border border-white/5 p-2.5 space-y-1.5">
                      {buildFriendlySubscriptionPlanAuditLines(row).map((line, idx) => (
                        <p key={idx} className="text-sm text-gray-100 leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-sky-400 hover:text-sky-300">Detalhe técnico (JSON antes / depois)</summary>
                      <div className="mt-2 grid gap-2 text-[11px] font-mono whitespace-pre-wrap break-all text-gray-400 max-h-48 overflow-y-auto">
                        {row.old_row && (
                          <div>
                            <span className="text-gray-500">Antes:</span>
                            {JSON.stringify(row.old_row, null, 2)}
                          </div>
                        )}
                        {row.new_row && (
                          <div>
                            <span className="text-gray-500">Depois:</span>
                            {JSON.stringify(row.new_row, null, 2)}
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Assinatura */}
      {showEditDescriptionModal && selectedSubscriptionForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700 my-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Editar Assinatura
              </h3>
              <button
                onClick={() => {
                  setShowEditDescriptionModal(false);
                  setSelectedSubscriptionForEdit(null);
                  setEditDescription('');
                  setEditName('');
                  setEditWeekdays([]);
                  setEditDuration(30);
                  setEditSubscriptionValue('');
                  setEditRepassePercent('');
                  setEditDivideTotalEnabled(false);
                  setEditDivideTotalAttendances('');
                  setEditDivideServicesEnabled(true);
                  setEditDividedServices([]);
                  setEditSubscriptionLabelColor('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Nome da Assinatura
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: Barba e Cabelo"
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
                  required
                />
              </div>

              {/* Valor da assinatura + % repasse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Valor da assinatura (R$)
                  </label>
                  <input
                    type="text"
                    value={editSubscriptionValue}
                    onChange={(e) => setEditSubscriptionValue(e.target.value)}
                    placeholder="Ex: 200,00"
                    inputMode="decimal"
                    className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    % de repasse pro profissional
                  </label>
                  <input
                    type="text"
                    value={editRepassePercent}
                    onChange={(e) => setEditRepassePercent(e.target.value)}
                    placeholder="Ex: 25"
                    inputMode="decimal"
                    className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="p-2 bg-gray-100 border border-gray-300 rounded-lg">
                {(() => {
                  const v = Number(String(editSubscriptionValue || '').replace(',', '.'));
                  const p = Number(String(editRepassePercent || '').replace(',', '.'));
                  const ok = Number.isFinite(v) && v > 0 && Number.isFinite(p) && p >= 0;
                  const rep = ok ? Math.round((v * (p / 100)) * 100) / 100 : 0;
                  return (
                    <p className="text-xs text-gray-700">
                      ✅ Repasse por atendimento (estimado): <strong>R$ {rep.toFixed(2).replace('.', ',')}</strong>
                    </p>
                  );
                })()}
              </div>

              {/* ✅ Dividir valor total (configuração da assinatura) */}
              <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={editDivideTotalEnabled}
                    onChange={(e) => setEditDivideTotalEnabled(e.target.checked)}
                  />
                  👉 Dividir valor total
                </label>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Se ativar, o sistema divide o valor líquido da assinatura pela quantidade de atendimentos e só depois aplica o repasse do profissional.
                </p>
                <div className="mt-2">
                  <label className="block text-xs text-gray-400 mb-1">Qtd. atendimentos da assinatura</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={editDivideTotalAttendances}
                    onChange={(e) => setEditDivideTotalAttendances(e.target.value)}
                    disabled={!editDivideTotalEnabled}
                    className={`w-full px-3 py-2 bg-black/30 rounded-lg border border-white/10 text-white focus:outline-none focus:border-blue-500 ${!editDivideTotalEnabled ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    placeholder="Ex: 4"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  👉 Serviços oferecidos na assinatura <span className="text-amber-300 text-xs">(obrigatório)</span>
                </label>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  O assinante deve escolher um serviço específico desta lista no booking.
                </p>
                <div className="mt-3 space-y-3">
                  {editDividedServices.map((service, index) => (
                    <div key={service.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-300 font-semibold">Serviço {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => setEditDividedServices((prev) => prev.filter((item) => item.id !== service.id))}
                          className="text-xs text-red-300 hover:text-red-200"
                        >
                          Remover
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) =>
                            setEditDividedServices((prev) =>
                              prev.map((item) => (item.id === service.id ? { ...item, name: e.target.value } : item))
                            )
                          }
                          placeholder="Nome do serviço"
                          className="w-full px-3 py-2 bg-[#111213] rounded-lg border border-white/10 text-white focus:outline-none focus:border-blue-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-400 mb-1">Tempo (minutos)</label>
                            <input
                              type="number"
                              min={5}
                              step={5}
                              value={service.duration}
                              onChange={(e) =>
                                setEditDividedServices((prev) =>
                                  prev.map((item) => (item.id === service.id ? { ...item, duration: Number(e.target.value || 0) } : item))
                                )
                              }
                              placeholder="Ex: 30"
                              className="w-full px-3 py-2 bg-[#111213] rounded-lg border border-white/10 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-400 mb-1">Limite de atendimentos</label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={service.limit}
                              onChange={(e) =>
                                setEditDividedServices((prev) =>
                                  prev.map((item) => (item.id === service.id ? { ...item, limit: Number(e.target.value || 0) } : item))
                                )
                              }
                              placeholder="Ex: 4"
                              className="w-full px-3 py-2 bg-[#111213] rounded-lg border border-white/10 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Tempo = duração do serviço no agendamento. Limite = quantas vezes esse serviço pode ser usado na assinatura.
                        </p>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditDividedServices((prev) => [...prev, createEmptyDividedService()])}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm text-gray-200 hover:bg-white/5 transition-colors"
                  >
                    + Adicionar serviço
                  </button>
                </div>
              </div>
              <div className="p-3 bg-[#2a2b2c] border border-gray-600 rounded-lg">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-white">🏷️ Etiqueta</p>
                  <button
                    type="button"
                    onClick={() => setEditSubscriptionLabelColor('')}
                    className="text-xs text-gray-300 hover:text-white"
                  >
                    Limpar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {subscriptionLabelPalette.map((color) => {
                    const selected = editSubscriptionLabelColor === color;
                    return (
                      <button
                        key={`edit-subscription-color-${color}`}
                        type="button"
                        onClick={() => setEditSubscriptionLabelColor(color)}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${selected ? 'border-white scale-110' : 'border-white/30 hover:border-white/60'}`}
                        style={{ backgroundColor: color }}
                        title="Selecionar cor da etiqueta"
                      />
                    );
                  })}
                </div>
              </div>

              {/* Dias da Semana */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Dias da Semana
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'monday', label: 'Segunda-feira' },
                    { value: 'tuesday', label: 'Terça-feira' },
                    { value: 'wednesday', label: 'Quarta-feira' },
                    { value: 'thursday', label: 'Quinta-feira' },
                    { value: 'friday', label: 'Sexta-feira' },
                    { value: 'saturday', label: 'Sábado' },
                    { value: 'sunday', label: 'Domingo' }
                  ].map((day) => (
                    <label key={day.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editWeekdays.includes(day.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditWeekdays([...editWeekdays, day.value]);
                          } else {
                            setEditWeekdays(editWeekdays.filter(d => d !== day.value));
                          }
                        }}
                        className="w-4 h-4 text-gray-700 bg-[#2a2b2c] border-gray-600 rounded focus:ring-gray-500"
                      />
                      <span className="text-sm text-gray-300">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Duração */}
              {!editDivideServicesEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Duração do Serviço (minutos)
                  </label>
                  <select
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                    required
                  >
                    <option value={5}>5 minutos</option>
                    <option value={10}>10 minutos</option>
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={40}>40 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={75}>1 hora e 15 minutos</option>
                    <option value={90}>1 hora e 30 minutos</option>
                    <option value={105}>1 hora e 45 minutos</option>
                    <option value={120}>2 horas</option>
                    <option value={135}>2 horas e 15 minutos</option>
                    <option value={150}>2 horas e 30 minutos</option>
                    <option value={165}>2 horas e 45 minutos</option>
                    <option value={180}>3 horas</option>
                  </select>
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ex: Essa assinatura inclui cortes ilimitados durante o mês."
                  maxLength={150}
                  rows={4}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editDescription.length}/150 caracteres
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditDescriptionModal(false);
                  setSelectedSubscriptionForEdit(null);
                  setEditDescription('');
                  setEditName('');
                  setEditWeekdays([]);
                  setEditDuration(30);
                  setEditSubscriptionValue('');
                  setEditRepassePercent('');
                  setEditDivideTotalEnabled(false);
                  setEditDivideTotalAttendances('');
                  setEditDivideServicesEnabled(true);
                  setEditDividedServices([]);
                  setEditSubscriptionLabelColor('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDescription}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Link Personalizado */}
      {showEditLinkModal && selectedSubscriptionForLinkEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Meu Link - {selectedSubscriptionForLinkEdit.name}
              </h3>
              <button
                onClick={() => setShowEditLinkModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Link Personalizado (opcional)
              </label>
              <input
                type="url"
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="Ex: https://seusite.com/assinatura ou https://wa.me/5511999999999"
                className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-2">
                Se preenchido, ao clicar em "Assinar" na página de booking, o cliente será redirecionado para este link ao invés do WhatsApp. Deixe vazio para usar o WhatsApp padrão.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditLinkModal(false);
                  setSelectedSubscriptionForLinkEdit(null);
                  setEditLink('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLink}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {selectedSubscriptionForLinkEdit.custom_link ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link cartão de crédito (fluxo manual) */}
      {showEditCreditCardLinkModal && selectedSubscriptionForCreditCardLinkEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Link cartão de crédito - {selectedSubscriptionForCreditCardLinkEdit.name}
              </h3>
              <button
                onClick={() => {
                  setShowEditCreditCardLinkModal(false);
                  setSelectedSubscriptionForCreditCardLinkEdit(null);
                  setEditCreditCardLink('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                👉 Link cartão de crédito (opcional)
              </label>
              <input
                type="url"
                value={editCreditCardLink}
                onChange={(e) => setEditCreditCardLink(e.target.value)}
                placeholder="Ex: https://link.mercadopago.com.br/seu-plano"
                className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-2">
                Este link será usado quando o cliente escolher “Cartão de crédito” na assinatura. O pagamento é feito fora do sistema.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditCreditCardLinkModal(false);
                  setSelectedSubscriptionForCreditCardLinkEdit(null);
                  setEditCreditCardLink('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCreditCardLink}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {(selectedSubscriptionForCreditCardLinkEdit as any).credit_card_link ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para alterar valor pago da assinatura */}
      {showAdjustValueModal && selectedClientForValueAdjust && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-lg border border-gray-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Alterar valor pago</h3>
              <button
                onClick={() => {
                  if (isSavingAdjustedValue) return;
                  setShowAdjustValueModal(false);
                  setSelectedClientForValueAdjust(null);
                  setAdjustedSubscriptionValue('');
                  setAdjustValueNote('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const planValue = Number(selectedClientForValueAdjust?.subscriptions?.value || selectedClientForValueAdjust?.subscription_value || 0);
              const currentValue = Number(getSubscriptionValueForClient(selectedClientForValueAdjust));
              const history = parseSubscriptionValueChangeHistory((selectedClientForValueAdjust as any)?.subscription_value_change_history);
              return (
                <>
                  <div className="mb-4 rounded-lg border border-gray-700 bg-[#232425] p-3 text-sm text-gray-300">
                    <div>
                      Cliente: <strong className="text-white">{selectedClientForValueAdjust?.profiles?.full_name || 'Cliente'}</strong>
                    </div>
                    <div>
                      Plano base: <strong className="text-white">{fmtBRL(planValue)}</strong>
                    </div>
                    <div>
                      Valor atual cobrado: <strong className="text-white">{fmtBRL(currentValue)}</strong>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Histórico: {history.length}/{MAX_SUBSCRIPTION_VALUE_CHANGES} alterações
                    </div>
                  </div>

                  <form onSubmit={handleSaveAdjustedValue}>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Novo valor pago (R$)
                      </label>
                      <input
                        type="text"
                        value={adjustedSubscriptionValue}
                        onChange={(e) => setAdjustedSubscriptionValue(e.target.value)}
                        placeholder="Ex: 199,90"
                        className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Motivo (opcional)
                      </label>
                      <input
                        type="text"
                        value={adjustValueNote}
                        onChange={(e) => setAdjustValueNote(e.target.value)}
                        placeholder="Ex: desconto fidelidade"
                        maxLength={120}
                        className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                      />
                    </div>

                    <div className="flex gap-3 mb-5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isSavingAdjustedValue) return;
                          setShowAdjustValueModal(false);
                          setSelectedClientForValueAdjust(null);
                          setAdjustedSubscriptionValue('');
                          setAdjustValueNote('');
                        }}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingAdjustedValue}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                      >
                        {isSavingAdjustedValue ? 'Salvando...' : 'Salvar valor'}
                      </button>
                    </div>
                  </form>

                  <div>
                    <div className="text-sm font-semibold text-gray-200 mb-2">Histórico de alterações</div>
                    {history.length === 0 ? (
                      <div className="text-sm text-gray-400">Nenhuma alteração registrada.</div>
                    ) : (
                      <div className="space-y-2">
                        {history.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-gray-700 bg-[#232425] p-3 text-xs sm:text-sm">
                            <div className="text-gray-300">
                              {(() => {
                                const dt = parseISO(entry.changed_at);
                                if (Number.isNaN(dt.getTime())) return 'Data inválida';
                                return format(dt, 'dd/MM/yyyy HH:mm', { locale: ptBR });
                              })()}
                            </div>
                            <div className="text-white mt-1">
                              {fmtBRL(entry.old_value)} → <strong>{fmtBRL(entry.new_value)}</strong>
                            </div>
                            {entry.discount_amount > 0 && (
                              <div className="text-emerald-300">
                                Desconto aplicado: {fmtBRL(entry.discount_amount)}
                              </div>
                            )}
                            {String(entry.note || '').trim() && (
                              <div className="text-gray-300 mt-1">Motivo: {String(entry.note).trim()}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal para Definir Limite Simples */}
      {showLimitModal && selectedClientForLimit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Limitar Cliente
              </h3>
              <button
                onClick={() => setShowLimitModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLimit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Limite mensal para <strong>{selectedClientForLimit.profiles?.full_name || 'Cliente'}</strong>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={monthlyLimit || ''}
                  onChange={(e) => setMonthlyLimit(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  placeholder="Ex: 2 (para 2 agendamentos por mês)"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Deixe vazio para sem limite. O sistema conta o mês atual e, se sobrar do mês anterior, soma esse saldo apenas neste mês.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingLimit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSavingLimit ? 'Salvando...' : 'Salvar Limite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Pagamentos */}
      {showHistoryModal && selectedProfessionalForHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Histórico de Pagamentos - {selectedProfessionalForHistory}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedProfessionalForHistory('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(() => {
                if (professionalPaymentHistory.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-400">Nenhum pagamento registrado para este profissional.</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg border border-gray-600">
                      <p className="text-sm text-gray-400">
                        Total de pagamentos: <span className="font-bold text-white">{professionalPaymentHistory.length}</span>
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Total pago: <span className="font-bold text-green-400">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            professionalPaymentHistory.reduce((sum, p) => sum + (Number(p?.amount || 0) || 0), 0)
                          )}
                        </span>
                      </p>
                    </div>

                    {professionalPaymentHistory.map((payment: any) => (
                      <div key={payment.id} className="flex justify-between items-center bg-[#2a2b2c] rounded-lg p-3 border border-gray-600">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-white">
                              {(() => {
                                const dt = new Date(String(payment.payment_date || ''));
                                if (Number.isNaN(dt.getTime())) return 'Data inválida';
                                return dt.toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                              })()}
                            </p>
                            {(payment.payment_source === 'subscription' || payment.payment_source === 'assinatura') ? (
                              <span className="px-2 py-0.5 text-xs font-medium bg-purple-600/30 text-purple-300 rounded border border-purple-500/50">
                                Via Assinatura
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600/30 text-blue-300 rounded border border-blue-500/50">
                                Normal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Data do pagamento
                            {String(payment?.for_month || '').trim()
                              ? ` • Competência: ${String(payment.for_month)}`
                              : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${payment.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount || 0)}
                          </p>
                          <div className="mt-1 flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              disabled={reassigningPaymentId === String(payment.id || '')}
                              onClick={() => movePaymentByMonthDelta(payment, -1)}
                              className="px-2 py-1 text-[11px] rounded border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Mover este lançamento para o mês anterior"
                            >
                              {reassigningPaymentId === String(payment.id || '') ? 'Movendo...' : 'Mês -1'}
                            </button>
                            <button
                              type="button"
                              disabled={reassigningPaymentId === String(payment.id || '')}
                              onClick={() => movePaymentByMonthDelta(payment, 1)}
                              className="px-2 py-1 text-[11px] rounded border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Mover este lançamento para o próximo mês"
                            >
                              {reassigningPaymentId === String(payment.id || '') ? 'Movendo...' : 'Mês +1'}
                            </button>
                            {Number(payment.amount || 0) >= 0 && (
                              <button
                                type="button"
                                disabled={reassigningPaymentId === String(payment.id || '')}
                                onClick={() => returnPaymentToBarberCash(payment)}
                                className="px-2 py-1 text-[11px] rounded border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Voltar este valor para o caixa do barbeiro"
                              >
                                Voltar pro caixa
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={reassigningPaymentId === String(payment.id || '')}
                              onClick={() => deletePaymentRecord(payment)}
                              className="px-2 py-1 text-[11px] rounded border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Apagar este lançamento"
                            >
                              Apagar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedProfessionalForHistory('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
