import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Flame,
  Gem,
  Scissors,
  Search,
  Sparkles,
  Star,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type AttendanceRow = {
  id?: string;
  client_subscription_id?: string | null;
  client_name_snapshot?: string | null;
  subscription_name_snapshot?: string | null;
  appointment_id?: string | null;
  attendance_date?: string | null;
  repass_value?: number | null;
  created_at?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
};

type ClientSubscriptionLite = {
  id?: string;
  subscriber_professional_id?: string | null;
  start_date?: string | null;
  client_name_override?: string | null;
  subscriber_name?: string | null;
  profiles?: { full_name?: string | null } | null;
};

type AppointmentLite = {
  id: string;
  appointment_time?: string | null;
  service?: string | null;
};

export type ProfessionalAttendedClientsModalProps = {
  open: boolean;
  onClose: () => void;
  professional: string;
  groupKey: string;
  subscriberAttendances: AttendanceRow[];
  clientSubscriptions: ClientSubscriptionLite[];
  selectedMonth: number;
  selectedYear: number;
  monthLabel: string;
  establishmentId: string;
  fmtBRL: (value: number) => string;
  getProfessionalGroupFromAttendance: (attendance: AttendanceRow) => { groupKey: string; displayName: string };
  getAttendanceEffectiveRepass: (attendance: AttendanceRow) => number;
  exclusiveSubscriberIds: Set<string>;
};

type AttendanceEntry = {
  id: string;
  date: string;
  time: string;
  service: string;
  value: number;
};

type AttendedClientRow = {
  key: string;
  clientSubId: string | null;
  name: string;
  entries: AttendanceEntry[];
  totalValue: number;
  attendanceCount: number;
  lastDate: string;
  lastTime: string;
  isExclusive: boolean;
  isNewClient: boolean;
  isFrequent: boolean;
};

type SortMode = 'recent' | 'count' | 'value' | 'name';

const formatDisplayDate = (isoDate: string): string => {
  const raw = String(isoDate || '').slice(0, 10);
  if (!raw) return '—';
  try {
    return format(parseISO(raw), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return raw.split('-').reverse().join('/');
  }
};

const timeFromCreatedAt = (createdAt: unknown): string => {
  const raw = String(createdAt || '').trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return '—';
  return format(date, 'HH:mm');
};

const normalizeTime = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  return raw;
};

