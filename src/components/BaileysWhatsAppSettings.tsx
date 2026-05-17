import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

type Props = {
  userId: string | null | undefined;
};

type StatusResponse = {
  ok: boolean;
  connected: boolean;
  status: string;
  phone?: string | null;
  qr?: string | null;
  last_seen?: string | null;
  connected_at?: string | null;
};

type SendResponsePayload = {
  ok: boolean;
  result?: {
    ok: boolean;
    provider?: string;
    deliveryMode?: 'queued' | 'direct';
    ackConfirmed?: boolean;
    messageId?: string | null;
    error?: string | null;
  };
  error?: string;
};

type AutomationSettings = {
  user_id: string;
  reminder_enabled: boolean;
  reminder_offset_minutes: number;
  reminder_template: string;
  greeting_enabled: boolean;
  greeting_template: string;
};

type AutomationSettingsResponse = {
  ok: boolean;
  settings?: AutomationSettings;
  error?: string;
};

type MessageLogRow = {
  id: string;
  appointment_id?: string | null;
  message_type?: string | null;
  status?: string | null;
  recipient_phone?: string | null;
  error?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  provider?: string | null;
};

type MessageLogsResponse = {
  ok: boolean;
  logs?: MessageLogRow[];
  error?: string;
};

const REMINDER_OPTIONS = [
  { label: '10 minutos', value: 10 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '3 horas', value: 180 },
  { label: '5 horas', value: 300 },
  { label: '12 horas', value: 720 },
];
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
const REQUIRED_REMINDER_TOKENS = [
  'cliente_nome',
  'barbearia_nome',
  'tempo_lembrete',
  'data',
  'horario',
  'profissional_nome',
];
const REQUIRED_GREETING_TOKENS = [
  'cliente_nome',
  'barbearia_nome',
  'data',
  'horario',
  'profissional_nome',
];

