import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import type { SendMessageInput, SendMessageResult } from './types';

type SchedulerDeps = {
  enqueueOrSend: (payload: SendMessageInput) => Promise<SendMessageResult>;
};

type AppointmentRow = {
  id: string;
  establishment_id: string;
  professional_id?: string | null;
  professional_name?: string | null;
  professional?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_whatsapp?: string | null;
  appointment_date: string;
  appointment_time: string;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cancellation_source?: string | null;
  cancellation_detail?: string | null;
  is_establishment_booking?: boolean | null;
  is_avulso?: boolean | null;
  is_squeeze?: boolean | null;
};

type CancellationNotificationRow = {
  appointment_id?: string | null;
  created_at?: string | null;
};
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'waiting', 'pending_payment'];
const SAFE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed'];

type EstablishmentRow = {
  id: string;
  owner_id: string;
  name?: string | null;
  code?: string | null;
  professionals?: any[] | null;
};

type AutomationSettings = {
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
  reminderTemplate: string;
  greetingEnabled: boolean;
  greetingTemplate: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_REMINDER_MINUTES = new Set([10, 30, 60, 180, 300, 720]);
const DEFAULT_REMINDER_TEMPLATE =
  'Olá, {{cliente_nome}}! 👋✨\n' +
  'Passando para lembrar seu horário na {{barbearia_nome}}.\n' +
  '⏰ Falta {{tempo_lembrete}} para seu atendimento de hoje às {{horario}}.\n' +
  '📅 Data: {{data}}\n' +
  '💈 Profissional: {{profissional_nome}}\n\n' +
  'Te aguardamos! 🤝';
const DEFAULT_GREETING_TEMPLATE =
  'Opa, {{cliente_nome}}! 👋\n' +
  'Obrigado por agendar na {{barbearia_nome}}. Ficamos muito felizes! 🙏\n\n' +
  '📅 Data: {{data}}\n' +
  '⏰ Horário: {{horario}}\n' +
  '💈 Profissional: {{profissional_nome}}\n\n' +
  'Qualquer dúvida, estamos por aqui no WhatsApp 💬';
const DEFAULT_CANCELLATION_TEMPLATE =
  'Poxa, {{cliente_nome}}! 😕\n' +
  'Seu agendamento foi cancelado na {{barbearia_nome}}.\n' +
  'Uma pena não poder te atender desta vez.\n\n' +
  '📅 Data: {{data}}\n' +
  '⏰ Horário: {{horario}}\n' +
  '💈 Profissional: {{profissional_nome}}\n\n' +
  'Se quiser, você pode agendar novamente quando preferir.';
const DEFAULT_PAYMENT_FAILURE_CANCELLATION_TEMPLATE =
  'Poxa, {{cliente_nome}}! 😕\n' +
  'Infelizmente não recebemos seu pagamento e o agendamento foi cancelado.\n\n' +
  '📅 Data: {{data}}\n' +
  '⏰ Horário: {{horario}}\n' +
  '💈 Profissional: {{profissional_nome}}\n\n' +
  'Caso queira tentar novamente, acesse: {{booking_link}}';
const PAYMENT_FAILURE_SOURCES = new Set([
  'system_abandoned_checkout',
  'system_payment_timeout',
  'payment_rejected',
]);

const toDateTime = (dateStr: string, timeStr: string): Date | null => {
  const date = String(dateStr || '').trim();
  const timeRaw = String(timeStr || '').trim();
  const hhmm = timeRaw.match(/^(\d{1,2}):(\d{2})/);
  if (!date || !hhmm) return null;
  const h = Number(hhmm[1]);
  const m = Number(hhmm[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const dt = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const normalizePhone = (raw: string): string => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

const fmtDate = (raw: string): string => {
  const dt = new Date(`${String(raw || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return String(raw || '');
  return dt.toLocaleDateString('pt-BR');
};

const formatReminderOffset = (minutes: number): string => {
  if (minutes === 60) return '1 hora';
  if (minutes === 180) return '3 horas';
  if (minutes === 300) return '5 horas';
  if (minutes === 720) return '12 horas';
  return `${minutes} minutos`;
};

const formatTemplate = (
  templateRaw: string,
  vars: Record<string, string>
): string => {
  const template = String(templateRaw || '').trim();
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key] ?? '';
    return String(value);
  });
};

const isMissingAutomationSettingsTable = (error: any) => {
  const code = String(error?.code || '').trim().toUpperCase();
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || (msg.includes('whatsapp_automation_settings') && msg.includes('does not exist'));
};

const resolveLogStatus = (result: SendMessageResult): 'queued' | 'sent' | 'accepted' | 'failed' => {
  if (!result?.ok) return 'failed';
  if (result.ackConfirmed === false) return 'accepted';
  return String(result.deliveryMode || '').toLowerCase() === 'queued' ? 'queued' : 'sent';
};

export class WhatsAppReminderScheduler {
  private readonly supabase: any;
  private readonly deps: SchedulerDeps;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private settingsCache = new Map<string, AutomationSettings>();
  private dispatchGuard = new Map<string, number>();
  private readonly workerId: number;
  private readonly workerCount: number;
  private readonly schedulerLockKey: string;
  private readonly lockClient: IORedis | null = null;
  private readonly intervalMs: number;

  constructor(deps: SchedulerDeps) {
    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para scheduler de WhatsApp.');
    }
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.deps = deps;
    this.workerId = Math.max(0, Number(process.env.WHATSAPP_WORKER_ID || 0) || 0);
    this.workerCount = Math.max(1, Number(process.env.WHATSAPP_WORKER_COUNT || 1) || 1);
    this.schedulerLockKey = String(process.env.WHATSAPP_SCHEDULER_LOCK_KEY || 'wa:scheduler:leader').trim();
    const configuredIntervalMs = Number(process.env.WHATSAPP_SCHEDULER_INTERVAL_MS || 20_000);
    this.intervalMs = Number.isFinite(configuredIntervalMs)
      ? Math.min(Math.max(configuredIntervalMs, 10_000), 120_000)
      : 20_000;
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    if (redisUrl) {
      this.lockClient = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    void this.runOnce();
    console.log(`✅ Scheduler de WhatsApp (Baileys) iniciado (${this.intervalMs}ms).`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.lockClient?.quit();
  }

  private hashStable(value: string): number {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private belongsToThisWorker(establishmentId: string): boolean {
    if (this.workerCount <= 1) return true;
    const shard = this.hashStable(establishmentId) % this.workerCount;
    return shard === this.workerId;
  }

  private async canRunThisTick(): Promise<boolean> {
    if (!this.lockClient) return true;
    try {
      const token = `${process.pid}:${this.workerId}:${Date.now()}`;
      const lock = await this.lockClient.set(this.schedulerLockKey, token, 'EX', 55, 'NX');
      return lock === 'OK';
    } catch {
      // Se Redis indisponível, mantém operação para não parar automação.
      return true;
    }
  }

  private resolveSenderCandidates(
    appointment: AppointmentRow,
    establishmentById: Map<string, EstablishmentRow>
  ): { candidates: string[]; ownerId: string } {
    const candidates: string[] = [];
    const professionalId =
      String(appointment.professional_id || '').trim() ||
      String(appointment.professional || '').trim();
    if (professionalId && UUID_REGEX.test(professionalId)) candidates.push(professionalId);

    const establishment = establishmentById.get(String(appointment.establishment_id || '').trim());
    const ownerId = String(establishment?.owner_id || '').trim();
    if (ownerId) candidates.push(ownerId);
    return { candidates, ownerId };
  }

  private findSenderUserIdFromCandidates(
    candidates: string[],
    _ownerId: string,
    activeUserIds: Set<string>
  ): string | null {
    if (candidates.length === 0) return null;
    const firstActive = candidates.find((id) => activeUserIds.has(id));
    return firstActive || null;
  }

  private normalizeAutomationSettings(row: any): AutomationSettings {
    const reminderOffset = Number(row?.reminder_offset_minutes || 60);
    return {
      reminderEnabled: row?.reminder_enabled !== false,
      reminderOffsetMinutes: ALLOWED_REMINDER_MINUTES.has(reminderOffset) ? reminderOffset : 60,
      reminderTemplate: String(row?.reminder_template || '').trim() || DEFAULT_REMINDER_TEMPLATE,
      greetingEnabled: row?.greeting_enabled !== false,
      greetingTemplate: String(row?.greeting_template || '').trim() || DEFAULT_GREETING_TEMPLATE,
    };
  }

  private async getAutomationSettings(userId: string): Promise<AutomationSettings> {
    const key = String(userId || '').trim();
    if (!key) return this.normalizeAutomationSettings(null);
    const cached = this.settingsCache.get(key);
    if (cached) return cached;

    let normalized: AutomationSettings;
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_automation_settings')
        .select('reminder_enabled,reminder_offset_minutes,reminder_template,greeting_enabled,greeting_template')
        .eq('user_id', key)
        .maybeSingle();
      if (error) throw error;
      normalized = this.normalizeAutomationSettings(data);
    } catch (error) {
      if (!isMissingAutomationSettingsTable(error)) {
        console.warn('⚠️ Falha ao carregar whatsapp_automation_settings, usando padrão:', error);
      }
      normalized = this.normalizeAutomationSettings(null);
    }
    this.settingsCache.set(key, normalized);
    return normalized;
  }

  private async fetchAppointmentsByWindow(params: {
    dateFrom?: string;
    dateTo?: string;
    createdAfterIso?: string;
    includeNonCancelledAnyStatus?: boolean;
  }): Promise<AppointmentRow[]> {
    const selectCandidates = [
      'id,establishment_id,professional_id,professional_name,professional,client_id,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,is_establishment_booking,is_avulso,is_squeeze',
      'id,establishment_id,professional_id,professional,client_id,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,is_establishment_booking,is_avulso,is_squeeze',
      'id,establishment_id,professional_id,professional_name,professional,client_id,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,is_establishment_booking',
      'id,establishment_id,professional_id,professional,client_id,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,is_establishment_booking',
      'id,establishment_id,professional_id,professional_name,professional,client_id,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at',
      'id,establishment_id,professional_id,professional,client_id,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at',
      'id,establishment_id,professional_id,professional_name,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at',
      'id,establishment_id,professional_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at',
      'id,establishment_id,professional_name,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at',
      'id,establishment_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at',
    ];

    const buildQuery = (selectClause: string, statuses: string[]) => {
      let query = this.supabase
        .from('appointments')
        .select(selectClause);
      if (params.includeNonCancelledAnyStatus) {
        query = query.neq('status', 'cancelled');
      } else {
        query = query.in('status', statuses);
      }
      if (params.dateFrom) query = query.gte('appointment_date', params.dateFrom);
      if (params.dateTo) query = query.lte('appointment_date', params.dateTo);
      if (params.createdAfterIso) query = query.gte('created_at', params.createdAfterIso);
      return query;
    };

    const isMissingColumnError = (error: any) => {
      const code = String(error?.code || '').trim().toUpperCase();
      const msg = String(error?.message || '').toLowerCase();
      return code === '42703' || msg.includes('does not exist');
    };

    const runSelectCandidates = async (statuses: string[]) => {
      let lastMissingColumnError: any = null;
      for (const selectClause of selectCandidates) {
        const result = await buildQuery(selectClause, statuses);
        if (!result.error) return (result.data || []) as AppointmentRow[];
        if (isMissingColumnError(result.error)) {
          lastMissingColumnError = result.error;
          continue;
        }
        throw result.error;
      }
      if (lastMissingColumnError) throw lastMissingColumnError;
      return [] as AppointmentRow[];
    };

    try {
      return await runSelectCandidates(ACTIVE_APPOINTMENT_STATUSES);
    } catch (error: any) {
      const invalidEnum =
        !params.includeNonCancelledAnyStatus &&
        String(error?.code || '').trim().toUpperCase() === '22P02' &&
        String(error?.message || '').toLowerCase().includes('appointment_status');
      if (!invalidEnum) throw error;
      return runSelectCandidates(SAFE_APPOINTMENT_STATUSES);
    }
  }

  private async fetchCancelledAppointmentsSince(updatedAfterIso: string): Promise<AppointmentRow[]> {
    const selectWithMetaAndUpdatedAt =
      'id,establishment_id,professional_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,updated_at,cancellation_source,cancellation_detail';
    const selectWithMetaNoUpdatedAt =
      'id,establishment_id,professional_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,cancellation_source,cancellation_detail';
    const selectFallbackNoProfessionalIdAndUpdatedAt =
      'id,establishment_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,updated_at,cancellation_source,cancellation_detail';
    const selectFallbackNoProfessionalIdNoUpdatedAt =
      'id,establishment_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,cancellation_source,cancellation_detail';

    const oneDayAgoDate = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    const isMissingColumn = (error: any, column: string) => {
      const msg = String(error?.message || '').toLowerCase();
      return msg.includes(column.toLowerCase()) && msg.includes('does not exist');
    };

    const run = async (selectClause: string, strategy: 'updated_at' | 'appointment_date') => {
      let query = this.supabase
        .from('appointments')
        .select(selectClause)
        .eq('status', 'cancelled');

      if (strategy === 'updated_at') {
        query = query
          .gte('updated_at', updatedAfterIso)
          .order('updated_at', { ascending: false });
      } else {
        // Fallback compatível para bancos sem coluna/trigger de updated_at em appointments.
        // Mantém escopo recente para não varrer histórico inteiro.
        query = query
          .gte('appointment_date', oneDayAgoDate)
          .order('created_at', { ascending: false });
      }

      return query.limit(500);
    };

    const mergeUniqueById = (rows: AppointmentRow[]): AppointmentRow[] => {
      const map = new Map<string, AppointmentRow>();
      for (const row of rows) {
        const id = String((row as any)?.id || '').trim();
        if (!id) continue;
        if (!map.has(id)) map.set(id, row);
      }
      return Array.from(map.values());
    };

    const runWithColumnFallback = async (strategy: 'updated_at' | 'appointment_date') => {
      const selectPreferred =
        strategy === 'updated_at' ? selectWithMetaAndUpdatedAt : selectWithMetaNoUpdatedAt;
      const selectWithoutProfessionalId =
        strategy === 'updated_at'
          ? selectFallbackNoProfessionalIdAndUpdatedAt
          : selectFallbackNoProfessionalIdNoUpdatedAt;

      let result = await run(selectPreferred, strategy);
      if (!result.error) return result;

      if (isMissingColumn(result.error, 'professional_id')) {
        result = await run(selectWithoutProfessionalId, strategy);
      }
      return result;
    };

    // 1) Captura por "cancelou agora" (updated_at), quando disponível.
    const byUpdatedAt = await runWithColumnFallback('updated_at');
    // 2) Captura por data do agendamento (fallback robusto para bases sem updated_at confiável).
    const byAppointmentDate = await runWithColumnFallback('appointment_date');

    if (!byUpdatedAt.error && !byAppointmentDate.error) {
      return mergeUniqueById([
        ...((byUpdatedAt.data || []) as AppointmentRow[]),
        ...((byAppointmentDate.data || []) as AppointmentRow[]),
      ]);
    }
    if (!byUpdatedAt.error) return (byUpdatedAt.data || []) as AppointmentRow[];
    if (!byAppointmentDate.error) return (byAppointmentDate.data || []) as AppointmentRow[];

    // Caso ambos falhem, expõe o erro mais relevante.
    if (isMissingColumn(byUpdatedAt.error, 'updated_at')) {
      throw byAppointmentDate.error;
    }
    throw byUpdatedAt.error;
  }

  private async fetchAppointmentsByIds(ids: string[]): Promise<AppointmentRow[]> {
    const normalizedIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
    if (normalizedIds.length === 0) return [];

    const selectCandidates = [
      'id,establishment_id,professional_id,professional_name,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,updated_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,updated_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional_name,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,updated_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,updated_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional_id,professional_name,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional_name,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,cancellation_source,cancellation_detail',
      'id,establishment_id,professional,client_name,client_whatsapp,appointment_date,appointment_time,status,created_at,cancellation_source,cancellation_detail',
    ];

    const isMissingColumnError = (error: any) => {
      const code = String(error?.code || '').trim().toUpperCase();
      const msg = String(error?.message || '').toLowerCase();
      return code === '42703' || msg.includes('does not exist');
    };

    let lastMissingColumnError: any = null;
    for (const selectClause of selectCandidates) {
      const result = await this.supabase
        .from('appointments')
        .select(selectClause)
        .in('id', normalizedIds)
        .eq('status', 'cancelled')
        .limit(1000);

      if (!result.error) return (result.data || []) as AppointmentRow[];
      if (isMissingColumnError(result.error)) {
        lastMissingColumnError = result.error;
        continue;
      }
      throw result.error;
    }

    if (lastMissingColumnError) throw lastMissingColumnError;
    return [];
  }

  private async fetchCancelledAppointmentsFromNotifications(createdAfterIso: string): Promise<AppointmentRow[]> {
    const { data: notificationRows, error: notificationError } = await this.supabase
      .from('establishment_notifications')
      .select('appointment_id,created_at,type')
      .eq('type', 'cancelled_appointment')
      .gte('created_at', createdAfterIso)
      .not('appointment_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (notificationError) throw notificationError;

    const notifications = (notificationRows || []) as CancellationNotificationRow[];
    const appointmentIds = notifications
      .map((row) => String(row.appointment_id || '').trim())
      .filter(Boolean);
    if (appointmentIds.length === 0) return [];

    const notificationCreatedAtByAppointmentId = new Map<string, string>();
    for (const row of notifications) {
      const appointmentId = String(row.appointment_id || '').trim();
      if (!appointmentId) continue;
      const createdAt = String(row.created_at || '').trim();
      if (!createdAt) continue;
      if (!notificationCreatedAtByAppointmentId.has(appointmentId)) {
        notificationCreatedAtByAppointmentId.set(appointmentId, createdAt);
      }
    }

    const appointments = await this.fetchAppointmentsByIds(appointmentIds);
    return appointments.map((appointment) => {
      const appointmentId = String(appointment.id || '').trim();
      if (!appointmentId) return appointment;
      if (String(appointment.updated_at || '').trim()) return appointment;
      const notificationCreatedAt = notificationCreatedAtByAppointmentId.get(appointmentId);
      if (!notificationCreatedAt) return appointment;
      return {
        ...appointment,
        // fallback de "momento do cancelamento" quando a linha não possui updated_at confiável
        updated_at: notificationCreatedAt,
      };
    });
  }

  private safeProfessionalLabel(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (UUID_REGEX.test(normalized)) return '';
    if (/^\d+$/.test(normalized)) return '';
    if (/^profissional\s*\d+$/i.test(normalized)) return '';
    return normalized;
  }

  private findProfessionalInEstablishment(professionals: any[], professionalRef: string): any | null {
    const reference = String(professionalRef || '').trim();
    if (!reference || professionals.length === 0) return null;
    const referenceLower = reference.toLowerCase();

    const byId = professionals.find((item: any) => {
      const ids = [
        item?.id,
        item?.professional_id,
        item?.user_id,
        item?.value,
        item?.uuid,
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      return ids.includes(reference);
    });
    if (byId) return byId;

    const numericIndexMatch = reference.match(/^\d+$/) || reference.match(/^profissional\s*(\d+)$/i);
    const numericIndexRaw = numericIndexMatch
      ? Number(numericIndexMatch[0].replace(/[^\d]/g, ''))
      : Number.NaN;
    if (Number.isInteger(numericIndexRaw) && numericIndexRaw > 0) {
      const oneBasedIndex = numericIndexRaw - 1;
      if (oneBasedIndex >= 0 && oneBasedIndex < professionals.length) {
        return professionals[oneBasedIndex];
      }
    }

    const byName = professionals.find((item: any) => {
      const names = [
        item?.name,
        item?.professional_name,
        item?.nome,
        item?.full_name,
      ]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
      return names.includes(referenceLower);
    });
    return byName || null;
  }

  private resolveProfessionalName(
    appointment: AppointmentRow,
    establishmentById: Map<string, EstablishmentRow>
  ): string {
    const explicitName = this.safeProfessionalLabel(appointment.professional_name);
    if (explicitName) return explicitName;

    const establishment = establishmentById.get(String(appointment.establishment_id || '').trim());
    const professionals = Array.isArray(establishment?.professionals)
      ? establishment?.professionals || []
      : [];

    const candidateRefs = [
      String(appointment.professional_id || '').trim(),
      String(appointment.professional || '').trim(),
    ].filter(Boolean);

    for (const ref of candidateRefs) {
      const match = this.findProfessionalInEstablishment(professionals, ref);
      if (!match) continue;
      const resolvedName =
        this.safeProfessionalLabel(match?.name) ||
        this.safeProfessionalLabel(match?.professional_name) ||
        this.safeProfessionalLabel(match?.nome) ||
        this.safeProfessionalLabel(match?.full_name);
      if (resolvedName) return resolvedName;
    }

    const directName = this.safeProfessionalLabel(appointment.professional);
    if (directName) return directName;

    return 'Profissional não informado';
  }

  private buildBookingUrl(establishment: EstablishmentRow | undefined): string {
    const code = String(establishment?.code || '').trim();
    if (!code) return '';
    const baseUrl = String(process.env.WHATSAPP_BOOKING_BASE_URL || 'https://agendeifacil.com')
      .trim()
      .replace(/\/+$/, '');
    return `${baseUrl}/booking/${encodeURIComponent(code)}`;
  }

  /** Reserva interna (dashboard / Reservar Cliente / encaixe): não envia saudação; lembrete continua normal. */
  private isInternalEstablishmentBooking(
    appointment: AppointmentRow,
    establishmentById: Map<string, EstablishmentRow>
  ): boolean {
    if (Boolean(appointment.is_establishment_booking)) return true;
    if (Boolean(appointment.is_avulso)) return true;
    if (Boolean(appointment.is_squeeze)) return true;

    const establishment = establishmentById.get(String(appointment.establishment_id || '').trim());
    const ownerId = String(establishment?.owner_id || '').trim();
    const clientId = String(appointment.client_id || '').trim();
    if (ownerId && clientId && clientId === ownerId) return true;

    return false;
  }

  private isMissingAppointmentColumnError(error: any, column?: string): boolean {
    const code = String(error?.code || '').trim().toUpperCase();
    const msg = String(error?.message || '').toLowerCase();
    if (code === '42703' || msg.includes('does not exist')) {
      if (!column) return true;
      return msg.includes(column.toLowerCase());
    }
    return false;
  }

  /** Garante flags de origem interna mesmo quando o SELECT em lote caiu em fallback legado. */
  private async hydrateInternalBookingFlags(appointment: AppointmentRow): Promise<AppointmentRow> {
    const aptId = String(appointment.id || '').trim();
    if (!aptId || !UUID_REGEX.test(aptId)) return appointment;

    if (Boolean(appointment.is_establishment_booking) || Boolean(appointment.is_avulso) || Boolean(appointment.is_squeeze)) {
      return appointment;
    }

    const selectAttempts = [
      'client_id,is_establishment_booking,is_avulso,is_squeeze,establishment_id',
      'client_id,is_establishment_booking,is_avulso,establishment_id',
      'client_id,is_establishment_booking,establishment_id',
      'client_id,establishment_id',
    ];

    for (const selectClause of selectAttempts) {
      const { data, error } = await this.supabase
        .from('appointments')
        .select(selectClause)
        .eq('id', aptId)
        .maybeSingle();

      if (!error && data) {
        return { ...appointment, ...(data as Partial<AppointmentRow>) };
      }
      if (error && !this.isMissingAppointmentColumnError(error)) {
        console.warn('[whatsapp/scheduler] Falha ao hidratar flags de agendamento interno:', {
          appointmentId: aptId,
          error: String(error?.message || error),
        });
        break;
      }
    }

    return appointment;
  }

  private async scheduleDelayedReminderIfNeeded(params: {
    appointment: AppointmentRow;
    appointmentAt: Date;
    senderUserId: string;
    recipientPhone: string;
    settings: AutomationSettings;
    establishmentName: string;
    establishmentById: Map<string, EstablishmentRow>;
    existingLogSet: Set<string>;
    now: Date;
  }): Promise<void> {
    const {
      appointment,
      appointmentAt,
      senderUserId,
      recipientPhone,
      settings,
      establishmentName,
      establishmentById,
      existingLogSet,
      now,
    } = params;

    if (!settings.reminderEnabled) return;

    const scheduledReminderType = `reminder_${settings.reminderOffsetMinutes}m`;
    const scheduledReminderKey = `${appointment.id}::${scheduledReminderType}`;
    if (existingLogSet.has(scheduledReminderKey)) return;

    const scheduledReminderAtMs = appointmentAt.getTime() - settings.reminderOffsetMinutes * 60_000;
    const reminderDelayMs = scheduledReminderAtMs - now.getTime();
    if (reminderDelayMs <= 0) return;

    const vars = this.buildTemplateVars(
      appointment,
      establishmentName,
      settings.reminderOffsetMinutes,
      establishmentById
    );

    const reminderReserved = await this.reserveMessageLog({
      appointmentId: appointment.id,
      establishmentId: appointment.establishment_id,
      senderUserId,
      recipientPhone,
      messageType: scheduledReminderType,
    });
    if (!reminderReserved) {
      existingLogSet.add(scheduledReminderKey);
      return;
    }

    existingLogSet.add(scheduledReminderKey);
    const reminderRes = await this.deps.enqueueOrSend({
      userId: senderUserId,
      phone: recipientPhone,
      message: formatTemplate(settings.reminderTemplate, vars),
      idempotencyKey: `${scheduledReminderType}:${appointment.id}`,
      delayMs: reminderDelayMs,
      automationLog: {
        appointmentId: appointment.id,
        messageType: scheduledReminderType,
      },
    });

    if (reminderRes.ok) {
      await this.updateMessageLogStatus({
        appointmentId: appointment.id,
        messageType: scheduledReminderType,
        status: resolveLogStatus(reminderRes),
        error: reminderRes.error || null,
      });
    } else {
      await this.releaseMessageLogReservation(appointment.id, scheduledReminderType);
      existingLogSet.delete(scheduledReminderKey);
    }

    console.info('[whatsapp/scheduler] reminder_scheduled', {
      appointmentId: appointment.id,
      reminderType: scheduledReminderType,
      userId: senderUserId,
      phone: recipientPhone,
      delayMs: reminderDelayMs,
      ok: reminderRes.ok,
      deliveryMode: reminderRes.deliveryMode || 'direct',
      error: reminderRes.error || null,
    });
  }

  private buildCancellationPayload(
    appointment: AppointmentRow,
    establishment: EstablishmentRow | undefined,
    vars: Record<string, string>
  ): { messageType: string; message: string } {
    const source = String(appointment.cancellation_source || '').trim().toLowerCase();
    const detail = String(appointment.cancellation_detail || '').trim().toLowerCase();

    const isPaymentFailure =
      PAYMENT_FAILURE_SOURCES.has(source) ||
      detail.includes('pagamento obrigatório') ||
      detail.includes('pagamento nao') ||
      detail.includes('pagamento não');

    if (isPaymentFailure) {
      const bookingLink = this.buildBookingUrl(establishment);
      const message = formatTemplate(DEFAULT_PAYMENT_FAILURE_CANCELLATION_TEMPLATE, {
        ...vars,
        booking_link: bookingLink || 'link de agendamento da barbearia',
      });
      return { messageType: 'booking_cancelled_payment_failure', message };
    }

    if (source === 'client') {
      return {
        messageType: 'booking_cancelled_client',
        message: formatTemplate(DEFAULT_CANCELLATION_TEMPLATE, vars),
      };
    }

    if (source === 'establishment_staff') {
      return {
        messageType: 'booking_cancelled_establishment',
        message: formatTemplate(DEFAULT_CANCELLATION_TEMPLATE, vars),
      };
    }

    return {
      messageType: 'booking_cancelled',
      message: formatTemplate(DEFAULT_CANCELLATION_TEMPLATE, vars),
    };
  }

  private buildTemplateVars(
    appointment: AppointmentRow,
    establishmentName: string,
    reminderOffsetMinutes: number,
    establishmentById: Map<string, EstablishmentRow>
  ) {
    const clientName = String(appointment.client_name || 'Cliente').trim() || 'Cliente';
    const professionalName = this.resolveProfessionalName(appointment, establishmentById);
    return {
      cliente_nome: clientName,
      barbearia_nome: establishmentName || 'nossa barbearia',
      data: fmtDate(appointment.appointment_date),
      horario: String(appointment.appointment_time || '').slice(0, 5),
      profissional_nome: professionalName,
      tempo_lembrete: formatReminderOffset(reminderOffsetMinutes),
    };
  }

  private async reserveMessageLog(payload: {
    appointmentId: string;
    establishmentId: string;
    senderUserId: string | null;
    recipientPhone: string;
    messageType: string;
  }): Promise<boolean> {
    const { error } = await this.supabase.from('whatsapp_message_logs').insert({
      appointment_id: payload.appointmentId,
      establishment_id: payload.establishmentId,
      sender_user_id: payload.senderUserId,
      recipient_phone: payload.recipientPhone,
      message_type: payload.messageType,
      provider: 'baileys',
      status: 'queued',
      error: null,
      sent_at: null,
    });
    if (!error) return true;
    const code = String(error?.code || '').trim();
    if (code === '23505') return false;
    console.warn('[whatsapp/scheduler] Falha ao reservar log de mensagem:', {
      appointmentId: payload.appointmentId,
      messageType: payload.messageType,
      error: String(error?.message || error),
      code,
    });
    return false;
  }

  private async releaseMessageLogReservation(appointmentId: string, messageType: string) {
    const aptId = String(appointmentId || '').trim();
    const type = String(messageType || '').trim();
    if (!aptId || !type) return;
    const { error } = await this.supabase
      .from('whatsapp_message_logs')
      .delete()
      .eq('provider', 'baileys')
      .eq('appointment_id', aptId)
      .eq('message_type', type)
      .eq('status', 'queued');
    if (error) {
      console.warn('[whatsapp/scheduler] Falha ao liberar reserva de log:', {
        appointmentId: aptId,
        messageType: type,
        error: String(error?.message || error),
      });
    }
  }

  private async updateMessageLogStatus(payload: {
    appointmentId: string;
    messageType: string;
    status: 'queued' | 'sent' | 'accepted' | 'failed';
    error?: string | null;
  }) {
    const { error } = await this.supabase
      .from('whatsapp_message_logs')
      .update({
        status: payload.status,
        error: payload.error || null,
        sent_at: payload.status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('provider', 'baileys')
      .eq('appointment_id', payload.appointmentId)
      .eq('message_type', payload.messageType);
    if (error) {
      console.warn('[whatsapp/scheduler] Falha ao atualizar log de mensagem:', {
        appointmentId: payload.appointmentId,
        messageType: payload.messageType,
        status: payload.status,
        error: String(error?.message || error),
      });
    }
  }

  private isGuarded(messageKey: string, nowMs: number): boolean {
    const lastTs = this.dispatchGuard.get(messageKey);
    if (!lastTs) return false;
    // Evita duplicidade em reinvocações próximas do scheduler.
    return nowMs - lastTs < 30 * 60_000;
  }

  private markGuard(messageKey: string, nowMs: number) {
    this.dispatchGuard.set(messageKey, nowMs);
  }

  private cleanupGuard(nowMs: number) {
    for (const [key, ts] of this.dispatchGuard.entries()) {
      if (nowMs - ts > 6 * 60 * 60_000) this.dispatchGuard.delete(key);
    }
  }

  private async hasExistingMessageLog(appointmentId: string, messageType: string): Promise<boolean> {
    const aptId = String(appointmentId || '').trim();
    if (!aptId || !UUID_REGEX.test(aptId)) return false;
    const { data, error } = await this.supabase
      .from('whatsapp_message_logs')
      .select('id')
      .eq('provider', 'baileys')
      .eq('appointment_id', aptId)
      .eq('message_type', messageType)
      .in('status', ['queued', 'sent', 'accepted'])
      .limit(1);
    if (error) {
      console.warn('[whatsapp/scheduler] Falha ao consultar log existente:', {
        appointmentId: aptId,
        messageType,
        error: String(error?.message || error),
      });
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  async runOnce() {
    if (this.running) return;
    if (!(await this.canRunThisTick())) return;
    this.running = true;
    try {
      this.settingsCache.clear();
      this.cleanupGuard(Date.now());
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const createdAfter = new Date(now.getTime() - 120 * 60_000).toISOString();
      const cancelledAfter = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
      const [reminderCandidates, recentCandidates, cancelledCandidatesRaw, cancelledByNotificationsRaw] = await Promise.all([
        this.fetchAppointmentsByWindow({
          dateFrom: today.toISOString().slice(0, 10),
          dateTo: tomorrow.toISOString().slice(0, 10),
        }),
        this.fetchAppointmentsByWindow({
          createdAfterIso: createdAfter,
          includeNonCancelledAnyStatus: true,
        }),
        this.fetchCancelledAppointmentsSince(cancelledAfter).catch((error) => {
          console.warn('[whatsapp/scheduler] Falha ao buscar cancelamentos recentes:', error);
          return [] as AppointmentRow[];
        }),
        this.fetchCancelledAppointmentsFromNotifications(cancelledAfter).catch((error) => {
          console.warn('[whatsapp/scheduler] Falha ao buscar cancelamentos via establishment_notifications:', error);
          return [] as AppointmentRow[];
        }),
      ]);

      const recentIdSet = new Set(recentCandidates.map((apt) => String(apt.id || '').trim()).filter(Boolean));
      const mergedMap = new Map<string, AppointmentRow>();
      [...reminderCandidates, ...recentCandidates].forEach((apt) => {
        const id = String(apt.id || '').trim();
        if (!id) return;
        const existing = mergedMap.get(id);
        if (!existing) {
          mergedMap.set(id, apt);
          return;
        }
        mergedMap.set(id, {
          ...existing,
          ...apt,
          client_id: apt.client_id ?? existing.client_id,
          is_establishment_booking: apt.is_establishment_booking ?? existing.is_establishment_booking,
          is_avulso: apt.is_avulso ?? existing.is_avulso,
          is_squeeze: apt.is_squeeze ?? existing.is_squeeze,
        });
      });
      const appointments = Array.from(mergedMap.values()).filter((apt) => {
        const phone = normalizePhone(String(apt.client_whatsapp || ''));
        const establishmentId = String(apt.establishment_id || '').trim();
        return Boolean(phone) && Boolean(establishmentId) && this.belongsToThisWorker(establishmentId);
      });
      const cancelledCandidatesMergedMap = new Map<string, AppointmentRow>();
      [...(cancelledCandidatesRaw || []), ...(cancelledByNotificationsRaw || [])].forEach((apt) => {
        const id = String(apt.id || '').trim();
        if (!id) return;
        const existing = cancelledCandidatesMergedMap.get(id);
        if (!existing) {
          cancelledCandidatesMergedMap.set(id, apt);
          return;
        }
        // mantém o registro com melhor informação temporal
        const existingUpdatedAt = new Date(String(existing.updated_at || existing.created_at || ''));
        const nextUpdatedAt = new Date(String(apt.updated_at || apt.created_at || ''));
        const shouldReplace =
          Number.isFinite(nextUpdatedAt.getTime()) &&
          (!Number.isFinite(existingUpdatedAt.getTime()) || nextUpdatedAt.getTime() > existingUpdatedAt.getTime());
        if (shouldReplace) cancelledCandidatesMergedMap.set(id, apt);
      });

      const cancelledAppointments = Array.from(cancelledCandidatesMergedMap.values()).filter((apt) => {
        const phone = normalizePhone(String(apt.client_whatsapp || ''));
        const establishmentId = String(apt.establishment_id || '').trim();
        return Boolean(phone) && Boolean(establishmentId) && this.belongsToThisWorker(establishmentId);
      });

      if (appointments.length === 0 && cancelledAppointments.length === 0) return;

      const establishmentIds = Array.from(
        new Set(
          [...appointments, ...cancelledAppointments]
            .map((apt) => String(apt.establishment_id || '').trim())
            .filter(Boolean)
        )
      );

      const { data: establishmentsData } = await this.supabase
        .from('establishments')
        .select('id,owner_id,name,code,professionals')
        .in('id', establishmentIds);

      const establishmentById = new Map<string, EstablishmentRow>();
      ((establishmentsData || []) as EstablishmentRow[]).forEach((row) => {
        establishmentById.set(String(row.id), row);
      });

      const appointmentIds = Array.from(
        new Set(
          [...appointments, ...cancelledAppointments]
            .map((apt) => String(apt.id || '').trim())
            .filter(Boolean)
        )
      );
      const { data: existingLogsData } = await this.supabase
        .from('whatsapp_message_logs')
        .select('appointment_id,message_type,provider,status')
        .eq('provider', 'baileys')
        .in('appointment_id', appointmentIds);

      const existingLogSet = new Set(
        ((existingLogsData || []) as any[])
          .filter((row: any) => {
            const status = String(row?.status || '').toLowerCase();
            return status === 'queued' || status === 'sent' || status === 'accepted';
          })
          .map((row: any) => `${row.appointment_id}::${row.message_type}`)
      );

      // Evita processar massa histórica desnecessária: mantém apenas itens com
      // confirmação recente ou lembrete potencial para as próximas 12h.
      const maxReminderMs = 12 * 60 * 60_000;
      const nowMs = now.getTime();
      const scopedAppointments = appointments.filter((appointment) => {
        const appointmentId = String(appointment.id || '').trim();
        if (!appointmentId) return false;
        if (recentIdSet.has(appointmentId)) return true;
        const appointmentAt = toDateTime(appointment.appointment_date, appointment.appointment_time);
        if (!appointmentAt) return false;
        const diffMs = appointmentAt.getTime() - nowMs;
        return diffMs >= 0 && diffMs <= maxReminderMs;
      });
      const scopedCancelledAppointments = cancelledAppointments.filter((appointment) => {
        const appointmentId = String(appointment.id || '').trim();
        if (!appointmentId) return false;
        const changedAt = new Date(String(appointment.updated_at || appointment.created_at || ''));
        if (!Number.isFinite(changedAt.getTime())) return true;
        return now.getTime() - changedAt.getTime() <= 24 * 60 * 60_000;
      });

      if (scopedAppointments.length === 0 && scopedCancelledAppointments.length === 0) return;

      // Busca status de sessão em lote para evitar N+1 e reduzir latência.
      const senderCandidateSet = new Set<string>();
      const senderCandidatesByAppointmentId = new Map<string, { candidates: string[]; ownerId: string }>();
      for (const appointment of [...scopedAppointments, ...scopedCancelledAppointments]) {
        const resolved = this.resolveSenderCandidates(appointment, establishmentById);
        senderCandidatesByAppointmentId.set(String(appointment.id || '').trim(), resolved);
        resolved.candidates.forEach((id) => senderCandidateSet.add(id));
      }
      let activeUserIds = new Set<string>();
      const senderCandidates = Array.from(senderCandidateSet).filter(Boolean);
      if (senderCandidates.length > 0) {
        const { data: sessionsData } = await this.supabase
          .from('whatsapp_sessions')
          .select('user_id,status')
          .in('user_id', senderCandidates);
        activeUserIds = new Set(
          ((sessionsData || []) as any[])
            .filter((row: any) => String(row?.status || '').toLowerCase() === 'connected')
            .map((row: any) => String(row?.user_id || '').trim())
            .filter(Boolean)
        );
      }

      for (const appointment of scopedAppointments) {
        const recipientPhone = normalizePhone(String(appointment.client_whatsapp || ''));
        if (!recipientPhone) continue;

        const senderResolution = senderCandidatesByAppointmentId.get(String(appointment.id || '').trim());
        const senderUserId = this.findSenderUserIdFromCandidates(
          senderResolution?.candidates || [],
          senderResolution?.ownerId || '',
          activeUserIds
        );
        if (!senderUserId) continue;
        const settings = await this.getAutomationSettings(senderUserId);
        const establishmentName =
          String(establishmentById.get(String(appointment.establishment_id || '').trim())?.name || '').trim() ||
          'nossa barbearia';

        const createdAt = new Date(String(appointment.created_at || ''));
        const appointmentAt = toDateTime(appointment.appointment_date, appointment.appointment_time);
        if (!appointmentAt) continue;

        const hydratedAppointment = await this.hydrateInternalBookingFlags(appointment);
        const isInternalBooking = this.isInternalEstablishmentBooking(hydratedAppointment, establishmentById);
        const isRecentlyCreated =
          recentIdSet.has(String(appointment.id || '').trim()) &&
          Number.isFinite(createdAt.getTime()) &&
          now.getTime() - createdAt.getTime() <= 120 * 60_000;

        // 1) confirmação de agendamento (até 2h após criação, com deduplicação por log/idempotência)
        const confirmationKey = `${appointment.id}::booking_confirmation`;
        const guardedConfirmation = this.isGuarded(confirmationKey, now.getTime());
        const alreadyLoggedConfirmation = existingLogSet.has(confirmationKey);
        const shouldSendConfirmation =
          settings.greetingEnabled &&
          isRecentlyCreated &&
          !isInternalBooking &&
          !guardedConfirmation &&
          !alreadyLoggedConfirmation;

        if (isRecentlyCreated && isInternalBooking) {
          console.info('[whatsapp/scheduler] booking_confirmation_skipped_internal', {
            appointmentId: appointment.id,
            userId: senderUserId,
            phone: recipientPhone,
            is_establishment_booking: Boolean(hydratedAppointment.is_establishment_booking),
            is_avulso: Boolean(hydratedAppointment.is_avulso),
            is_squeeze: Boolean(hydratedAppointment.is_squeeze),
            client_id: String(hydratedAppointment.client_id || '').trim() || null,
          });
        }

        if (shouldSendConfirmation) {
          const vars = this.buildTemplateVars(
            hydratedAppointment,
            establishmentName,
            settings.reminderOffsetMinutes,
            establishmentById
          );
          const reserved = await this.reserveMessageLog({
            appointmentId: appointment.id,
            establishmentId: appointment.establishment_id,
            senderUserId,
            recipientPhone,
            messageType: 'booking_confirmation',
          });
          if (!reserved) {
            existingLogSet.add(confirmationKey);
            continue;
          }
          existingLogSet.add(confirmationKey);
          this.markGuard(confirmationKey, now.getTime());
          const res = await this.deps.enqueueOrSend({
            userId: senderUserId,
            phone: recipientPhone,
            message: formatTemplate(settings.greetingTemplate, vars),
            idempotencyKey: `booking_confirmation:${appointment.id}`,
            automationLog: {
              appointmentId: appointment.id,
              messageType: 'booking_confirmation',
            },
          });
          await this.updateMessageLogStatus({
            appointmentId: appointment.id,
            messageType: 'booking_confirmation',
            status: resolveLogStatus(res),
            error: res.error || null,
          });
          console.info('[whatsapp/scheduler] booking_confirmation', {
            appointmentId: appointment.id,
            userId: senderUserId,
            phone: recipientPhone,
            ok: res.ok,
            deliveryMode: res.deliveryMode || 'direct',
            error: res.error || null,
          });

          // Programa o lembrete no momento em que a saudação é reconhecida.
          // O scheduler abaixo continua como fallback caso o job programado não exista.
          await this.scheduleDelayedReminderIfNeeded({
            appointment: hydratedAppointment,
            appointmentAt,
            senderUserId,
            recipientPhone,
            settings,
            establishmentName,
            establishmentById,
            existingLogSet,
            now,
          });
        } else if (isInternalBooking && isRecentlyCreated) {
          await this.scheduleDelayedReminderIfNeeded({
            appointment: hydratedAppointment,
            appointmentAt,
            senderUserId,
            recipientPhone,
            settings,
            establishmentName,
            establishmentById,
            existingLogSet,
            now,
          });
        }

        // 2) lembrete no tempo configurado
        const reminderType = `reminder_${settings.reminderOffsetMinutes}m`;
        const reminderKey = `${appointment.id}::${reminderType}`;
        const guardedReminder = this.isGuarded(reminderKey, now.getTime());
        const alreadyLoggedReminder = existingLogSet.has(reminderKey);
        const diffMs = appointmentAt.getTime() - now.getTime();
        const targetMs = settings.reminderOffsetMinutes * 60_000;
        // Não perde o lembrete: após bater o tempo alvo, envia em qualquer ciclo até o início do agendamento.
        const isDue = diffMs <= targetMs && diffMs >= 0;
        if (settings.reminderEnabled && !guardedReminder && !alreadyLoggedReminder && isDue) {
          const vars = this.buildTemplateVars(
            appointment,
            establishmentName,
            settings.reminderOffsetMinutes,
            establishmentById
          );
          const reserved = await this.reserveMessageLog({
            appointmentId: appointment.id,
            establishmentId: appointment.establishment_id,
            senderUserId,
            recipientPhone,
            messageType: reminderType,
          });
          if (!reserved) {
            existingLogSet.add(reminderKey);
            continue;
          }
          existingLogSet.add(reminderKey);
          this.markGuard(reminderKey, now.getTime());
          const res = await this.deps.enqueueOrSend({
            userId: senderUserId,
            phone: recipientPhone,
            message: formatTemplate(settings.reminderTemplate, vars),
            idempotencyKey: `${reminderType}:${appointment.id}`,
            automationLog: {
              appointmentId: appointment.id,
              messageType: reminderType,
            },
          });
          await this.updateMessageLogStatus({
            appointmentId: appointment.id,
            messageType: reminderType,
            status: resolveLogStatus(res),
            error: res.error || null,
          });
          console.info('[whatsapp/scheduler] reminder', {
            appointmentId: appointment.id,
            reminderType,
            userId: senderUserId,
            phone: recipientPhone,
            ok: res.ok,
            deliveryMode: res.deliveryMode || 'direct',
            error: res.error || null,
          });
        }
      }

      // 3) cancelamento de agendamento (cliente, estabelecimento e falha de pagamento obrigatório)
      for (const appointment of scopedCancelledAppointments) {
        const recipientPhone = normalizePhone(String(appointment.client_whatsapp || ''));
        if (!recipientPhone) continue;

        const senderResolution = senderCandidatesByAppointmentId.get(String(appointment.id || '').trim());
        const senderUserId = this.findSenderUserIdFromCandidates(
          senderResolution?.candidates || [],
          senderResolution?.ownerId || '',
          activeUserIds
        );
        if (!senderUserId) continue;

        const settings = await this.getAutomationSettings(senderUserId);
        const establishment = establishmentById.get(String(appointment.establishment_id || '').trim());
        const establishmentName = String(establishment?.name || '').trim() || 'nossa barbearia';
        const vars = this.buildTemplateVars(
          appointment,
          establishmentName,
          settings.reminderOffsetMinutes,
          establishmentById
        );
        const cancellationPayload = this.buildCancellationPayload(appointment, establishment, vars);
        const cancellationKey = `${appointment.id}::${cancellationPayload.messageType}`;
        const guardedCancellation = this.isGuarded(cancellationKey, now.getTime());
        const alreadyLoggedCancellation = existingLogSet.has(cancellationKey);
        if (guardedCancellation || alreadyLoggedCancellation) continue;

        const reserved = await this.reserveMessageLog({
          appointmentId: appointment.id,
          establishmentId: appointment.establishment_id,
          senderUserId,
          recipientPhone,
          messageType: cancellationPayload.messageType,
        });
        if (!reserved) {
          existingLogSet.add(cancellationKey);
          continue;
        }

        existingLogSet.add(cancellationKey);
        this.markGuard(cancellationKey, now.getTime());
        const res = await this.deps.enqueueOrSend({
          userId: senderUserId,
          phone: recipientPhone,
          message: cancellationPayload.message,
          idempotencyKey: `${cancellationPayload.messageType}:${appointment.id}`,
          automationLog: {
            appointmentId: appointment.id,
            messageType: cancellationPayload.messageType,
          },
        });
        await this.updateMessageLogStatus({
          appointmentId: appointment.id,
          messageType: cancellationPayload.messageType,
          status: resolveLogStatus(res),
          error: res.error || null,
        });
        console.info('[whatsapp/scheduler] cancellation', {
          appointmentId: appointment.id,
          messageType: cancellationPayload.messageType,
          userId: senderUserId,
          phone: recipientPhone,
          ok: res.ok,
          deliveryMode: res.deliveryMode || 'direct',
          error: res.error || null,
        });
      }
    } catch (error) {
      console.error('❌ Erro no scheduler de WhatsApp (Baileys):', error);
    } finally {
      this.running = false;
    }
  }
}
