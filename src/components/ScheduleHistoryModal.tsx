import { Clock, X, Building2, User, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface HistoryEntry {
  id: string;
  changed_at: string;
  change_type: 'business_hours' | 'work_hours';
  professional_id: string | null;
  professional_name: string | null;
  day_of_week: string;
  before_data: Record<string, any> | null;
  after_data: Record<string, any> | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
}

const DAY_PT: Record<string, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'business_hours', label: 'Estabelecimento' },
  { value: 'work_hours', label: 'Profissionais' },
];

function formatDateTimePT(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function renderEnabledBadge(enabled: boolean | undefined) {
  if (enabled === true) return <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">Ativo</span>;
  if (enabled === false) return <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">Desativado</span>;
  return <span className="text-gray-500 text-xs">—</span>;
}

function getHoursDisplay(data: Record<string, any> | null, type: 'business_hours' | 'work_hours'): string {
  if (!data) return '—';
  if (type === 'work_hours') {
    const start = data.entry_time || '—';
    const end = data.exit_time || '—';
    return `${start} às ${end}`;
  }
  const open = data.open1 || '—';
  const close = data.close1 || '—';
  const open2 = data.open2 && data.open2 !== '00:00' ? data.open2 : null;
  const close2 = data.close2 && data.close2 !== '00:00' ? data.close2 : null;
  if (open2 && close2) return `${open}–${close} / ${open2}–${close2}`;
  return `${open} às ${close}`;
}

function EntryCard({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  const isEst = entry.change_type === 'business_hours';
  const who = isEst ? 'Estabelecimento' : (entry.professional_name || 'Profissional');
  const WhoIcon = isEst ? Building2 : User;

  const beforeEnabled = entry.before_data?.enabled;
  const afterEnabled = entry.after_data?.enabled;
  const enabledChanged = beforeEnabled !== afterEnabled;

  const beforeHours = getHoursDisplay(entry.before_data, entry.change_type);
  const afterHours = getHoursDisplay(entry.after_data, entry.change_type);
  const hoursChanged = beforeHours !== afterHours;

  const summary = enabledChanged
    ? `${beforeEnabled ? 'Ativo' : 'Desativado'} → ${afterEnabled ? 'Ativo' : 'Desativado'}`
    : hoursChanged
      ? `${beforeHours} → ${afterHours}`
      : 'Outros campos';

  return (
    <div className="bg-[#252627] rounded-xl border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        <WhoIcon className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-semibold truncate">{who}</span>
            <span className="text-gray-500 text-xs">—</span>
            <span className="text-amber-300 text-xs font-medium">{DAY_PT[entry.day_of_week] || entry.day_of_week}</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5 truncate">{summary}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-gray-500 text-xs">{formatDateTimePT(entry.changed_at)}</p>
          {expanded ? <ChevronUp className="w-3 h-3 text-gray-600 ml-auto mt-1" /> : <ChevronDown className="w-3 h-3 text-gray-600 ml-auto mt-1" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2">
          {enabledChanged && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs w-16 shrink-0">Status:</span>
              {renderEnabledBadge(beforeEnabled)}
              <span className="text-gray-500 text-xs">→</span>
              {renderEnabledBadge(afterEnabled)}
            </div>
          )}
          {hoursChanged && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 text-xs w-16 shrink-0">Horário:</span>
              <span className="text-red-300 text-xs">{beforeHours}</span>
              <span className="text-gray-500 text-xs">→</span>
              <span className="text-green-300 text-xs">{afterHours}</span>
            </div>
          )}
          {!enabledChanged && !hoursChanged && (
            <p className="text-gray-500 text-xs">Intervalo ou outros campos alterados.</p>
          )}
        </div>
      )}
    </div>
  );
}

export const ScheduleHistoryModal: React.FC<Props> = ({ isOpen, onClose, establishmentId }) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'business_hours' | 'work_hours'>('all');

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, establishmentId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('changed_at', { ascending: false })
        .limit(300);
      setEntries((data as HistoryEntry[]) || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filtered = filter === 'all' ? entries : entries.filter(e => e.change_type === filter);

  return (
    <div className="fixed inset-0 bg-black/75 z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1a1b1c] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-white font-bold text-base">Histórico de Horários</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 px-4 py-2 border-b border-white/5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value as typeof filter)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filter === opt.value
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={fetchHistory}
            className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Atualizar
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {loading ? (
            <div className="text-center py-10">
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">Nenhuma alteração registrada ainda.</p>
              <p className="text-gray-600 text-xs mt-1">
                As mudanças feitas a partir de agora aparecerão aqui.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-xs mb-2">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>
              {filtered.map(entry => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
