import React, { useMemo, useState } from 'react';
import { Clock, Filter, User } from 'lucide-react';
import {
  AUDIT_FILTER_OPTIONS,
  AuditFilterCategory,
  AppointmentAuditLogRow,
  filterAuditEntries,
  parseAuditLogRow,
} from '../lib/appointmentAuditLog';

interface AppointmentAuditTimelineProps {
  rows: AppointmentAuditLogRow[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function AppointmentAuditTimeline({
  rows,
  isLoading = false,
  emptyMessage = 'Nenhuma alteração registrada para este agendamento.',
}: AppointmentAuditTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<AuditFilterCategory>('all');

  const parsedEntries = useMemo(() => rows.map(parseAuditLogRow), [rows]);
  const visibleEntries = useMemo(
    () => filterAuditEntries(parsedEntries, activeFilter, false),
    [parsedEntries, activeFilter]
  );

  const countByFilter = useMemo(() => {
    const base = filterAuditEntries(parsedEntries, 'all', false);
    const counts: Record<AuditFilterCategory, number> = {
      all: base.length,
      financial: 0,
      schedule: 0,
      products: 0,
      status: 0,
      service: 0,
    };
    base.forEach((entry) => {
      counts[entry.category] += 1;
    });
    return counts;
  }, [parsedEntries]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-700/60 bg-[#141516] p-6 text-center">
        <div className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="mt-3 text-sm text-gray-400">Carregando histórico de auditoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Filter className="h-3.5 w-3.5" />
        Filtrar por tipo
      </div>

      <div className="flex flex-wrap gap-2">
        {AUDIT_FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.id;
          const count = countByFilter[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveFilter(option.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-[#2a2b2c] text-gray-300 hover:bg-[#343536]'
              }`}
            >
              {option.label}
              {count > 0 && (
                <span className={`ml-1.5 ${isActive ? 'text-black/70' : 'text-gray-500'}`}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {visibleEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-[#141516] p-8 text-center">
          <p className="text-sm text-gray-400">{emptyMessage}</p>
          {activeFilter !== 'all' && parsedEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              Ver todas as alterações
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-1">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-amber-500/40 via-gray-700 to-transparent" />

          <div className="space-y-0">
            {visibleEntries.map((entry, index) => (
              <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                <div className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-600 bg-[#1f2021] text-base shadow-inner">
                  {entry.icon}
                </div>

                <div className="min-w-0 flex-1 rounded-xl border border-gray-700/70 bg-[#141516] p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-white">{entry.title}</h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Clock className="h-3 w-3 shrink-0" />
                      {entry.timestamp}
                    </div>
                  </div>

                  {entry.changes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {entry.changes.map((change, changeIdx) => (
                        <div
                          key={`${entry.id}-change-${changeIdx}`}
                          className="rounded-lg border border-gray-800 bg-[#1a1b1c] px-3 py-2"
                        >
                          {change.single ? (
                            <p className="text-xs leading-relaxed text-gray-200">{change.single}</p>
                          ) : (
                            <>
                              {change.label && (
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                  {change.label}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="rounded-md bg-red-500/10 px-2 py-0.5 font-semibold text-red-300 line-through decoration-red-400/50">
                                  {change.before || '—'}
                                </span>
                                <span className="text-gray-600">→</span>
                                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-extrabold text-emerald-300">
                                  {change.after || '—'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.actor && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
                      <User className="h-3 w-3 shrink-0" />
                      <span>
                        Alterado por: <span className="font-semibold text-gray-300">{entry.actor}</span>
                      </span>
                    </div>
                  )}
                </div>

                {index < visibleEntries.length - 1 && (
                  <div className="pointer-events-none absolute left-[15px] top-10 h-[calc(100%-2rem)] w-px bg-gray-800" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
