import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AppointmentAuditLogRow {
  id: string;
  event_type: string;
  description?: string | null;
  changed_by_name?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export type AuditFilterCategory = 'all' | 'financial' | 'schedule' | 'products' | 'status' | 'service';

export interface AuditChangeLine {
  label?: string;
  before?: string;
  after?: string;
  single?: string;
}

export interface AuditDisplayEntry {
  id: string;
  icon: string;
  title: string;
  category: AuditFilterCategory;
  changes: AuditChangeLine[];
  actor: string | null;
  timestamp: string;
  rawEventType: string;
  isNoise: boolean;
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  credito: 'Crédito',
  debito: 'Débito',
  transferencia: 'Transferência',
  pagar_local: 'Pagamento no local',
  multi: 'Misto',
  assinante: 'Assinante',
  pendente: 'Pagamento no local',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Não compareceu',
};

const STATUS_EMOJI: Record<string, string> = {
  pending: '🟡',
  confirmed: '🔵',
  completed: '🟢',
  cancelled: '🔴',
};

export const AUDIT_FILTER_OPTIONS: Array<{ id: AuditFilterCategory; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'financial', label: 'Financeiro' },
  { id: 'schedule', label: 'Horário' },
  { id: 'products', label: 'Produtos' },
  { id: 'status', label: 'Status' },
  { id: 'service', label: 'Serviço' },
];

