import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Check, CreditCard, Eye, EyeOff, List, Search, Settings, X, Zap } from 'lucide-react';
import {
  filterLastPayments,
  summarizeLastPayments,
  type LastPaymentRow,
} from '../lib/adminLastPayments';

export type LastPaymentsPeriodStatus = 'idle' | 'partial' | 'invalid' | 'tooLong' | 'loading' | 'ok' | 'error';

type Props = {
  /** Lista padrão: o último pagamento de cada barbearia, mais recente primeiro. */
  defaultRows: LastPaymentRow[];
  /** Todos os pagamentos do período escolhido. */
  periodRows: LastPaymentRow[];
  periodStatus: LastPaymentsPeriodStatus;
  periodFrom: string;
  periodTo: string;
  onPeriodChange: (from: string, to: string) => void;
  isClassifying?: boolean;
  warning?: string;
  onClose: () => void;
};

const ROWS_PER_PAGE = 100;
const BILLING_HISTORY_STARTS_AT = '2026-03-23';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const dateOnlyToBR = (raw: string) => (raw ? `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)}` : '');

type Theme = {
  bar: string;
  card: string;
  tile: string;
  emoji: string;
  panel: string;
  label: string;
  value: string;
  icon: string;
  divider: string;
};

/** Só visual: as cores se alternam como no modelo aprovado. A origem está escrita em "Forma de pagamento". */
const THEMES: Theme[] = [
  {
    bar: 'border-l-emerald-600',
    card: 'bg-gradient-to-br from-emerald-50 via-white to-white',
    tile: 'from-emerald-700 to-emerald-950',
    emoji: '💈',
    panel: 'bg-emerald-100/70 border-emerald-200',
    label: 'text-emerald-800',
    value: 'text-emerald-950',
    icon: 'text-emerald-500',
    divider: 'bg-emerald-300',
  },
  {
    bar: 'border-l-blue-600',
    card: 'bg-gradient-to-br from-blue-50 via-white to-white',
    tile: 'from-blue-600 to-blue-900',
    emoji: '✂️',
    panel: 'bg-blue-100/70 border-blue-200',
    label: 'text-blue-800',
    value: 'text-blue-950',
    icon: 'text-cyan-500',
    divider: 'bg-blue-300',
  },
  {
    bar: 'border-l-amber-500',
    card: 'bg-gradient-to-br from-amber-50 via-white to-white',
    tile: 'from-amber-500 to-orange-800',
    emoji: '🧔',
    panel: 'bg-amber-100/70 border-amber-200',
    label: 'text-amber-900',
    value: 'text-amber-950',
    icon: 'text-orange-500',
    divider: 'bg-amber-300',
  },
];

const STATUS_STYLES: Record<string, string> = {
  Pago: 'bg-emerald-600 text-white',
  Pendente: 'bg-amber-500 text-white',
  Vencido: 'bg-red-600 text-white',
};

/** O losango de quatro pontas que representa o PIX. */
const PixMark = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <rect x="9" y="1.5" width="6" height="6" rx="1.2" transform="rotate(45 12 4.5)" />
    <rect x="9" y="16.5" width="6" height="6" rx="1.2" transform="rotate(45 12 19.5)" />
    <rect x="1.5" y="9" width="6" height="6" rx="1.2" transform="rotate(45 4.5 12)" />
    <rect x="16.5" y="9" width="6" height="6" rx="1.2" transform="rotate(45 19.5 12)" />
  </svg>
);

