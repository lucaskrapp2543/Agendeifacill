import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Lightbulb, RefreshCw, Send, X } from 'lucide-react';
import { FeatureRequestPhotos } from './FeatureRequestPhotos';
import { SystemUpdatesCard } from './SystemUpdatesCard';
import {
  compressImageForUpload,
  createFeatureRequest,
  FEATURE_REQUEST_MAX_PHOTOS,
  uploadFeatureRequestPhoto,
  FEATURE_REQUEST_STATUS_LABEL,
  FEATURE_REQUESTS_ACCEPTED_BASE,
  getAcceptedFeatureRequestsTotal,
  isUnreadFeatureRequestAnswer,
  markFeatureRequestAnswersSeen,
  listMyFeatureRequests,
  type FeatureRequest,
} from '../lib/featureRequests';

interface FeatureRequestsPanelProps {
  establishmentId: string;
  /** Chamado depois de marcar as respostas como vistas (zera o balão do menu). */
  onAnswersSeen?: () => void;
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
export function FeatureRequestsPanel({ establishmentId, toast, onAnswersSeen }: FeatureRequestsPanelProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  // Contador geral "pedidos aceitos" (sobe a cada "Pedido aceito" no Menu Admin).
  const [acceptedTotal, setAcceptedTotal] = useState(FEATURE_REQUESTS_ACCEPTED_BASE);
  // Respostas novas do suporte (marcadas "🔔 Nova resposta" enquanto a tela está aberta).
  const [newAnswerIds, setNewAnswerIds] = useState<string[]>([]);
  // Fotos do pedido (até 4), já reduzidas no aparelho antes de enviar.
  const [photos, setPhotos] = useState<Array<{ id: string; blob: Blob; preview: string }>>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    },
    []
  );

  const handlePickPhotos = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []).filter((file) => String(file.type || '').startsWith('image/'));
    if (files.length === 0) return;
    const free = FEATURE_REQUEST_MAX_PHOTOS - photosRef.current.length;
    if (free <= 0) {
      toast(`Máximo de ${FEATURE_REQUEST_MAX_PHOTOS} fotos por pedido.`, 'warning');
      return;
    }
    if (files.length > free) toast(`Só cabem mais ${free} foto(s) neste pedido.`, 'warning');
    setPreparingPhotos(true);
    try {
      const added: Array<{ id: string; blob: Blob; preview: string }> = [];
      for (const file of files.slice(0, free)) {
        if (file.size > 25 * 1024 * 1024) {
          toast('Essa foto é grande demais. Tente outra.', 'warning');
          continue;
        }
        try {
          const blob = await compressImageForUpload(file);
          added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, blob, preview: URL.createObjectURL(blob) });
        } catch {
          toast('Não consegui ler essa foto. Tente outra.', 'error');
        }
      }
      if (added.length > 0) setPhotos((prev) => [...prev, ...added].slice(0, FEATURE_REQUEST_MAX_PHOTOS));
    } finally {
      setPreparingPhotos(false);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((photo) => photo.id !== id);
    });
  };

  const loadRequests = useCallback(async () => {
    if (!establishmentId) return;
    setIsLoading(true);
    try {
      void getAcceptedFeatureRequestsTotal().then(setAcceptedTotal);
      const result = await listMyFeatureRequests(establishmentId);
      setNotReady(Boolean(result.notReady));
      setRequests(result.items);
      const unread = result.items.filter(isUnreadFeatureRequestAnswer).map((item) => String(item.id));
      if (unread.length > 0) {
        setNewAnswerIds((prev) => Array.from(new Set([...prev, ...unread])));
        void markFeatureRequestAnswersSeen(establishmentId).then(() => onAnswersSeen?.());
      }
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId, onAnswersSeen]);

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
      // Primeiro as fotos (se tiver). Se alguma falhar, o pedido não é enviado pela metade.
      const photoPaths: string[] = [];
      for (const photo of photosRef.current) {
        const uploaded = await uploadFeatureRequestPhoto(establishmentId, photo.blob);
        if (!uploaded.ok || !uploaded.path) {
          toast(uploaded.message || 'Não consegui enviar as fotos. Tente de novo.', 'error');
          return;
        }
        photoPaths.push(uploaded.path);
      }
      const result = await createFeatureRequest(establishmentId, text, photoPaths);
      if (!result.ok) {
        toast(result.message || 'Não foi possível enviar agora.', 'error');
        return;
      }
      toast('Pedido enviado! Nossa equipe vai responder por aqui.', 'success');
      setMessage('');
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setPhotos([]);
      await loadRequests();
    } finally {
      setIsSending(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="-mx-4 sm:mx-0 space-y-5 text-gray-100 bg-[#0b0b0c] sm:rounded-3xl p-3 sm:p-5 sm:border sm:border-white/5">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-[#0f1412] bg-gradient-to-br from-[#0f2a1f] via-[#121614] to-[#0d0f0e] p-4 sm:p-6 text-white shadow-lg shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Suporte T.I online agora
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-xs font-extrabold text-amber-200">
              ⚡ Geralmente responde rápido
            </span>
            </div>
            <h2 className="mt-3 flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
              <Lightbulb className="h-7 w-7 shrink-0 text-amber-400" />
              Pedidos, correções e bugs
            </h2>
            <p className="mt-1 text-xs text-gray-300 sm:text-sm">
              Canal direto com o suporte para <strong className="text-white">tudo</strong>: peça uma melhoria, avise de um
              erro (bug) ou de algo que não está funcionando, tire uma dúvida. Nossa equipe lê tudo e responde aqui mesmo.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/20 to-amber-600/10 px-5 py-4 text-center shadow-lg shadow-amber-500/10">
            <p className="text-4xl font-black leading-none tabular-nums text-amber-300 sm:text-5xl">
              {acceptedTotal.toLocaleString('pt-BR')}
            </p>
            <p className="mt-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-100">✅ Pedidos aceitos</p>
            <p className="mt-0.5 text-[10px] text-amber-100/70">ideias de clientes que viraram sistema</p>
          </div>
        </div>
      </div>

      {/* Atualizações e novidades do sistema */}
      <SystemUpdatesCard />

      {/* Novo pedido */}
      <div className="rounded-2xl border border-white/10 bg-[#141518] p-3 sm:p-4 space-y-3">
        <label htmlFor="feature-request-message" className="block text-sm font-bold text-white">
          ✍️ Conte pra gente: pedido, correção, bug ou dúvida
        </label>
        <textarea
          id="feature-request-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          rows={5}
          placeholder="Ex.: Achei um erro na agenda quando eu... / Queria que o sistema tivesse... (se puder, mande um print 📷)"
          className="w-full resize-y rounded-xl border border-white/15 bg-[#0b0b0c] px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
          disabled={notReady}
        />

        {/* Fotos (opcional, até 4) */}
        <div className="space-y-2">
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative h-20 w-20">
                  <img src={photo.preview} alt={`Foto ${index + 1}`} className="h-full w-full rounded-lg border border-white/15 object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    disabled={isSending}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/85 text-white hover:bg-red-600 disabled:opacity-50"
                    title="Tirar esta foto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < FEATURE_REQUEST_MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={preparingPhotos || isSending || notReady}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-100 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {preparingPhotos ? 'Preparando fotos…' : `Adicionar fotos (${photos.length}/${FEATURE_REQUEST_MAX_PHOTOS})`}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handlePickPhotos(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="text-[11px] text-gray-500">Opcional: até {FEATURE_REQUEST_MAX_PHOTOS} fotos ou prints (ajuda muito a entender um erro).</p>
        </div>

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
            {isSending ? (photos.length > 0 ? 'Enviando fotos…' : 'Enviando...') : 'Enviar pedido'}
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
            📋 Meus pedidos e respostas
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
              <div
                key={request.id}
                className={`rounded-xl border p-3 sm:p-4 ${newAnswerIds.includes(String(request.id)) ? 'border-sky-400/60 bg-sky-500/10' : 'border-white/10 bg-white/5'}`}
              >
                {newAnswerIds.includes(String(request.id)) && (
                  <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    🔔 Nova resposta do suporte
                  </span>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClasses[request.status] || statusClasses.pending}`}
                  >
                    {statusIcon[request.status] || '⏳'} {FEATURE_REQUEST_STATUS_LABEL[request.status] || 'Aguardando resposta'}
                  </span>
                  <span className="text-[11px] text-gray-500">Enviado em {formatDateTime(request.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-100">{request.message}</p>
                <FeatureRequestPhotos paths={request.photo_paths} />
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
