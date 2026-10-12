import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, RefreshCw, Send } from 'lucide-react';
import {
  createFeatureRequest,
  FEATURE_REQUEST_STATUS_LABEL,
  listMyFeatureRequests,
  type FeatureRequest,
} from '../lib/featureRequests';

interface FeatureRequestsPanelProps {
  establishmentId: string;
  toast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const MAX_LENGTH = 2000;

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusClasses: Record<FeatureRequest['status'], string> = {
  pending: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  accepted: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  rejected: 'border-red-500/40 bg-red-500/15 text-red-300',
};

const statusIcon: Record<FeatureRequest['status'], string> = {
  pending: '⏳',
  accepted: '✅',
  rejected: '❌',
};

/** Menu do estabelecimento → "Fazer pedidos": envia pedidos e mostra a resposta do suporte. */
export function FeatureRequestsPanel({ establishmentId, toast }: FeatureRequestsPanelProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);

  const loadRequests = useCallback(async () => {
    if (!establishmentId) return;
    setIsLoading(true);
    try {
      const result = await listMyFeatureRequests(establishmentId);
      setNotReady(Boolean(result.notReady));
      setRequests(result.items);
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleSend = async () => {
    const text = message.trim();
    if (text.length < 5) {
      toast('Escreva um pouco mais sobre o seu pedido.', 'warning');
      return;
    }
    setIsSending(true);
    try {
      const result = await createFeatureRequest(establishmentId, text);
      if (!result.ok) {
        toast(result.message || 'Não foi possível enviar agora.', 'error');
        return;
      }
      toast('Pedido enviado! Nossa equipe vai responder por aqui.', 'success');
      setMessage('');
      await loadRequests();
    } finally {
      setIsSending(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="-mx-4 sm:mx-0 space-y-5 text-gray-100 bg-[#0b0b0c] sm:rounded-3xl p-3 sm:p-5 sm:border sm:border-white/5">
      <div className="rounded-2xl border border-amber-400/25 bg-[#141518] bg-gradient-to-br from-[#2b2412] via-[#16171a] to-[#111214] p-4 sm:p-5 text-white shadow-lg shadow-black/30">
        <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-amber-400 shrink-0" />
          Fazer pedidos
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-gray-300">
          Peça uma melhoria ou algo que você gostaria que tivesse no sistema. Nossa equipe lê todos os pedidos e
          responde aqui mesmo.
        </p>
      </div>

      {/* Novo pedido */}
      <div className="rounded-2xl border border-white/10 bg-[#141518] p-3 sm:p-4 space-y-3">
        <label htmlFor="feature-request-message" className="block text-sm font-bold text-white">
          ✍️ O que você gostaria que tivesse no sistema?
        </label>
        <textarea
          id="feature-request-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          rows={5}
          placeholder="Ex.: Queria poder mandar uma mensagem de aniversário automática para os meus clientes..."
          className="w-full resize-y rounded-xl border border-white/15 bg-[#0b0b0c] px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
          disabled={notReady}
        />
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-[11px] text-gray-500">
            {message.length}/{MAX_LENGTH}
          </span>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending || notReady || message.trim().length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-black text-sm font-bold hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </div>
        {notReady && (
          <p className="text-[11px] text-amber-300">
            Ainda não disponível: falta liberar no sistema (rodar a atualização do banco).
          </p>
        )}
      </div>

      {/* Meus pedidos */}
      <div className="rounded-2xl border border-white/10 bg-[#141518] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-white">
            📋 Meus pedidos
            {pendingCount > 0 && (
              <span className="ml-2 text-[11px] font-semibold text-amber-300">({pendingCount} aguardando resposta)</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {isLoading && requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Carregando seus pedidos...</p>
        ) : requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Você ainda não fez nenhum pedido.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClasses[request.status] || statusClasses.pending}`}
                  >
                    {statusIcon[request.status] || '⏳'} {FEATURE_REQUEST_STATUS_LABEL[request.status] || 'Aguardando resposta'}
                  </span>
                  <span className="text-[11px] text-gray-500">Enviado em {formatDateTime(request.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-100">{request.message}</p>
                {request.admin_reply && (
                  <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-sky-300">💬 Resposta do suporte</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white">{request.admin_reply}</p>
                    {request.answered_at && (
                      <p className="mt-1 text-[11px] text-gray-400">Respondido em {formatDateTime(request.answered_at)}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FeatureRequestsPanel;