const PaymentCard = ({ row, position, hideDate }: { row: LastPaymentRow; position: number; hideDate: boolean }) => {
  const theme = THEMES[position % THEMES.length];
  const { value, exact, gross, note } = row.net;
  const netLabel = value !== null ? `${exact ? '' : '≈ '}${fmtBRL(value)}` : '—';
  const showGrossAndFee = gross !== null && exact && value !== null && gross > value;
  const paidAtLabel = row.paidAt !== null ? new Date(row.paidAt).toLocaleString('pt-BR') : 'Sem data de pagamento';

  return (
    <article className={`rounded-2xl border border-gray-200 border-l-[6px] p-3 shadow-sm sm:p-4 ${theme.bar} ${theme.card}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-sm sm:h-14 sm:w-14 sm:text-3xl ${theme.tile}`} aria-hidden="true">
          {theme.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 break-words text-base font-black leading-tight text-gray-900 sm:text-lg">{row.name}</h3>
            {!hideDate ? (
              <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-700 sm:text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-gray-500 sm:h-4 sm:w-4" />
                {paidAtLabel}
              </div>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0 text-xs text-gray-600 sm:text-sm">
              <div>Código: {row.code || '—'} • Plano: {row.planLabel || '—'}</div>
              <div>Forma de pagamento: {row.methodLabel}</div>
            </div>
            {row.statusLabel ? (
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[row.statusLabel]}`}>
                {row.statusLabel === 'Pago' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                {row.statusLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2.5 ${theme.panel}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm sm:h-10 sm:w-10">
            {row.methodLabel === 'PIX' ? (
              <PixMark className={`h-5 w-5 sm:h-6 sm:w-6 ${theme.icon}`} />
            ) : row.methodLabel === 'Crédito' ? (
              <CreditCard className={`h-5 w-5 sm:h-6 sm:w-6 ${theme.icon}`} />
            ) : (
              <Settings className={`h-5 w-5 sm:h-6 sm:w-6 ${theme.icon}`} />
            )}
          </span>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-wide sm:text-xs ${theme.label}`}>Líquido pra você</div>
            <div className={`text-2xl font-black leading-tight sm:text-3xl ${theme.value}`}>{netLabel}</div>
          </div>
        </div>
        <span className={`hidden h-10 w-px sm:block ${theme.divider}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-xs text-gray-700 sm:text-sm">
          {showGrossAndFee ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>Bruto: {fmtBRL(gross as number)}</span>
              <span className="hidden text-gray-400 sm:inline" aria-hidden="true">|</span>
              <span>Taxa MP: {fmtBRL(Math.round(((gross as number) - (value as number)) * 100) / 100)}</span>
            </span>
          ) : (
            note
          )}
        </div>
      </div>
    </article>
  );
};

export const AdminLastPaymentsModal = ({
  defaultRows,
  periodRows,
  periodStatus,
  periodFrom,
  periodTo,
  onPeriodChange,
  isClassifying = false,
  warning = '',
  onClose,
}: Props) => {
  const [search, setSearch] = useState('');
  // Olhinho: tira da tela os campos De/Até e a data de cada pagamento. O período escolhido continua valendo.
  const [periodHidden, setPeriodHidden] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(ROWS_PER_PAGE);

  const usingPeriod = periodStatus === 'ok' || periodStatus === 'loading' || periodStatus === 'error';
  const baseRows = useMemo(() => {
    if (!usingPeriod) return defaultRows;
    return periodStatus === 'ok' ? periodRows : [];
  }, [usingPeriod, periodStatus, periodRows, defaultRows]);
  const rows = useMemo(() => filterLastPayments(baseRows, search), [baseRows, search]);
  const summary = useMemo(() => summarizeLastPayments(rows), [rows]);

  useEffect(() => {
    setVisibleLimit(ROWS_PER_PAGE);
  }, [baseRows, search]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const showPeriodCard = periodStatus === 'ok';
  const dateInputClass =
    'w-full min-w-0 rounded-xl border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 text-gray-900 sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl sm:max-h-[90vh]">
        <header className="border-b border-gray-200 bg-white px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Bell className="h-6 w-6" fill="currentColor" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-blue-100" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black leading-tight text-gray-900 sm:text-xl">Últimos pagamentos</h2>
              <p className="text-xs text-gray-600 sm:text-sm">
                {usingPeriod ? 'Todos os pagamentos do período' : 'Últimos 100'} • mais recente primeiro
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className={`mt-3 flex gap-2 ${periodHidden ? 'flex-row items-center' : 'flex-col lg:flex-row lg:items-end'}`}>
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Buscar por nome ou código</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou código..."
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <div className={`flex min-w-0 items-end gap-2 ${periodHidden ? 'shrink-0' : ''}`}>
              {!periodHidden ? (
                <>
                  <label className="min-w-0 flex-1 lg:w-36 lg:flex-none">
                    <span className="mb-0.5 block text-[11px] font-semibold text-gray-600">De</span>
                    <input
                      type="date"
                      value={periodFrom}
                      max={periodTo || todayKey}
                      onChange={(e) => onPeriodChange(e.target.value, periodTo)}
                      className={dateInputClass}
                      style={{ colorScheme: 'light' }}
                    />
                  </label>
                  <label className="min-w-0 flex-1 lg:w-36 lg:flex-none">
                    <span className="mb-0.5 block text-[11px] font-semibold text-gray-600">Até</span>
                    <input
                      type="date"
                      value={periodTo}
                      min={periodFrom || undefined}
                      max={todayKey}
                      onChange={(e) => onPeriodChange(periodFrom, e.target.value)}
                      className={dateInputClass}
                      style={{ colorScheme: 'light' }}
                    />
                  </label>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setPeriodHidden((prev) => !prev)}
                aria-pressed={periodHidden}
                aria-label={periodHidden ? 'Mostrar período' : 'Ocultar período'}
                title={periodHidden ? 'Mostrar período' : 'Ocultar período'}
                className={`flex h-[38px] w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${periodHidden
                  ? 'border-gray-800 bg-gray-800 text-white hover:bg-gray-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {periodHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {!periodHidden && (periodFrom || periodTo) ? (
            <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 text-xs">
              {periodStatus === 'partial' ? (
                <span className="text-gray-600">Escolha as duas datas para ver o período.</span>
              ) : periodStatus === 'invalid' ? (
                <span className="font-semibold text-red-700">A data "De" precisa ser antes da data "Até".</span>
              ) : periodStatus === 'tooLong' ? (
                <span className="font-semibold text-red-700">Escolha um período de até 400 dias.</span>
              ) : null}
              <button
                type="button"
                onClick={() => onPeriodChange('', '')}
                className="font-semibold text-blue-700 hover:underline"
              >
                Limpar datas
              </button>
            </div>
          ) : null}
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3 sm:p-5">
          {periodStatus === 'loading' ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-700">
              Buscando os pagamentos do período...
            </div>
          ) : periodStatus === 'error' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm font-semibold text-red-800">
              Não consegui buscar esse período agora. Tente de novo em instantes.
            </div>
          ) : (
            <>
              {showPeriodCard ? (
                <section className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-950 p-4 text-white shadow-md sm:p-5">
                  <div className="text-xs font-semibold text-emerald-100 sm:text-sm">
                    {periodHidden ? 'Recebido no período' : `Recebido de ${dateOnlyToBR(periodFrom)} a ${dateOnlyToBR(periodTo)}`}
                    {search.trim() ? ` • busca: "${search.trim()}"` : ''}
                  </div>
                  <div className="mt-0.5 text-3xl font-black leading-tight text-white sm:text-4xl">
                    {summary.estimatedCount > 0 ? '≈ ' : ''}{fmtBRL(summary.net)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-emerald-50 sm:text-sm">
                    <span>{summary.count} pagamento{summary.count === 1 ? '' : 's'}</span>
                    {summary.gross > 0 ? <span>Bruto: {fmtBRL(summary.gross)}</span> : null}
                    {summary.fees > 0 ? <span>Taxas: {fmtBRL(summary.fees)}</span> : null}
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-emerald-100 sm:text-xs">
                    {summary.estimatedCount > 0 ? (
                      <p>≈ {summary.estimatedCount} valor{summary.estimatedCount === 1 ? '' : 'es'} sem o líquido exato gravado: {summary.estimatedCount === 1 ? 'entrou' : 'entraram'} por estimativa.</p>
                    ) : null}
                    {summary.manualCount > 0 ? (
                      <p>Pagamento manual: o sistema só guarda a última data de cada barbearia.</p>
                    ) : null}
                    {periodFrom < BILLING_HISTORY_STARTS_AT ? (
                      <p>O histórico de pagamentos automáticos começa em 23/03/2026.</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
                  <Zap className="h-4 w-4 text-emerald-600" fill="currentColor" />
                  Automáticos: {summary.autoCount}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 font-semibold text-orange-800">
                  <Settings className="h-4 w-4 text-orange-600" />
                  Manuais: {summary.manualCount}
                </span>
                {!showPeriodCard ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-900">
                    <List className="h-4 w-4 text-blue-700" />
                    Líquido total (lista): {summary.estimatedCount > 0 ? '≈ ' : ''}{fmtBRL(summary.net)}
                  </span>
                ) : null}
                {search.trim() ? (
                  <span className="text-gray-600">
                    {rows.length} resultado{rows.length === 1 ? '' : 's'} para "{search.trim()}"
                  </span>
                ) : null}
                {isClassifying ? <span className="text-gray-600">Classificando origem do pagamento...</span> : null}
              </div>

              {warning ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">{warning}</div>
              ) : null}

              {rows.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-700">
                  Nenhum pagamento encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.slice(0, visibleLimit).map((row, position) => (
                    <PaymentCard key={row.key} row={row} position={position} hideDate={periodHidden} />
                  ))}
                  {rows.length > visibleLimit ? (
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + ROWS_PER_PAGE)}
                      className="w-full rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-100"
                    >
                      Ver mais ({rows.length - visibleLimit} restantes)
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