export function formatAuditDateTime(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  try {
    const parsed = parseISO(raw);
    if (isValid(parsed)) {
      return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
  } catch {
    /* fallback */
  }
  return raw;
}

export function formatAuditCurrency(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function formatAuditDuration(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} min`;
}

export function formatAuditPaymentMethod(value: unknown): string {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return 'Não informado';
  return PAYMENT_LABELS[key] || key;
}

export function formatAuditStatus(value: unknown): string {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return '—';
  const emoji = STATUS_EMOJI[key] || '';
  const label = STATUS_LABELS[key] || key;
  return emoji ? `${emoji} ${label}` : label;
}

export function formatAuditDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  return raw;
}

export function getAuditEventCategory(eventTypeRaw: unknown): AuditFilterCategory | 'noise' {
  const key = String(eventTypeRaw || '').trim().toLowerCase();
  if (!key || key === 'card_action_clicked') return 'noise';

  if (
    key === 'price_changed' ||
    key === 'payment_method_changed' ||
    key === 'professional_tip_updated' ||
    key === 'card_brand_changed'
  ) {
    return 'financial';
  }

  if (
    key === 'rescheduled' ||
    key === 'finished_early' ||
    key === 'professional_transferred' ||
    key === 'date_changed'
  ) {
    return 'schedule';
  }

  if (
    key === 'additional_service_added' ||
    key === 'additional_service_removed' ||
    key === 'product_added' ||
    key === 'product_removed' ||
    key === 'sold_product_added' ||
    key === 'sold_product_removed'
  ) {
    return 'products';
  }

  if (
    key === 'status_changed' ||
    key === 'appointment_deleted' ||
    key === 'appointment_restored' ||
    key === 'observation_changed' ||
    key === 'subscriber_attendance_marked' ||
    key === 'subscriber_attendance_auto_failed' ||
    key === 'subscriber_attendance_auto_skipped'
  ) {
    return 'status';
  }

  if (key === 'service_changed') return 'service';

  return 'status';
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const s = String(value ?? '').trim();
    if (s) return s;
  }
  return '';
}

function buildBeforeAfter(label: string, before: unknown, after: unknown, formatFn?: (v: unknown) => string): AuditChangeLine | null {
  const b = formatFn ? formatFn(before) : String(before ?? '').trim() || '—';
  const a = formatFn ? formatFn(after) : String(after ?? '').trim() || '—';
  if (b === '—' && a === '—') return null;
  if (b === a) return { single: `${label}: ${a}` };
  return { label, before: b, after: a };
}

function parseEventDisplay(row: AppointmentAuditLogRow): Pick<AuditDisplayEntry, 'icon' | 'title' | 'changes'> {
  const key = String(row.event_type || '').trim().toLowerCase();
  const oldV = (row.old_values || {}) as Record<string, unknown>;
  const newV = (row.new_values || {}) as Record<string, unknown>;
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const changes: AuditChangeLine[] = [];

  const pushBeforeAfter = (
    label: string,
    beforeKey: unknown,
    afterKey: unknown,
    formatFn?: (v: unknown) => string
  ) => {
    const line = buildBeforeAfter(label, beforeKey, afterKey, formatFn);
    if (line) changes.push(line);
  };

  switch (key) {
    case 'price_changed': {
      pushBeforeAfter('Valor', oldV.price ?? oldV.total_price, newV.price ?? newV.total_price, (v) => formatAuditCurrency(v) || '—');
      if (oldV.total_price !== undefined || newV.total_price !== undefined) {
        const oldTotal = formatAuditCurrency(oldV.total_price);
        const newTotal = formatAuditCurrency(newV.total_price);
        if (oldTotal && newTotal && oldTotal !== newTotal) {
          pushBeforeAfter('Total para cobrar', oldV.total_price, newV.total_price, (v) => formatAuditCurrency(v) || '—');
        }
      }
      return { icon: '💰', title: 'Valor alterado', changes };
    }

    case 'service_changed': {
      pushBeforeAfter('Serviço', oldV.service, newV.service);
      pushBeforeAfter('Valor do serviço', oldV.price, newV.price, (v) => formatAuditCurrency(v) || '—');
      pushBeforeAfter('Duração', oldV.duration, newV.duration, (v) => formatAuditDuration(v) || '—');
      pushBeforeAfter('Total', oldV.total_price, newV.total_price, (v) => formatAuditCurrency(v) || '—');
      return { icon: '✂️', title: 'Serviço alterado', changes };
    }

    case 'rescheduled':
    case 'date_changed': {
      pushBeforeAfter('Data', oldV.appointment_date ?? meta.old_appointment_date, newV.appointment_date ?? meta.new_appointment_date, formatAuditDate);
      pushBeforeAfter('Horário', oldV.appointment_time ?? meta.old_appointment_time, newV.appointment_time ?? meta.new_appointment_time);
      return { icon: key === 'date_changed' ? '📅' : '⏰', title: key === 'date_changed' ? 'Data alterada' : 'Horário alterado', changes };
    }

    case 'professional_transferred': {
      const fromName = pickString(oldV.professional_name, oldV.professional, meta.old_professional_name);
      const toName = pickString(newV.professional_name, newV.professional, meta.new_professional_name);
      if (fromName || toName) {
        changes.push({ label: 'Profissional', before: fromName || '—', after: toName || '—' });
      }
      return { icon: '🔄', title: 'Cliente transferido', changes };
    }

    case 'additional_service_added': {
      const p = (meta.product_added || {}) as Record<string, unknown>;
      const name = pickString(p.name, 'Serviço extra');
      const price = formatAuditCurrency(p.price);
      const duration = formatAuditDuration(p.duration);
      changes.push({
        single: `Serviço: ${name}${price ? ` • ${price}` : ''}${duration ? ` • ${duration}` : ''}`,
      });
      pushBeforeAfter('Total', oldV.total_price, newV.total_price, (v) => formatAuditCurrency(v) || '—');
      return { icon: '⭐', title: 'Serviço extra adicionado', changes };
    }

    case 'additional_service_removed': {
      const p = (meta.product_removed || {}) as Record<string, unknown>;
      const name = pickString(p.name, 'Serviço extra');
      changes.push({ single: `Removido: ${name}` });
      pushBeforeAfter('Total', oldV.total_price, newV.total_price, (v) => formatAuditCurrency(v) || '—');
      return { icon: '⭐', title: 'Serviço extra removido', changes };
    }

    case 'product_added':
    case 'sold_product_added': {
      const p = (meta.product_added || meta.product || {}) as Record<string, unknown>;
      const name = pickString(p.name, 'Produto');
      const price = formatAuditCurrency(p.price ?? p.total ?? p.unit_price);
      changes.push({ single: `Produto: ${name}` });
      if (price) changes.push({ single: `Valor: ${price}` });
      return { icon: '📦', title: 'Produto adicionado', changes };
    }

    case 'product_removed':
    case 'sold_product_removed': {
      const p = (meta.product_removed || meta.product || {}) as Record<string, unknown>;
      const name = pickString(p.name, 'Produto');
      changes.push({ single: `Produto removido: ${name}` });
      return { icon: '📦', title: 'Produto removido', changes };
    }

    case 'payment_method_changed': {
      pushBeforeAfter('Forma de pagamento', oldV.payment_method, newV.payment_method, formatAuditPaymentMethod);
      if (oldV.status !== newV.status) {
        pushBeforeAfter('Status', oldV.status, newV.status, formatAuditStatus);
      }
      const splitDetails = meta.split_details;
      if (Array.isArray(splitDetails) && splitDetails.length > 0) {
        const summary = splitDetails
          .map((row: any) => `${formatAuditPaymentMethod(row?.method)}: ${formatAuditCurrency(row?.amount) || '—'}`)
          .join(' • ');
        if (summary) changes.push({ single: `Detalhes: ${summary}` });
      }
      return { icon: '💵', title: 'Forma de pagamento alterada', changes };
    }

    case 'card_brand_changed': {
      pushBeforeAfter('Bandeira', oldV.card_brand ?? '—', newV.card_brand ?? '—');
      return { icon: '💳', title: 'Bandeira do cartão alterada', changes };
    }

    case 'professional_tip_updated': {
      pushBeforeAfter('Gorjeta', oldV.professional_tip_amount, newV.professional_tip_amount, (v) => formatAuditCurrency(v) || 'R$ 0,00');
      return { icon: '🪙', title: 'Gorjeta alterada', changes };
    }

    case 'status_changed':
    case 'appointment_restored': {
      const oldStatus = formatAuditStatus(oldV.status);
      const newStatus = formatAuditStatus(newV.status);
      if (oldStatus !== newStatus) {
        changes.push({ label: 'Status', before: oldStatus, after: newStatus });
      }
      const action = pickString(meta.action);
      if (action) changes.push({ single: `Ação: ${action}` });
      return {
        icon: '✅',
        title: key === 'appointment_restored' ? 'Agendamento restabelecido' : 'Status alterado',
        changes,
      };
    }

    case 'appointment_deleted': {
      const client = pickString(meta.client_name, oldV.client_name);
      const service = pickString(meta.service, oldV.service);
      const price = formatAuditCurrency(oldV.price ?? oldV.total_price);
      if (client) changes.push({ single: `Cliente: ${client}` });
      if (service) changes.push({ single: `Serviço: ${service}` });
      if (price) changes.push({ single: `Valor: ${price}` });
      return { icon: '🗑️', title: 'Agendamento excluído', changes };
    }

    case 'observation_changed': {
      pushBeforeAfter('Observação', oldV.establishment_observation, newV.establishment_observation);
      return { icon: '📝', title: 'Observações alteradas', changes };
    }

    case 'finished_early': {
      pushBeforeAfter('Duração', oldV.duration, newV.duration, (v) => formatAuditDuration(v) || '—');
      const released = Number(meta.time_released_minutes);
      if (Number.isFinite(released) && released > 0) {
        changes.push({ single: `Tempo liberado: ${Math.round(released)} min` });
      }
      const newEnd = pickString(meta.new_end_time);
      const oldEnd = pickString(meta.original_end_time);
      if (newEnd || oldEnd) {
        changes.push({ single: `Janela: ${newEnd || '—'} até ${oldEnd || '—'}` });
      }
      return { icon: '⏱️', title: 'Atendimento terminou antes', changes };
    }

    case 'subscriber_attendance_marked':
      changes.push({ single: pickString(meta.subscriber_name, 'Assinante registrado') });
      if (meta.attendance_date) changes.push({ single: `Data: ${formatAuditDate(meta.attendance_date)}` });
      pushBeforeAfter('Status', oldV.status, newV.status, formatAuditStatus);
      return { icon: '📋', title: 'Atendimento de assinatura registrado', changes };

    case 'subscriber_attendance_auto_failed':
    case 'subscriber_attendance_auto_skipped':
      if (row.description) changes.push({ single: String(row.description) });
      return {
        icon: '⚠️',
        title: key === 'subscriber_attendance_auto_failed' ? 'Falha no registro de assinatura' : 'Registro de assinatura ignorado',
        changes,
      };

    default: {
      if (row.description) changes.push({ single: String(row.description) });
      const oldPrice = formatAuditCurrency(oldV.total_price ?? oldV.price);
      const newPrice = formatAuditCurrency(newV.total_price ?? newV.price);
      if (oldPrice || newPrice) pushBeforeAfter('Valor', oldV.price ?? oldV.total_price, newV.price ?? newV.total_price, (v) => formatAuditCurrency(v) || '—');
      const oldService = pickString(oldV.service);
      const newService = pickString(newV.service);
      if (oldService || newService) pushBeforeAfter('Serviço', oldService, newService);
      return { icon: '📌', title: key.replace(/_/g, ' ') || 'Evento registrado', changes };
    }
  }
}

export function parseAuditLogRow(row: AppointmentAuditLogRow): AuditDisplayEntry {
  const category = getAuditEventCategory(row.event_type);
  const isNoise = category === 'noise';
  const display = parseEventDisplay(row);

  if (display.changes.length === 0 && row.description) {
    display.changes.push({ single: String(row.description) });
  }

  return {
    id: row.id,
    icon: display.icon,
    title: display.title,
    category: isNoise ? 'all' : category,
    changes: display.changes,
    actor: pickString(row.changed_by_name) || null,
    timestamp: formatAuditDateTime(row.created_at),
    rawEventType: String(row.event_type || ''),
    isNoise,
  };
}

export function filterAuditEntries(
  entries: AuditDisplayEntry[],
  filter: AuditFilterCategory,
  includeNoise = false
): AuditDisplayEntry[] {
  const withoutNoise = includeNoise ? entries : entries.filter((e) => !e.isNoise);
  if (filter === 'all') return withoutNoise;
  return withoutNoise.filter((e) => e.category === filter);
}

export function resolveAuditActorName(params: {
  explicitName?: string | null;
  user?: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null;
  professionalName?: string | null;
}): string | null {
  const explicit = String(params.explicitName || '').trim();
  if (explicit) return explicit;

  const prof = String(params.professionalName || '').trim();
  if (prof) return prof;

  const meta = params.user?.user_metadata || {};
  const fromMeta = String(meta.full_name || meta.name || '').trim();
  if (fromMeta) return fromMeta;

  return String(params.user?.email || '').trim() || null;
}
