import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  adminAnswerFeatureRequest,
  FEATURE_REQUEST_STATUS_LABEL,
  type FeatureRequest,
  type FeatureRequestStatus,
} from '../lib/featureRequests';

interface AdminFeatureRequestsModalProps {
  requests: FeatureRequest[];
  /** null = "Clientes com pedidos" (só quem tem pedido pendente); id = pedidos daquele estabelecimento. */
  establishmentId: string | null;
  onClose: () => void;
  onAnswered: () => Promise<void> | void;
}

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusBadge: Record<FeatureRequestStatus, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  accepted: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  rejected: 'border-red-300 bg-red-50 text-red-900',
};

function RequestCard({ request, onAnswered }: { request: FeatureRequest; onAnswered: () => Promise<void> | void }) {
  const [reply, setReply] = useState(request.admin_reply || '');
  const [savingStatus, setSavingStatus] = useState<FeatureRequestStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const answer = async (status: FeatureRequestStatus) => {
    setSavingStatus(status);
    setErrorMessage('');
    try {
      const result = await adminAnswerFeatureRequest(request.id, status, reply);
      if (!result.ok) {
        setErrorMessage(result.message || 'Não foi possível salvar.');
        return;
      }
      await onAnswered();
    } finally {
      setSavingStatus(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusBadge[request.status] || statusBadge.pending}`}>
          {FEATURE_REQUEST_STATUS_LABEL[request.status] || 'Aguardando resposta'}
        </span>
        <span className="text-[11px] text-gray-500">Enviado em {formatDateTime(request.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-900">{request.message}</p>

      <label className="mt-3 block text-[11px] font-semibold text-gray-700">
        Mensagem para o estabelecimento (opcional — ele vê na tela "Fazer pedidos")
      </label>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value.slice(0, 2000))}
        rows={2}
        placeholder="Ex.: Boa ideia! Vamos colocar no sistema nas próximas semanas."
        className="mt-1 w-full resize-y rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {request.answered_at && (
        <p className="mt-1 text-[11px] text-gray-500">Respondido em {formatDateTime(request.answered_at)}</p>
      )}
      {errorMessage && <p className="mt-1 text-[11px] font-semibold text-red-700">{errorMessage}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void answer('accepted')}
          disabled={savingStatus !== null}
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
        >
          {savingStatus === 'accepted' ? 'Salvando...' : '✅ Pedido aceito'}
        </button>
        <button
          type="button"
          onClick={() => void answer('rejected')}
          disabled={savingStatus !== null}
          className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60"
        >
          {savingStatus === 'rejected' ? 'Salvando...' : '❌ Pedido negado'}
        </button>
        {request.status !== 'pending' && (
          <button
            type="button"
            onClick={() => void answer('pending')}
            disabled={savingStatus !== null}
            className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
            title="Volta o pedido para 'aguardando resposta'"
          >
            {savingStatus === 'pending' ? 'Salvando...' : 'Voltar para pendente'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Menu Admin → pedidos de melhoria enviados pelos estabelecimentos ("Fazer pedidos"). */
export function AdminFeatureRequestsModal({ requests, establishmentId, onClose, onAnswered }: AdminFeatureRequestsModalProps) {
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const byEstablishment = new Map<string, FeatureRequest[]>();
    requests.forEach((request) => {
      const id = String(request.establishment_id || '');
      if (!id) return;
      if (establishmentId && id !== establishmentId) return;
      const list = byEstablishment.get(id) || [];
      list.push(request);
      byEstablishment.set(id, list);
    });

    const q = search.trim().toLowerCase();
    return Array.from(byEstablishment.entries())
      .map(([id, list]) => {
        // Pendentes primeiro; dentro de cada grupo, os mais recentes primeiro.
        const sorted = [...list].sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (b.status === 'pending' && a.status !== 'pending') return 1;
          return String(b.created_at).localeCompare(String(a.created_at));
        });
        const visible = establishmentId ? sorted : sorted.filter((r) => r.status === 'pending');
        return {
          id,
          name: String(list[0]?.establishment_name || 'Estabelecimento'),
          code: String(list[0]?.establishment_code || ''),
          pending: list.filter((r) => r.status === 'pending').length,
          visible,
          oldestPendingAt: list.filter((r) => r.status === 'pending').map((r) => r.created_at).sort()[0] || '',
        };
      })
      .filter((group) => group.visible.length > 0)
      .filter((group) => !q || group.name.toLowerCase().includes(q) || group.code.toLowerCase().includes(q))
      .sort((a, b) => String(a.oldestPendingAt || '9999').localeCompare(String(b.oldestPendingAt || '9999')));
  }, [requests, establishmentId, search]);

  const title = establishmentId
    ? `💡 Pedidos — ${groups[0]?.name || 'Estabelecimento'}${groups[0]?.code ? ` (${groups[0].code})` : ''}`
    : '💡 Clientes com pedidos';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{title}</div>
            <div className="text-xs text-gray-600">
              {establishmentId
                ? 'Todos os pedidos deste estabelecimento. Responda com aceito ou negado e, se quiser, uma mensagem.'
                : 'Só os estabelecimentos com pedidos aguardando resposta (o que espera há mais tempo aparece primeiro).'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-gray-500 hover:text-gray-900" title="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!establishmentId && (
          <div className="border-b border-gray-200 p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-4">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {establishmentId ? 'Nenhum pedido deste estabelecimento.' : 'Nenhum pedido pendente. 🎉'}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="space-y-2">
                {!establishmentId && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {group.name} {group.code && <span className="font-normal text-gray-500">({group.code})</span>}
                    </p>
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {group.pending} pendente{group.pending === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
                {group.visible.map((request) => (
                  <RequestCard key={`${request.id}-${request.status}-${request.answered_at || ''}`} request={request} onAnswered={onAnswered} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminFeatureRequestsModal;