export const ProfessionalAttendedClientsModal: React.FC<ProfessionalAttendedClientsModalProps> = ({
  open,
  onClose,
  professional,
  groupKey,
  subscriberAttendances,
  clientSubscriptions,
  selectedMonth,
  selectedYear,
  monthLabel,
  establishmentId,
  fmtBRL,
  getProfessionalGroupFromAttendance,
  getAttendanceEffectiveRepass,
  exclusiveSubscriberIds,
}) => {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [appointmentById, setAppointmentById] = useState<Record<string, AppointmentLite>>({});

  const clientSubById = useMemo(() => {
    const map = new Map<string, ClientSubscriptionLite>();
    (clientSubscriptions || []).forEach((cs) => {
      const id = String(cs?.id || '').trim();
      if (id) map.set(id, cs);
    });
    return map;
  }, [clientSubscriptions]);

  const professionalAttendances = useMemo(
    () =>
      (subscriberAttendances || []).filter(
        (attendance) => getProfessionalGroupFromAttendance(attendance).groupKey === groupKey
      ),
    [subscriberAttendances, groupKey, getProfessionalGroupFromAttendance]
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSortMode('recent');
      setExpandedKey(null);
      setAppointmentById({});
      return;
    }

    const appointmentIds = Array.from(
      new Set(
        professionalAttendances
          .map((row) => String(row?.appointment_id || '').trim())
          .filter(Boolean)
      )
    );

    if (appointmentIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, appointment_time, service')
          .eq('establishment_id', establishmentId)
          .in('id', appointmentIds);

        if (error || cancelled) return;

        const map: Record<string, AppointmentLite> = {};
        (data || []).forEach((row: any) => {
          const id = String(row?.id || '').trim();
          if (!id) return;
          map[id] = {
            id,
            appointment_time: row?.appointment_time,
            service: row?.service,
          };
        });
        if (!cancelled) setAppointmentById(map);
      } catch {
        // Horário/serviço são enriquecimento visual; segue com fallback.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, professionalAttendances, establishmentId]);

  const clientRows = useMemo(() => {
    const monthStart = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
    const monthEnd = format(new Date(selectedYear, selectedMonth + 1, 0), 'yyyy-MM-dd');

    const grouped = new Map<string, AttendedClientRow>();

    professionalAttendances.forEach((attendance) => {
      const clientSubId = String(attendance?.client_subscription_id || '').trim() || null;
      const snapshotName = String(attendance?.client_name_snapshot || '').trim();
      const clientKey = clientSubId || (snapshotName ? `snap:${snapshotName}` : `att:${attendance.id}`);

      const cs = clientSubId ? clientSubById.get(clientSubId) : undefined;
      const name =
        snapshotName ||
        String(cs?.client_name_override || cs?.subscriber_name || cs?.profiles?.full_name || 'Cliente').trim() ||
        'Cliente';

      const appointmentId = String(attendance?.appointment_id || '').trim();
      const linkedAppointment = appointmentId ? appointmentById[appointmentId] : undefined;
      const date = String(attendance?.attendance_date || '').slice(0, 10);
      const time = linkedAppointment?.appointment_time
        ? normalizeTime(linkedAppointment.appointment_time)
        : timeFromCreatedAt(attendance?.created_at);
      const service =
        String(linkedAppointment?.service || attendance?.subscription_name_snapshot || 'Atendimento assinatura').trim() ||
        'Atendimento assinatura';
      const value = getAttendanceEffectiveRepass(attendance);

      const entry: AttendanceEntry = {
        id: String(attendance?.id || `${date}-${time}-${clientKey}`),
        date,
        time,
        service,
        value,
      };

      const existing = grouped.get(clientKey);
      if (!existing) {
        const startDate = String(cs?.start_date || '').slice(0, 10);
        const isNewClient =
          Boolean(startDate) && startDate >= monthStart && startDate <= monthEnd;

        grouped.set(clientKey, {
          key: clientKey,
          clientSubId,
          name,
          entries: [entry],
          totalValue: value,
          attendanceCount: 1,
          lastDate: date,
          lastTime: time,
          isExclusive: Boolean(clientSubId && exclusiveSubscriberIds.has(clientSubId)),
          isNewClient,
          isFrequent: false,
        });
        return;
      }

      existing.entries.push(entry);
      existing.totalValue += value;
      existing.attendanceCount += 1;
      if (date > existing.lastDate || (date === existing.lastDate && time > existing.lastTime)) {
        existing.lastDate = date;
        existing.lastTime = time;
      }
    });

    grouped.forEach((row) => {
      row.isFrequent = row.attendanceCount >= 3;
      row.entries.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return b.time.localeCompare(a.time);
      });
    });

    return Array.from(grouped.values());
  }, [
    professionalAttendances,
    clientSubById,
    appointmentById,
    getAttendanceEffectiveRepass,
    exclusiveSubscriberIds,
    selectedMonth,
    selectedYear,
  ]);

  const summary = useMemo(() => {
    const totalAttendances = clientRows.reduce((sum, row) => sum + row.attendanceCount, 0);
    const totalValue = clientRows.reduce((sum, row) => sum + row.totalValue, 0);
    const averageTicket = totalAttendances > 0 ? totalValue / totalAttendances : 0;
    return { totalAttendances, totalValue, averageTicket };
  }, [clientRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = clientRows;
    if (query) {
      rows = rows.filter((row) => row.name.toLowerCase().includes(query));
    }

    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (sortMode === 'count') return b.attendanceCount - a.attendanceCount || a.name.localeCompare(b.name, 'pt-BR');
      if (sortMode === 'value') return b.totalValue - a.totalValue || a.name.localeCompare(b.name, 'pt-BR');
      const dateCmp = b.lastDate.localeCompare(a.lastDate);
      if (dateCmp !== 0) return dateCmp;
      return b.lastTime.localeCompare(a.lastTime);
    });
    return sorted;
  }, [clientRows, search, sortMode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#141516] rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden border border-gray-700/80 shadow-2xl shadow-black/40 flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-700/60 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-white">Clientes atendidos no mês</h3>
            <p className="text-sm text-gray-400 mt-0.5 truncate">
              {professional} • {monthLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors shrink-0 p-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 border-b border-gray-800/80 bg-[#101112] shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { icon: DollarSign, label: 'Valor gerado', value: fmtBRL(summary.totalValue), color: 'text-emerald-300' },
              { icon: Scissors, label: 'Visitas', value: String(summary.totalAttendances), color: 'text-white' },
              { icon: BarChart3, label: 'Ticket médio', value: summary.averageTicket > 0 ? fmtBRL(summary.averageTicket) : '—', color: 'text-violet-300' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-700/50 bg-black/20 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </div>
                <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-gray-800/80 flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full rounded-xl border border-gray-700 bg-[#1a1b1c] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-xl border border-gray-700 bg-[#1a1b1c] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="recent">Mais recente</option>
            <option value="count">Mais atendimentos</option>
            <option value="value">Maior valor gerado</option>
            <option value="name">Nome A-Z</option>
          </select>
        </div>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-3">
          {filteredRows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Nenhum cliente encontrado para este filtro.</p>
            </div>
          ) : (
            filteredRows.map((row) => {
              const isExpanded = expandedKey === row.key;
              return (
                <div
                  key={row.key}
                  className="rounded-xl border border-gray-700/60 bg-gradient-to-br from-[#232425] to-[#1a1b1c] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                    className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-sky-300 shrink-0" />
                          <p className="text-sm sm:text-base font-semibold text-white truncate">{row.name}</p>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-200">
                            <Star className="w-3 h-3" /> Assinante
                          </span>
                          {row.isExclusive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                              <Gem className="w-3 h-3" /> Exclusivo
                            </span>
                          )}
                          {row.isNewClient && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                              <Sparkles className="w-3 h-3" /> Novo
                            </span>
                          )}
                          {row.isFrequent && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200">
                              <Flame className="w-3 h-3" /> Frequente
                            </span>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            Último: {formatDisplayDate(row.lastDate)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            Horário: {row.lastTime}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Scissors className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            Visitas: {row.attendanceCount}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            Valor: {fmtBRL(row.totalValue)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-gray-400 pt-1">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-700/40">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold pt-3 mb-2">
                        Histórico do mês
                      </p>
                      <div className="space-y-2">
                        {row.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg border border-gray-700/40 bg-black/20 px-3 py-2 text-xs"
                          >
                            <div className="text-gray-200">
                              <span className="font-medium">{formatDisplayDate(entry.date)}</span>
                              <span className="text-gray-500"> — </span>
                              <span>{entry.time}</span>
                              <span className="text-gray-500"> — </span>
                              <span>{entry.service}</span>
                            </div>
                            <div className="text-emerald-300 font-semibold sm:text-right">
                              {entry.value > 0 ? fmtBRL(entry.value) : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