async function buildAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = String(data?.session?.access_token || '').trim();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function BaileysWhatsAppSettings({ userId }: Props) {
  const configuredApiBase = String((import.meta as any)?.env?.VITE_WHATSAPP_API_BASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const isLocalhostRuntime =
    typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  // Fallback de produção para evitar proxy do Netlify removendo Authorization.
  const whatsappApiBase = configuredApiBase || (!isLocalhostRuntime ? 'https://agendei-api-1w1w.onrender.com' : '');
  const buildWhatsAppApiUrl = (suffix: string) => {
    const normalized = String(suffix || '').replace(/^\/+/, '');
    return whatsappApiBase
      ? `${whatsappApiBase}/api/whatsapp/${normalized}`
      : `/api/whatsapp/${normalized}`;
  };

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings>({
    user_id: '',
    reminder_enabled: true,
    reminder_offset_minutes: 60,
    reminder_template: DEFAULT_REMINDER_TEMPLATE,
    greeting_enabled: true,
    greeting_template: DEFAULT_GREETING_TEMPLATE,
  });
  const [showLogs, setShowLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [messageLogs, setMessageLogs] = useState<MessageLogRow[]>([]);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [apiUnavailableMessage, setApiUnavailableMessage] = useState('');

  const statusLabel = useMemo(() => {
    const current = String(status?.status || '').toLowerCase();
    if (!status) return 'Não conectado';
    if (current === 'connected') return '✅ Conectado';
    if (current === 'needs_qr') return '📷 Aguardando QR';
    if (current === 'reconnecting') return '🔄 Reconectando';
    if (current === 'connecting') return '🟡 Conectando';
    if (current === 'error') return '❌ Erro';
    return current || 'Desconectado';
  }, [status]);

  const findMissingTokens = (template: string, requiredTokens: string[]) =>
    requiredTokens.filter((token) => !String(template || '').includes(`{{${token}}}`));

  const parseApiResponse = async <T,>(response: Response): Promise<T> => {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const body = await response.text();
      const bodyPreview = String(body || '').slice(0, 80).trim();
      throw new Error(
        `API de WhatsApp indisponível neste ambiente (resposta não-JSON). ${bodyPreview ? `Resposta: ${bodyPreview}` : ''}`
      );
    }
    return (await response.json()) as T;
  };

  const markApiUnavailable = (error: any) => {
    const msg = String(error?.message || error || '').trim();
    setApiUnavailable(true);
    setApiUnavailableMessage(msg || 'API de WhatsApp indisponível neste ambiente.');
  };

  const loadStatus = async () => {
    if (!userId) return;
    const headers = await buildAuthHeaders();
    if (!headers) return;
    try {
      const response = await fetch(`${buildWhatsAppApiUrl('status')}?user_id=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers,
      });
      const data = await parseApiResponse<StatusResponse>(response);
      if (!response.ok || !data?.ok) {
        throw new Error((data as any)?.error || 'Falha ao carregar status do WhatsApp.');
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      setStatus(data);
      setQrDataUrl(String(data?.qr || '').trim() || null);
    } catch (error: any) {
      markApiUnavailable(error);
      console.error(error);
    }
  };

  const loadAutomationSettings = async () => {
    if (!userId) return;
    const headers = await buildAuthHeaders();
    if (!headers) return;
    try {
      const response = await fetch(`${buildWhatsAppApiUrl('automation-settings')}?user_id=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers,
      });
      const data = await parseApiResponse<AutomationSettingsResponse>(response);
      if (!response.ok || !data?.ok || !data?.settings) {
        throw new Error(String(data?.error || 'Falha ao carregar configurações do WhatsApp.'));
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      setSettings(data.settings);
    } catch (error: any) {
      markApiUnavailable(error);
      console.error(error);
    }
  };

  const loadMessageLogs = async () => {
    if (!userId) return;
    const headers = await buildAuthHeaders();
    if (!headers) return;
    setLoadingLogs(true);
    try {
      const response = await fetch(`${buildWhatsAppApiUrl('message-logs')}?user_id=${encodeURIComponent(userId)}&limit=80`, {
        method: 'GET',
        headers,
      });
      const data = await parseApiResponse<MessageLogsResponse>(response);
      if (!response.ok || !data?.ok) {
        throw new Error(String(data?.error || 'Falha ao carregar envios de WhatsApp.'));
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      setMessageLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (error: any) {
      markApiUnavailable(error);
      toast.error(String(error?.message || 'Erro ao buscar envios de WhatsApp.'));
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    void loadAutomationSettings();
    if (!userId) return;
    const timer = setInterval(() => {
      void loadStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [userId]);

  const ensureApiConfigured = () => {
    return true;
  };

  const handleConnect = async () => {
    if (!ensureApiConfigured()) return;
    if (!userId) {
      toast.error('Usuário não identificado para conectar WhatsApp.');
      return;
    }
    setLoading(true);
    try {
      const headers = await buildAuthHeaders();
      if (!headers) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch(buildWhatsAppApiUrl('connect'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await parseApiResponse<any>(response);
      if (!response.ok || !data?.ok) {
        throw new Error(String(data?.error || 'Falha ao iniciar conexão WhatsApp.'));
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      setQrDataUrl(String(data?.qr || '').trim() || null);
      toast.success('Conexão iniciada. Escaneie o QR Code.');
      await loadStatus();
    } catch (error: any) {
      markApiUnavailable(error);
      toast.error(String(error?.message || 'Erro ao conectar WhatsApp.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!ensureApiConfigured()) return;
    if (!userId) return;
    setLoading(true);
    try {
      const headers = await buildAuthHeaders();
      if (!headers) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch(buildWhatsAppApiUrl('disconnect'), {
        method: 'POST',
        headers,
        // Forca logout completo para exigir novo QR na proxima conexao.
        body: JSON.stringify({ user_id: userId, clear_session: true }),
      });
      const data = await parseApiResponse<any>(response);
      if (!response.ok || !data?.ok) {
        throw new Error(String(data?.error || 'Falha ao desconectar WhatsApp.'));
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      toast.success('WhatsApp desconectado.');
      setQrDataUrl(null);
      await loadStatus();
    } catch (error: any) {
      markApiUnavailable(error);
      toast.error(String(error?.message || 'Erro ao desconectar WhatsApp.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!ensureApiConfigured()) return;
    if (!userId) return;
    const phone = String(manualPhone || '').trim();
    const message = String(manualMessage || '').trim();
    if (!phone || !message) {
      toast.error('Preencha telefone e mensagem para teste.');
      return;
    }

    setSendingTest(true);
    try {
      const headers = await buildAuthHeaders();
      if (!headers) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch(buildWhatsAppApiUrl('send'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          phone,
          message,
        }),
      });
      const data = await parseApiResponse<SendResponsePayload>(response);
      if (!response.ok || !data?.ok) {
        throw new Error(String(data?.error || data?.result?.error || 'Falha ao enviar mensagem de teste.'));
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      const mode = String(data?.result?.deliveryMode || '').toLowerCase();
      if (mode === 'queued') {
        toast.success('Mensagem entrou na fila do WhatsApp. O worker vai enviar em seguida.');
      } else if (data?.result?.ackConfirmed === false) {
        toast.success('Mensagem aceita pelo WhatsApp. Confirmação pode demorar alguns segundos.');
      } else {
        toast.success('Mensagem enviada agora pelo WhatsApp.');
      }
    } catch (error: any) {
      markApiUnavailable(error);
      toast.error(String(error?.message || 'Erro ao enviar mensagem de teste.'));
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveAutomationSettings = async () => {
    if (!ensureApiConfigured()) return;
    if (!userId) return;
    setSavingSettings(true);
    try {
      const missingReminderTokens = findMissingTokens(settings.reminder_template, REQUIRED_REMINDER_TOKENS);
      if (missingReminderTokens.length > 0) {
        throw new Error(
          `A mensagem de lembrete precisa manter: ${missingReminderTokens
            .map((token) => `{{${token}}}`)
            .join(', ')}`
        );
      }
      const missingGreetingTokens = findMissingTokens(settings.greeting_template, REQUIRED_GREETING_TOKENS);
      if (missingGreetingTokens.length > 0) {
        throw new Error(
          `A mensagem de saudação precisa manter: ${missingGreetingTokens
            .map((token) => `{{${token}}}`)
            .join(', ')}`
        );
      }

      const headers = await buildAuthHeaders();
      if (!headers) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch(buildWhatsAppApiUrl('automation-settings'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          reminder_enabled: settings.reminder_enabled,
          reminder_offset_minutes: settings.reminder_offset_minutes,
          reminder_template: settings.reminder_template,
          greeting_enabled: settings.greeting_enabled,
          greeting_template: settings.greeting_template,
        }),
      });
      const data = await parseApiResponse<AutomationSettingsResponse>(response);
      if (!response.ok || !data?.ok || !data?.settings) {
        throw new Error(String(data?.error || 'Falha ao salvar configurações de automação.'));
      }
      setApiUnavailable(false);
      setApiUnavailableMessage('');
      setSettings(data.settings);
      toast.success('Configurações automáticas de WhatsApp salvas com sucesso.');
    } catch (error: any) {
      markApiUnavailable(error);
      toast.error(String(error?.message || 'Erro ao salvar configurações do WhatsApp.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleLogs = async () => {
    const next = !showLogs;
    setShowLogs(next);
    if (next) {
      await loadMessageLogs();
    }
  };

  const formatLogDateTime = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return raw;
    return dt.toLocaleString('pt-BR');
  };

  const formatLogStatus = (statusRaw?: string | null) => {
    const status = String(statusRaw || '').toLowerCase();
    if (status === 'queued') return 'na fila';
    if (status === 'sent') return 'enviado';
    if (status === 'accepted') return 'aceito (sem ACK)';
    if (status === 'failed') return 'falhou';
    return status || '-';
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-[#101112] p-4">
      {apiUnavailable ? (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          API de WhatsApp indisponível neste deploy. {apiUnavailableMessage || 'As rotas /api/whatsapp não responderam JSON.'}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">WhatsApp (Baileys - QR)</h3>
          <p className="text-sm text-gray-300">
            Status: <span className="font-semibold text-white">{statusLabel}</span>
          </p>
          {status?.phone ? (
            <p className="text-xs text-emerald-300 mt-1">Número conectado: {status.phone}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60"
          >
            Conectar WhatsApp
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={loading}
            className="px-3 py-2 rounded-md bg-gray-700 text-white text-sm font-semibold hover:bg-gray-600 disabled:opacity-60"
          >
            Desconectar
          </button>
        </div>
      </div>

      {qrDataUrl ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-black/30 p-3">
          <p className="text-sm text-amber-200 font-semibold mb-2">Escaneie o QR no WhatsApp:</p>
          <p className="text-xs text-gray-300 mb-3">
            WhatsApp {'>'} Aparelhos conectados {'>'} Conectar dispositivo
          </p>
          <img src={qrDataUrl} alt="QR Code WhatsApp Baileys" className="w-64 h-64 bg-white rounded-md p-2" />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
        <input
          type="text"
          value={manualPhone}
          onChange={(e) => setManualPhone(e.target.value)}
          placeholder="Telefone teste (com DDD)"
          className="rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
        />
        <input
          type="text"
          value={manualMessage}
          onChange={(e) => setManualMessage(e.target.value)}
          placeholder="Mensagem de teste"
          className="rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={handleSendTest}
          disabled={sendingTest}
          className="px-3 py-2 rounded-md bg-cyan-700 text-white text-sm font-semibold hover:bg-cyan-600 disabled:opacity-60"
        >
          Enviar teste
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLogs}
          disabled={loadingLogs}
          className="rounded-md border border-cyan-400/50 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-60"
        >
          {showLogs ? 'Ocultar envios' : 'Ver envios'}
        </button>
        {showLogs ? (
          <button
            type="button"
            onClick={loadMessageLogs}
            disabled={loadingLogs}
            className="rounded-md border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700/40 disabled:opacity-60"
          >
            {loadingLogs ? 'Atualizando...' : 'Atualizar'}
          </button>
        ) : null}
      </div>

      {showLogs ? (
        <div className="mt-3 rounded-lg border border-gray-700 bg-black/20 p-3">
          <p className="text-sm font-semibold text-white">Últimos envios (fila / enviado / aceito sem ACK / falhou)</p>
          {messageLogs.length === 0 ? (
            <p className="mt-2 text-xs text-gray-300">Nenhum envio encontrado para este usuário.</p>
          ) : (
            <div className="mt-2 max-h-72 overflow-auto">
              <table className="w-full text-left text-xs text-gray-200">
                <thead className="text-gray-400">
                  <tr>
                    <th className="px-2 py-1">Quando</th>
                    <th className="px-2 py-1">Tipo</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Telefone</th>
                    <th className="px-2 py-1">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {messageLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-800">
                      <td className="px-2 py-1 whitespace-nowrap">
                        {formatLogDateTime(log.sent_at || log.created_at)}
                      </td>
                      <td className="px-2 py-1">{String(log.message_type || '-')}</td>
                      <td className="px-2 py-1">{formatLogStatus(log.status)}</td>
                      <td className="px-2 py-1">{String(log.recipient_phone || '-')}</td>
                      <td className="px-2 py-1">{String(log.error || '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-gray-700 bg-black/20 p-4">
        <h4 className="text-base font-semibold text-white">Lembrete automático para cliente</h4>
        <p className="mt-1 text-xs text-gray-300">
          Defina em quanto tempo antes do agendamento o sistema envia o lembrete no WhatsApp.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={settings.reminder_enabled}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  reminder_enabled: e.target.checked,
                }))
              }
            />
            Ativar lembrete automático
          </label>

          <select
            value={settings.reminder_offset_minutes}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                reminder_offset_minutes: Number(e.target.value),
              }))
            }
            className="rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
          >
            {REMINDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <label className="block text-sm font-semibold text-white">Mensagem de lembrete (editável)</label>
          <button
            type="button"
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                reminder_template: DEFAULT_REMINDER_TEMPLATE,
              }))
            }
            className="rounded-md border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            Restaurar padrão (lembrete)
          </button>
        </div>
        <textarea
          value={settings.reminder_template}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              reminder_template: e.target.value,
            }))
          }
          rows={6}
          className="mt-2 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
        />
        <p className="mt-2 text-xs text-amber-300">
          Obrigatório manter: {'{{cliente_nome}}'}, {'{{barbearia_nome}}'}, {'{{tempo_lembrete}}'}, {'{{data}}'}, {'{{horario}}'}, {'{{profissional_nome}}'}.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Esses campos são preenchidos automaticamente pelo sistema: {'{{cliente_nome}}'} (nome do cliente), {'{{barbearia_nome}}'} (nome do estabelecimento), {'{{tempo_lembrete}}'} (antecedência escolhida), {'{{data}}'} e {'{{horario}}'} (dados do agendamento), {'{{profissional_nome}}'} (barbeiro/profissional).
        </p>

        <h4 className="mt-5 text-base font-semibold text-white">Mensagem de saudação pós-agendamento</h4>
        <p className="mt-1 text-xs text-gray-300">
          Sempre que o cliente agenda, ele recebe esta confirmação no WhatsApp.
        </p>

        <label className="mt-3 flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={settings.greeting_enabled}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                greeting_enabled: e.target.checked,
              }))
            }
          />
          Ativar mensagem de saudação automática
        </label>

        <div className="mt-4 flex items-center justify-between gap-2">
          <label className="block text-sm font-semibold text-white">Mensagem de saudação (editável)</label>
          <button
            type="button"
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                greeting_template: DEFAULT_GREETING_TEMPLATE,
              }))
            }
            className="rounded-md border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            Restaurar padrão (saudação)
          </button>
        </div>
        <textarea
          value={settings.greeting_template}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              greeting_template: e.target.value,
            }))
          }
          rows={6}
          className="mt-2 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
        />
        <p className="mt-2 text-xs text-amber-300">
          Obrigatório manter: {'{{cliente_nome}}'}, {'{{barbearia_nome}}'}, {'{{data}}'}, {'{{horario}}'}, {'{{profissional_nome}}'}.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Sem esses campos o sistema não consegue montar a saudação com os dados corretos de cliente e agendamento.
        </p>

        <p className="mt-3 text-xs text-gray-400">
          Variáveis disponíveis: {'{{cliente_nome}}'}, {'{{barbearia_nome}}'}, {'{{data}}'}, {'{{horario}}'}, {'{{profissional_nome}}'}, {'{{tempo_lembrete}}'}.
        </p>

        <button
          type="button"
          onClick={handleSaveAutomationSettings}
          disabled={savingSettings}
          className="mt-4 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
        >
          {savingSettings ? 'Salvando...' : 'Salvar automações de WhatsApp'}
        </button>
      </div>
    </div>
  );
}


