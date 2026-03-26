import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../src/lib/supabase';

type InstanceRow = {
  establishment_id: string;
  status: 'pending' | 'connected' | 'active' | 'error' | string;
};

type SettingsRow = {
  establishment_id: string;
  enabled: boolean;
  remind_before_minutes: number;
};

type ReminderLogRaw = {
  appointment_id?: string | null;
  phone_to?: string | null;
  status?: string | null;
  meta_message_id?: string | null;
  meta_status?: string | null;
  last_error?: string | null;
  provider_response?: string | null;
  created_at?: string | null;
  message?: string | null;
};

type AppointmentMini = {
  id: string;
  client_name?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  service_name?: string | null;
  professional?: string | null;
};

type ProfessionalMini = {
  id: string;
  name: string;
};

type ReminderLogView = {
  id: string;
  kind: 'sent' | 'failed' | 'delivered';
  createdAtLabel: string;
  clientName: string;
  scheduleLabel: string;
  serviceName: string;
  professionalName: string;
  phoneTo: string;
  metaMessageId: string | null;
  errorText: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEHOLDER_REGEX = /\{[^}]+\}/;

/**
 * Tela/Bloco para o dashboard do estabelecimento.
 *
 * - Não expõe número/API key
 * - Mostra apenas status “ativo” quando ADMIN liberou e instância está ativa
 */
