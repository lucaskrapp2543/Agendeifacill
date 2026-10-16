import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import {
  markSystemUpdatesSeen,
  readSeenSystemUpdateId,
  SYSTEM_UPDATE_KIND_LABEL,
  SYSTEM_UPDATES,
  type SystemUpdate,
  type SystemUpdateKind,
} from '../lib/systemUpdates';

const kindBadge: Record<SystemUpdateKind, string> = {
  novidade: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  melhoria: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  correcao: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
};

type Filter = 'tudo' | SystemUpdateKind;

function UpdateItem({ update, isNew }: { update: SystemUpdate; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border p-4 ${isNew ? 'border-amber-400/50 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${kindBadge[update.kind]}`}>
          {SYSTEM_UPDATE_KIND_LABEL[update.kind]}
        </span>
        {update.fromClientRequest && (
          <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold text-violet-200">
            💡 Pedido de cliente
          </span>
        )}
        {isNew && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black">NOVO</span>}
        <span className="ml-auto text-[11px] text-gray-500">{update.date}</span>
      </div>
      <h4 className="mt-2 text-base font-extrabold text-white">{update.title}</h4>
      <p className="mt-1 text-sm text-gray-300">{update.summary}</p>

      {open && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-black/30 p-3">
          {update.details.map((block, index) => (
            <div key={index}>
              {block.title && <p className="text-xs font-extrabold uppercase tracking-wide text-amber-300">{block.title}</p>}
              <p className="mt-0.5 text-sm leading-relaxed text-gray-100">{block.text}</p>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-green-300 hover:text-green-200"
      >
        {open ? 'Fechar' : update.kind === 'correcao' ? 'Ver o que foi corrigido' : 'Veja como funciona'}
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
    </div>
  );
}

/**
 * Cartão "🆕 Atualizações e novidades que você talvez não saiba" (tela Fazer pedidos):
 * abre a lista do que mudou no sistema, separado em Novidades, Melhorias e Correções.
 */
export function SystemUpdatesCard() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('tudo');
  const [seenId, setSeenId] = useState(0);

  useEffect(() => {
    setSeenId(readSeenSystemUpdateId());
  }, []);

  const unseenCount = useMemo(() => SYSTEM_UPDATES.filter((update) => update.id > seenId).length, [seenId]);
  const list = useMemo(
    () => SYSTEM_UPDATES.filter((update) => filter === 'tudo' || update.kind === filter),
    [filter]
  );
  // O que era novo quando abriu continua marcado "NOVO" até fechar.
  const [newIdsWhenOpened, setNewIdsWhenOpened] = useState<number[]>([]);

  const openList = () => {
    setNewIdsWhenOpened(SYSTEM_UPDATES.filter((update) => update.id > seenId).map((update) => update.id));
    setOpen(true);
    markSystemUpdatesSeen();
    setSeenId(readSeenSystemUpdateId());
  };

  const counts = useMemo(
    () => ({
      novidade: SYSTEM_UPDATES.filter((u) => u.kind === 'novidade').length,
      melhoria: SYSTEM_UPDATES.filter((u) => u.kind === 'melhoria').length,
      correcao: SYSTEM_UPDATES.filter((u) => u.kind === 'correcao').length,
    }),
    []
  );

  return (
    <>
      <button
        type="button"
        onClick={openList}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-violet-400/40 bg-[#14111c] bg-gradient-to-r from-violet-600/25 via-fuchsia-600/10 to-transparent p-4 text-left shadow-lg shadow-violet-900/20 transition-colors hover:border-violet-300/60"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/25 text-2xl">🆕</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold text-white sm:text-lg">Atualizações e novidades que você talvez não saiba</span>
          <span className="mt-0.5 block text-xs text-violet-100/80">
            Funções novas, melhorias e bugs corrigidos — toque para ver e aprender a usar.
          </span>
        </span>
        {unseenCount > 0 && (
          <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-black">
            {unseenCount} {unseenCount === 1 ? 'nova' : 'novas'}
          </span>
        )}
        <ChevronRight className="h-5 w-5 shrink-0 text-violet-200 transition-transform group-hover:translate-x-0.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0f1012] text-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white sm:text-xl">🆕 Atualizações e novidades</h3>
                <p className="mt-0.5 text-xs text-gray-400">O que mudou no Agendei Fácil — as mais novas primeiro.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
              {(
                [
                  { key: 'tudo', label: `Tudo (${SYSTEM_UPDATES.length})` },
                  { key: 'novidade', label: `✨ Novidades (${counts.novidade})` },
                  { key: 'melhoria', label: `⚡ Melhorias (${counts.melhoria})` },
                  { key: 'correcao', label: `🛠️ Correções (${counts.correcao})` },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${filter === option.key
                    ? 'bg-amber-400 text-black'
                    : 'border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {list.map((update) => (
                <UpdateItem key={update.id} update={update} isNew={newIdsWhenOpened.includes(update.id)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SystemUpdatesCard;