export function EstablishmentWhatsappRemindersInfo({ establishmentId }: { establishmentId: string }) {
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [mercadoPagoConnected, setMercadoPagoConnected] = useState(false);
  const [logFilter, setLogFilter] = useState<'sent' | 'failed'>('sent');
  const [logRows, setLogRows] = useState<ReminderLogView[]>([]);
  const [logCounters, setLogCounters] = useState({ sent: 0, failed: 0, delivered: 0 });
  const [logLoadError, setLogLoadError] = useState<string | null>(null);

  const ativo = Boolean(settings?.enabled) && instance?.status === 'active';
  const suporteWhatsapp = '5548991265320';

  const statusText = useMemo(() => {
    if (!settings?.enabled) return '❌ Não ativo (admin ainda não liberou)';
    if (!instance) return '🟡 Aguardando configuração da instância pelo admin';
    if (instance.status === 'active') return '✅ Ativo';
    if (instance.status === 'connected') return '🟡 Conectado (aguardando ativação)';
    if (instance.status === 'pending') return '🟠 Pendente';
    if (instance.status === 'error') return '🔴 Erro';
    return String(instance.status);
  }, [settings?.enabled, instance]);

  const canRequestReminderActivation = !ativo;
  const canRequestPaymentActivation = !mercadoPagoConnected;
  const canRequestBothActivation = canRequestReminderActivation || canRequestPaymentActivation;

  const abrirWhatsApp = (tipo: 'lembrete' | 'pagamentos' | 'ambos') => {
    if (tipo === 'lembrete' && !canRequestReminderActivation) {
      toast.success('Lembrete automático já está ativo.');
      return;
    }
    if (tipo === 'pagamentos' && !canRequestPaymentActivation) {
      toast.success('Mercado Pago já está conectado.');
      return;
    }
    if (tipo === 'ambos' && !canRequestBothActivation) {
      toast.success('Lembrete e pagamentos adiantados já estão ativos.');
      return;
    }

    // Se clicar em "os dois", monta mensagem só com o que realmente falta ativar.
    if (tipo === 'ambos') {
      if (canRequestReminderActivation && !canRequestPaymentActivation) {
        const msg = encodeURIComponent(
          `Quero ativar o lembrete automático para clientes (WhatsApp)\n\nEstablishmentId: ${establishmentId}`
        );
        window.open(`https://wa.me/${suporteWhatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!canRequestReminderActivation && canRequestPaymentActivation) {
        const msg = encodeURIComponent(`Quero ativar pagamentos adiantados\n\nEstablishmentId: ${establishmentId}`);
        window.open(`https://wa.me/${suporteWhatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer');
        return;
      }
    }

    const textoBase =
      tipo === 'lembrete'
        ? 'Quero ativar o lembrete automático para clientes (WhatsApp)'
        : tipo === 'pagamentos'
          ? 'Quero ativar pagamentos adiantados'
          : 'Quero ativar lembrete automático (WhatsApp) + pagamentos adiantados';

    const msg = encodeURIComponent(`${textoBase}\n\nEstablishmentId: ${establishmentId}`);
    window.open(`https://wa.me/${suporteWhatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const classifyReminderLog = (row: ReminderLogRaw): 'sent' | 'failed' | 'delivered' => {
    const status = String(row.status || '').toLowerCase();
    const metaStatus = String(row.meta_status || '').toLowerCase();
    if (status === 'failed') return 'failed';
    if (metaStatus === 'delivered' || metaStatus === 'read') return 'delivered';
    return 'sent';
  };

  const isMetaReminderLog = (row: ReminderLogRaw): boolean => {
    const metaStatus = String(row.meta_status || '').toLowerCase().trim();
    if (metaStatus) return true;

    const providerResponse = String(row.provider_response || '').toLowerCase();
    if (!providerResponse) return false;

    // Heurísticas para identificar resposta da Meta Cloud API
    return (
      providerResponse.includes('"messaging_product":"whatsapp"') ||
      providerResponse.includes('"messaging_product": "whatsapp"') ||
      providerResponse.includes('"contacts"') ||
      providerResponse.includes('"messages"') ||
      providerResponse.includes('whatsapp_business_api_data')
    );
  };

  const formatCreatedAt = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
  };

  const formatSchedule = (apt: AppointmentMini | null | undefined): string => {
    const date = String(apt?.appointment_date || '').trim();
    const time = String(apt?.appointment_time || '').trim();
    if (!date && !time) return '-';
    const dateLabel = date
      ? (() => {
          const d = new Date(`${date}T00:00:00`);
          if (Number.isNaN(d.getTime())) return date;
          return d.toLocaleDateString('pt-BR');
        })()
      : '';
    const timeLabel = time ? time.slice(0, 5) : '';
    return `${dateLabel}${dateLabel && timeLabel ? ' às ' : ''}${timeLabel}`.trim() || '-';
  };

  const extractClientNameFromMessage = (message: string): string | null => {
    const normalized = String(message || '').replace(/\n/g, ' ');
    const match = normalized.match(/Cliente:\s*([^.\n]+)/i);
    if (!match) return null;
    const value = String(match[1] || '').trim();
    return value || null;
  };

  const sanitizeParsedField = (value: string | null | undefined): string | null => {
    const v = String(value || '').trim();
    if (!v) return null;
    if (v === '-' || v === '—') return null;
    if (PLACEHOLDER_REGEX.test(v)) return null;
    return v;
  };

  const extractLineValue = (message: string, patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const parsed = sanitizeParsedField(String(match[1] || ''));
        if (parsed) return parsed;
      }
    }
    return null;
  };

  const extractFallbackFromMessage = (message: string) => {
    const raw = String(message || '');
    const clientName =
      extractLineValue(raw, [/Ol[aá]\s+([^!\n\r]+)!?/i, /Cliente:\s*([^\n\r]+)/i]) || extractClientNameFromMessage(raw);
    const dateLabel = extractLineValue(raw, [/(?:📅|Data:)\s*([^\n\r]+)/i]);
    const timeLabel = extractLineValue(raw, [/(?:⏰|Hor[aá]rio:)\s*([^\n\r]+)/i]);
    const serviceName = extractLineValue(raw, [/(?:✂️|✂|Servi[cç]o:)\s*([^\n\r]+)/i]);
    const professionalName = extractLineValue(raw, [/(?:👨‍💼|Profissional:)\s*([^\n\r]+)/i]);
    const scheduleLabel = [dateLabel, timeLabel].filter(Boolean).join(' às ').trim() || null;
    return {
      clientName,
      scheduleLabel,
      serviceName,
      professionalName,
    };
  };

  const isUuid = (value: string | null | undefined): boolean => UUID_REGEX.test(String(value || '').trim());

  const extractSupabaseErrorMessage = (errorLike: any): string => {
    const message = String(errorLike?.message || '').trim();
    const code = String(errorLike?.code || '').trim();
    const details = String(errorLike?.details || '').trim();
    const hint = String(errorLike?.hint || '').trim();
    const parts = [message, code ? `(code: ${code})` : '', details ? `detalhes: ${details}` : '', hint ? `dica: ${hint}` : '']
      .filter(Boolean)
      .join(' • ');
    return parts || 'Erro inesperado ao carregar histórico.';
  };

  const loadReminderLogs = async () => {
    if (!establishmentId) return;
    setLogsLoading(true);
    setLogLoadError(null);
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Compatibilidade com bancos em versões diferentes (com/sem colunas novas).
      const logSelectCandidates = [
        'appointment_id,phone_to,status,meta_message_id,meta_status,last_error,provider_response,created_at,message',
        'appointment_id,phone_to,status,meta_message_id,meta_status,provider_response,created_at,message',
        'appointment_id,phone_to,status,meta_message_id,meta_status,created_at,message',
        'appointment_id,phone_to,status,meta_message_id,created_at,message',
        'appointment_id,phone_to,status,created_at,message',
      ];

      let rows: ReminderLogRaw[] = [];
      let logsLoaded = false;
      let lastLogsError: any = null;
      for (const selectCols of logSelectCandidates) {
        const { data, error } = await supabase
          .from('whatsapp_reminder_logs')
          .select(selectCols)
          .eq('establishment_id', establishmentId)
          .gte('created_at', monthStart.toISOString())
          .order('created_at', { ascending: false });
        if (!error) {
          rows = (data as ReminderLogRaw[]) || [];
          logsLoaded = true;
          break;
        }
        lastLogsError = error;
      }
      if (!logsLoaded) throw lastLogsError || new Error('Falha ao carregar logs de WhatsApp.');
      const metaRows = rows.filter(isMetaReminderLog);

      const appointmentIds = Array.from(
        new Set(metaRows.map(r => String(r.appointment_id || '').trim()).filter(Boolean))
      );
      // Compatibilidade: logs antigos podem ter appointment_id fora do formato UUID.
      const appointmentLookupIds = appointmentIds.filter(id => isUuid(id));

      const professionalsById = new Map<string, string>();
      const { data: estData, error: estErr } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishmentId)
        .maybeSingle();
      if (!estErr) {
        const professionalsRaw = (estData as any)?.professionals;
        if (Array.isArray(professionalsRaw)) {
          for (const item of professionalsRaw) {
            const p = item as ProfessionalMini;
            const pid = String((p as any)?.id || '').trim();
            const pname = String((p as any)?.name || '').trim();
            if (pid && pname) professionalsById.set(pid, pname);
          }
        }
      }

      const appointmentById = new Map<string, AppointmentMini>();
      if (appointmentLookupIds.length > 0) {
        const appointmentSelectCandidates = [
          'id,client_name,appointment_date,appointment_time,service_name,professional',
          'id,client_name,appointment_date,appointment_time,service,professional',
        ];
        let loadedAppointments = false;
        let lastAppointmentError: any = null;
        for (const selectCols of appointmentSelectCandidates) {
          const { data: aptData, error: aptErr } = await supabase
            .from('appointments')
            .select(selectCols)
            .in('id', appointmentLookupIds);
          if (!aptErr) {
            for (const apt of (aptData as any[]) || []) {
              appointmentById.set(String(apt.id), apt as AppointmentMini);
            }
            loadedAppointments = true;
            break;
          }
          lastAppointmentError = aptErr;
        }
        if (!loadedAppointments) {
          // Não derruba a UI: mantém histórico com fallback por mensagem/telefone.
          console.warn('Aviso ao carregar appointments para histórico WhatsApp:', lastAppointmentError);
        }
      }

      const counters = { sent: 0, failed: 0, delivered: 0 };
      const mapped: ReminderLogView[] = metaRows.map((row, idx) => {
        const kind = classifyReminderLog(row);
        counters[kind] += 1;

        const appointment = appointmentById.get(String(row.appointment_id || '').trim());
        const fallbackFromMessage = extractFallbackFromMessage(String(row.message || ''));
        const fallbackClient = fallbackFromMessage.clientName || 'Cliente não identificado';
        const clientName = String(appointment?.client_name || fallbackClient).trim() || 'Cliente não identificado';
        const scheduleLabel = formatSchedule(appointment) !== '-' ? formatSchedule(appointment) : String(fallbackFromMessage.scheduleLabel || '-');
        const serviceName =
          String((appointment as any)?.service_name || (appointment as any)?.service || '').trim() ||
          String(fallbackFromMessage.serviceName || '-');
        const professionalRaw = String(appointment?.professional || '').trim();
        const looksLikeUuid = isUuid(professionalRaw);
        const professionalNameResolved = looksLikeUuid
          ? String(professionalsById.get(professionalRaw) || professionalRaw || '')
          : String(professionalRaw || '');
        const professionalName = professionalNameResolved.trim() || String(fallbackFromMessage.professionalName || '-');
        const phoneTo = String(row.phone_to || '').trim() || '-';
        const metaMessageId = String(row.meta_message_id || '').trim() || null;
        const errorTextRaw = row.last_error || row.provider_response || null;
        const errorText = errorTextRaw ? String(errorTextRaw).slice(0, 220) : null;

        return {
          id: `${String(row.appointment_id || 'sem-id')}-${idx}`,
          kind,
          createdAtLabel: formatCreatedAt(row.created_at),
          clientName,
          scheduleLabel,
          serviceName,
          professionalName,
          phoneTo,
          metaMessageId,
          errorText,
        };
      });

      setLogCounters(counters);
      setLogRows(mapped);
    } catch (e) {
      console.error(e);
      setLogLoadError(`Não foi possível carregar o histórico. ${extractSupabaseErrorMessage(e)}`);
      setLogCounters({ sent: 0, failed: 0, delivered: 0 });
      setLogRows([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!establishmentId) return;
      setLoading(true);
      try {
        const { data: cfg, error: cfgErr } = await supabase
          .from('whatsapp_reminder_settings')
          .select('establishment_id,enabled,remind_before_minutes')
          .eq('establishment_id', establishmentId)
          .maybeSingle();
        if (cfgErr) throw cfgErr;

        const { data: inst, error: instErr } = await supabase
          .from('whatsapp_instances')
          .select('establishment_id,status')
          .eq('establishment_id', establishmentId)
          .maybeSingle();
        if (instErr) throw instErr;

        // Compatível com bancos que ainda não tenham alguma coluna nova.
        try {
          const { data: estPaymentCfg, error: estPaymentErr } = await supabase
            .from('establishments')
            .select('mercadopago_access_token')
            .eq('id', establishmentId)
            .maybeSingle();
          if (!estPaymentErr) {
            const token = String((estPaymentCfg as any)?.mercadopago_access_token || '').trim();
            setMercadoPagoConnected(Boolean(token));
          } else {
            setMercadoPagoConnected(false);
          }
        } catch {
          setMercadoPagoConnected(false);
        }

        setSettings((cfg as any) || null);
        setInstance((inst as any) || null);
        await loadReminderLogs();
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar status dos lembretes WhatsApp');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [establishmentId]);

  const filteredLogRows = useMemo(() => {
    if (logFilter === 'failed') {
      return logRows.filter(row => row.kind === 'failed');
    }
    // "Enviadas/Entregues": tudo que nao falhou (inclui entregue e aguardando retorno da Meta)
    return logRows.filter(row => row.kind !== 'failed');
  }, [logRows, logFilter]);

  return (
    <div className="w-full">
      <div className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#0b0b0c] to-black p-5 shadow-xl">
        {/* Header (igual ao deploy) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg sm:text-xl font-extrabold text-white">📣 Lembretes para Clientes (WhatsApp)</div>
            <div className="mt-1 text-sm text-gray-300">Status do recurso:</div>
          </div>

          <span className="inline-flex items-center rounded-full bg-gray-800/70 border border-gray-700 px-3 py-1 text-xs font-semibold text-gray-100 w-fit">
            {loading ? 'Carregando...' : statusText}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          {ativo && (
            <div className="lg:col-span-2 rounded-2xl border border-cyan-500/20 bg-black/40 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-bold text-cyan-200">Histórico de envios Meta (mês atual)</div>
                <button
                  type="button"
                  onClick={() => void loadReminderLogs()}
                  className="rounded-lg border border-cyan-500/30 bg-black/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-black/60"
                >
                  Atualizar histórico
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLogFilter('sent')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    logFilter === 'sent'
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                      : 'border-gray-600 bg-black/30 text-gray-200 hover:bg-black/50'
                  }`}
                >
                  Enviadas/Entregues ({logCounters.sent + logCounters.delivered})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('failed')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    logFilter === 'failed'
                      ? 'border-red-400/60 bg-red-500/20 text-red-200'
                      : 'border-gray-600 bg-black/30 text-gray-200 hover:bg-black/50'
                  }`}
                >
                  Falhos ({logCounters.failed})
                </button>
              </div>
              <div className="mt-2 text-[11px] text-gray-400">
                Enviadas/Entregues = mensagens enviadas para a Meta (inclui as que ja foram entregues).
              </div>

              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {logsLoading ? (
                  <div className="rounded-xl border border-gray-700 bg-black/30 p-3 text-sm text-gray-300">Carregando histórico...</div>
                ) : logLoadError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{logLoadError}</div>
                ) : filteredLogRows.length === 0 ? (
                  <div className="rounded-xl border border-gray-700 bg-black/30 p-3 text-sm text-gray-400">
                    Nenhum registro Meta nesse filtro no mês atual.
                  </div>
                ) : (
                  filteredLogRows.map(row => (
                    <div key={row.id} className="rounded-xl border border-gray-700 bg-black/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{row.clientName}</div>
                        <div className="text-[11px] text-gray-400">Enviado em: {row.createdAtLabel}</div>
                      </div>
                      <div className="mt-1 text-xs text-gray-300">
                        Horário agendado: <span className="text-white">{row.scheduleLabel}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-300">
                        Serviço: <span className="text-white">{row.serviceName}</span> • Profissional:{' '}
                        <span className="text-white">{row.professionalName}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">Destino: {row.phoneTo}</div>
                      {row.metaMessageId && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-cyan-200">
                          <span className="break-all">wamid: {row.metaMessageId}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(row.metaMessageId || '');
                                toast.success('wamid copiado.');
                              } catch {
                                toast.error('Não foi possível copiar o wamid.');
                              }
                            }}
                            className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20"
                          >
                            Copiar wamid
                          </button>
                        </div>
                      )}
                      {row.kind === 'failed' && row.errorText && (
                        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-100">
                          Erro: {row.errorText}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Coluna esquerda: visual */}
          <div className="rounded-2xl border border-amber-500/20 bg-black/40 p-4">
            <div className="text-sm font-bold text-amber-200">Visual do lembrete</div>
            <div className="mt-1 text-xs text-amber-200/70">Exemplo de comunicação automática com seu cliente</div>

            <div className="mt-4 overflow-hidden rounded-xl border border-amber-500/10 bg-black/30">
              <img
                src="/lembrete.png"
                alt="Exemplo de lembrete automático no WhatsApp"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Coluna direita: card único (igual ao deploy) */}
          <div className="rounded-2xl border border-emerald-500/25 bg-black/35 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/15 bg-black/30 p-4">
                <div className="text-sm font-bold text-emerald-200">Como funciona</div>
                <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                  Nosso sistema envia mensagem automática para seus clientes no WhatsApp deles. E você consegue ver acima os lembretes
                  enviados.
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/15 bg-black/30 p-4">
                <div className="text-sm font-bold text-emerald-200">O que preciso para esse recurso?</div>
                <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                  Esse recurso é exclusivo do plano{' '}
                  <span className="font-extrabold text-amber-200">Diamante</span>. Ative seu lembrete abaixo e entre hoje mesmo no Diamante.
                </div>
                <div className="mt-2 text-xs text-gray-400 leading-relaxed">
                  <span className="font-semibold text-gray-300">Observação:</span> os pagamentos adiantados estão disponíveis em todos os planos.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/15 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-white">Quer reduzir drasticamente as faltas?</div>
                <span className="inline-flex items-center rounded-full bg-emerald-600/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  Pagamentos Adiantados
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                Seu cliente paga antes de confirmar o agendamento. Você escolhe como quer trabalhar e exige o pagamento ou deixa como opcional.
                O resultado é um atendimento mais sério, mais previsível e com muito menos “furos”.
              </div>

              <ul className="mt-3 space-y-1 text-sm text-gray-200">
                <li>• Cai drasticamente o número de faltas</li>
                <li>• Você protege seu tempo e seu faturamento</li>
                <li>• Seu negócio fica mais profissional</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/15 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-white">Eu pago para ter Pagamentos Adiantados?</div>
                <span className="inline-flex items-center rounded-full bg-gray-700/50 border border-gray-600 px-3 py-1 text-[11px] font-semibold text-gray-200">
                  Não
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                Você não paga mensalidade extra. Existem apenas taxas de processamento pequenas — leia abaixo.
              </div>

              <div className="mt-3 rounded-xl border border-emerald-500/10 bg-black/35 p-3 text-sm text-gray-200">
                <div className="font-bold text-emerald-200 mb-1">Como funciona o recebimento</div>
                <div className="text-sm text-gray-200 leading-relaxed">
                  Ao ativar essa opção, quando o cliente pagar (serviço e/ou assinatura), o valor cai direto na sua conta do{' '}
                  <span className="font-semibold text-white">Mercado Pago</span>. Você pode sacar para sua conta bancária ou deixar no
                  Mercado Pago e usar normalmente (ele também funciona como banco).
                </div>
                <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                  As taxas são baixas: <span className="font-semibold text-white">R$ 1,00 por pagamento</span> + a taxa do próprio Mercado
                  Pago (geralmente bem menor do que as taxas de maquininha de cartão).
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões (igual ao deploy) */}
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={() => abrirWhatsApp('lembrete')}
            disabled={!canRequestReminderActivation}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
              canRequestReminderActivation
                ? 'border-amber-500/30 bg-black/40 text-white hover:bg-black/60'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 cursor-not-allowed'
            }`}
          >
            {canRequestReminderActivation ? 'Quero ativar lembrete automático' : 'Lembrete automático ativo'}
          </button>

          <button
            type="button"
            onClick={() => abrirWhatsApp('pagamentos')}
            disabled={!canRequestPaymentActivation}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
              canRequestPaymentActivation
                ? 'border-emerald-500/30 bg-black/40 text-white hover:bg-black/60'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 cursor-not-allowed'
            }`}
          >
            {canRequestPaymentActivation ? 'Quero ativar pagamentos adiantados' : 'Mercado Pago conectado'}
          </button>

          <button
            type="button"
            onClick={() => abrirWhatsApp('ambos')}
            disabled={!canRequestBothActivation}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-extrabold transition-colors ${
              canRequestBothActivation
                ? 'bg-amber-400 text-black hover:bg-amber-300'
                : 'bg-emerald-500/20 text-emerald-200 cursor-not-allowed border border-emerald-500/30'
            }`}
          >
            {canRequestBothActivation ? 'Quero ativar os dois' : 'Lembrete e pagamentos já ativos'}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          {canRequestBothActivation
            ? 'Para ativar, clique em um botão acima e solicite ao suporte/ADMIN a liberação.'
            : '✅ Lembrete automático ativo e Mercado Pago conectado. Não é necessário solicitar ativação.'}
        </div>
      </div>
    </div>
  );
}


