import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../src/lib/supabase';

type Props = {
  establishmentId: string;
};

type InstanceRow = {
  establishment_id: string;
  provider: string;
  phone_number: string;
  status: 'pending' | 'connected' | 'active' | 'error' | string;
};

type SettingsRow = {
  establishment_id: string;
  enabled: boolean;
  remind_before_minutes: number;
  message_template: string | null;
};

type ReminderMetrics = {
  monthLabel: string;
  total: number;
  sent: number;
  failed: number;
  delivered: number;
  read: number;
};

type FailedLogRow = {
  created_at?: string | null;
  phone_to?: string | null;
  status?: string | null;
  meta_status?: string | null;
  meta_message_id?: string | null;
  last_error?: string | null;
  provider_response?: string | null;
};

/**
 * Seção isolada para ser embutida no Admin (por estabelecimento).
 *
 * IMPORTANTE:
 * - Não faz SELECT da coluna `api_key_encrypted` (bloqueada por privilégio).
 * - Para armazenar a chave, espera receber o valor JÁ criptografado (ciphertext).
 *   Use o helper: `modules/whatsapp-reminders/tools/encryptApiKey.ts`.
 */
export function AdminEstablishmentWhatsappReminders({ establishmentId }: Props) {
  const META_PHONE_ID_CACHE_KEY = 'agendeifacil_meta_phone_number_id';
  const META_TOKEN_MASK_CACHE_PREFIX = 'agendeifacil_meta_token_mask_v1_';
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);

  const templatePadrao =
    'Olá {client_name}! 👋\n' +
    'Lembrete do seu agendamento em {establishment_name}.\n\n' +
    '📅 {appointment_date}\n' +
    '⏰ {appointment_time}\n' +
    '✂️ {service_name}\n' +
    '👨‍💼 {professional_name}\n\n' +
    'Se precisar reagendar, fale com a barbearia.';

  const isCiphertextValido = (ciphertextB64: string) => {
    // Validação local (sem chave): apenas checa formato e versão do payload.
    // Formato esperado: base64( version(1 byte=1) | iv(12) | tag(16) | data(>=1) )
    try {
      const normalized = String(ciphertextB64 || '').replace(/\s+/g, '');
      if (!normalized) return false;
      const bin = atob(normalized);
      if (!bin || bin.length < 1 + 12 + 16 + 1) return false;
      const versionByte = bin.charCodeAt(0);
      return versionByte === 1;
    } catch {
      return false;
    }
  };

  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState('meta');
  const [status, setStatus] = useState<InstanceRow['status']>('pending');
  const [enabled, setEnabled] = useState(false);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState(60);
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [apiKeyEncrypted, setApiKeyEncrypted] = useState('');
  const [apiKeyEncryptedMaskedHint, setApiKeyEncryptedMaskedHint] = useState('');
  const [metrics, setMetrics] = useState<ReminderMetrics>({
    monthLabel: '',
    total: 0,
    sent: 0,
    failed: 0,
    delivered: 0,
    read: 0,
  });
  const [recentFailures, setRecentFailures] = useState<FailedLogRow[]>([]);

  const readCachedMetaPhoneId = (): string => {
    try {
      return String(window.localStorage.getItem(META_PHONE_ID_CACHE_KEY) || '').trim();
    } catch {
      return '';
    }
  };

  const writeCachedMetaPhoneId = (value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    try {
      window.localStorage.setItem(META_PHONE_ID_CACHE_KEY, v);
    } catch {
      // ignore
    }
  };

  const getMaskedTokenCacheKey = () => `${META_TOKEN_MASK_CACHE_PREFIX}${String(establishmentId || '').trim()}`;

  const maskCiphertextPreview = (ciphertextB64: string) => {
    const normalized = String(ciphertextB64 || '').replace(/\s+/g, '').trim();
    if (!normalized) return '';
    const start = normalized.slice(0, 8);
    const end = normalized.slice(-6);
    return `${start}...${end} (${normalized.length} chars)`;
  };

  const readCachedMaskedToken = (): string => {
    const key = getMaskedTokenCacheKey();
    if (!key) return '';
    try {
      return String(window.localStorage.getItem(key) || '').trim();
    } catch {
      return '';
    }
  };

  const writeCachedMaskedToken = (masked: string) => {
    const key = getMaskedTokenCacheKey();
    const value = String(masked || '').trim();
    if (!key || !value) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  };

  const isLikelyMetaPhoneNumberId = (value: string): boolean => {
    const digits = String(value || '').replace(/\D/g, '');
    // phone_number_id da Meta costuma ser numérico longo (não telefone E.164 comum).
    return digits.length >= 14;
  };

  const resolveDefaultMetaPhoneId = async (): Promise<string> => {
    const cached = readCachedMetaPhoneId();
    if (cached && isLikelyMetaPhoneNumberId(cached)) return cached;

    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('phone_number,status,provider')
        .eq('provider', 'meta')
        .not('phone_number', 'is', null)
        .limit(30);
      if (error) throw error;

      const rows = (data as Array<{ phone_number?: string | null; status?: string | null; provider?: string | null }>) || [];
      const normalized = rows
        .map(r => ({
          phone: String(r.phone_number || '').trim(),
          status: String(r.status || '').trim().toLowerCase(),
        }))
        .filter(r => r.phone && isLikelyMetaPhoneNumberId(r.phone));

      const activeFirst = normalized.find(r => r.status === 'active')?.phone || normalized[0]?.phone || '';
      if (activeFirst) {
        writeCachedMetaPhoneId(activeFirst);
        return activeFirst;
      }
    } catch {
      // fallback silencioso
    }

    return '';
  };

  const statusLabel = useMemo(() => {
    if (!instance) return 'Não configurado';
    if (instance.status === 'active') return '✅ Ativo';
    if (instance.status === 'connected') return '🟡 Conectado';
    if (instance.status === 'pending') return '🟠 Pendente';
    if (instance.status === 'error') return '🔴 Erro';
    return String(instance.status);
  }, [instance]);

  const load = async () => {
    if (!establishmentId) return;
    setLoading(true);
    try {
      const { data: inst, error: instErr } = await supabase
        .from('whatsapp_instances')
        .select('establishment_id,provider,phone_number,status')
        .eq('establishment_id', establishmentId)
        .maybeSingle();
      if (instErr) throw instErr;

      const { data: cfg, error: cfgErr } = await supabase
        .from('whatsapp_reminder_settings')
        .select('establishment_id,enabled,remind_before_minutes,message_template')
        .eq('establishment_id', establishmentId)
        .maybeSingle();
      if (cfgErr) throw cfgErr;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartIso = monthStart.toISOString();
      const monthLabel = monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      const { data: logsData, error: logsErr } = await supabase
        .from('whatsapp_reminder_logs')
        .select('status, meta_status')
        .eq('establishment_id', establishmentId)
        .gte('created_at', monthStartIso);
      if (logsErr) throw logsErr;

      const failureSelectCandidates = [
        'created_at,phone_to,status,meta_status,meta_message_id,last_error,provider_response',
        'created_at,phone_to,status,meta_status,meta_message_id,provider_response',
        'created_at,phone_to,status,meta_status,meta_message_id',
        'created_at,phone_to,status,meta_message_id',
      ];
      let failureRows: FailedLogRow[] = [];
      for (const fields of failureSelectCandidates) {
        const { data, error } = await supabase
          .from('whatsapp_reminder_logs')
          .select(fields)
          .eq('establishment_id', establishmentId)
          .or('meta_status.eq.failed,status.eq.failed')
          .order('created_at', { ascending: false })
          .limit(12);
        if (!error) {
          failureRows = (data as FailedLogRow[]) || [];
          break;
        }
      }

      const logs = (logsData as Array<{ status?: string | null; meta_status?: string | null }>) || [];
      const sent = logs.filter(l => String(l.status || '').toLowerCase() === 'sent').length;
      const failed = logs.filter(l => String(l.status || '').toLowerCase() === 'failed').length;
      const delivered = logs.filter(l => {
        const st = String(l.meta_status || '').toLowerCase();
        return st === 'delivered' || st === 'read';
      }).length;
      const read = logs.filter(l => String(l.meta_status || '').toLowerCase() === 'read').length;

      setInstance((inst as any) || null);
      setSettings((cfg as any) || null);

      const currentPhoneNumber = String((inst as any)?.phone_number || '').trim();
      setPhoneNumber(currentPhoneNumber);
      setProvider('meta');
      setStatus(String((inst as any)?.status || 'active'));
      setEnabled(Boolean((cfg as any)?.enabled ?? false));
      setRemindBeforeMinutes(Number((cfg as any)?.remind_before_minutes ?? 60));
      setMessageTemplate(String((cfg as any)?.message_template || '').trim() || templatePadrao);
      setApiKeyEncryptedMaskedHint(readCachedMaskedToken());

      if (currentPhoneNumber && isLikelyMetaPhoneNumberId(currentPhoneNumber)) {
        writeCachedMetaPhoneId(currentPhoneNumber);
      } else {
        const defaultMetaId = await resolveDefaultMetaPhoneId();
        if (defaultMetaId) setPhoneNumber(defaultMetaId);
      }
      setMetrics({
        monthLabel,
        total: logs.length,
        sent,
        failed,
        delivered,
        read,
      });
      setRecentFailures(failureRows);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar config de WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const formatFailureDate = (iso?: string | null) => {
    const raw = String(iso || '').trim();
    if (!raw) return '-';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString('pt-BR');
  };

  const getFailureReason = (row: FailedLogRow) => {
    const fromLastError = String(row.last_error || '').trim();
    if (fromLastError) return fromLastError;
    const fromProvider = String(row.provider_response || '').trim();
    if (fromProvider) return fromProvider.slice(0, 300);
    return 'Sem detalhe técnico no log (webhook/erro não informado).';
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId]);

  const salvar = async () => {
    if (!establishmentId) return;
    setLoading(true);
    try {
      const existeInstancia = Boolean(instance?.establishment_id);

      // 1) Settings
      const { error: sErr } = await supabase.from('whatsapp_reminder_settings').upsert(
        {
          establishment_id: establishmentId,
          enabled,
          remind_before_minutes: remindBeforeMinutes,
          message_template: messageTemplate?.trim() || null,
        },
        { onConflict: 'establishment_id' }
      );
      if (sErr) throw sErr;

      // 2) Instance (phone/status/provider + api_key_encrypted opcional)
      if (phoneNumber.trim()) {
        // Se a instância foi apagada (número banido / recadastro), precisamos do ciphertext de novo
        if (!existeInstancia && !apiKeyEncrypted.trim()) {
          toast.error('Cole a API Key (criptografada) para cadastrar um novo número.');
          return;
        }

        // Se colou algo, validar formato antes de salvar (evita quebrar o job com ciphertext inválido)
        if (apiKeyEncrypted.trim() && !isCiphertextValido(apiKeyEncrypted.trim())) {
          toast.error(
            'API Key criptografada inválida. Gere pelo helper do projeto (encryptApiKey.ts) e cole o resultado (base64).'
          );
          return;
        }

        const payload: any = {
          establishment_id: establishmentId,
          provider: 'meta',
          phone_number: phoneNumber.trim(),
          status,
        };

        // Só atualizar api_key_encrypted se o admin colar um ciphertext
        if (apiKeyEncrypted.trim()) payload.api_key_encrypted = apiKeyEncrypted.trim();

        const { error: iErr } = await supabase.from('whatsapp_instances').upsert(payload, {
          onConflict: 'establishment_id',
        });
        if (iErr) throw iErr;
        writeCachedMetaPhoneId(phoneNumber.trim());
      }

      toast.success('Configuração de WhatsApp salva');
      const masked = apiKeyEncrypted.trim() ? maskCiphertextPreview(apiKeyEncrypted) : '';
      if (masked) {
        setApiKeyEncryptedMaskedHint(masked);
        writeCachedMaskedToken(masked);
      }
      setApiKeyEncrypted('');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? String(e.message) : 'Erro ao salvar WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-gray-700 bg-[#101112] p-4"
      style={{
        backgroundColor: '#101112',
        color: '#ffffff',
        borderColor: '#374151',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">📣 Lembretes WhatsApp</div>
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Status: {statusLabel}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-300" style={{ color: '#d1d5db' }}>
            Ativar lembretes
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            disabled={loading}
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Provedor de envio
          </div>
          <input
            className="mt-1 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#ffffff',
              borderColor: '#374151',
            }}
            value="Meta oficial (Cloud API)"
            disabled
          />
        </div>

        <div>
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Meta phone_number_id (ID numérico da Meta)
          </div>
          <input
            className="mt-1 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#ffffff',
              borderColor: '#374151',
            }}
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="Ex: 123456789012345"
            disabled={loading}
          />
        </div>

        <div>
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Status da instância
          </div>
          <select
            className="mt-1 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#ffffff',
              borderColor: '#374151',
            }}
            value={status}
            onChange={e => setStatus(e.target.value)}
            disabled={loading}
          >
            <option value="pending">pending</option>
            <option value="connected">connected</option>
            <option value="active">active</option>
            <option value="error">error</option>
          </select>
        </div>

        <div>
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Enviar lembrete (minutos antes)
          </div>
          <input
            className="mt-1 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#ffffff',
              borderColor: '#374151',
            }}
            type="number"
            value={remindBeforeMinutes}
            onChange={e => setRemindBeforeMinutes(Number(e.target.value))}
            min={5}
            max={24 * 60}
            disabled={loading}
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Template da mensagem (placeholders: {'{client_name}'} {'{appointment_date}'} {'{appointment_time}'}{' '}
            {'{service_name}'} {'{professional_name}'} {'{establishment_name}'})
          </div>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#ffffff',
              borderColor: '#374151',
            }}
            rows={5}
            value={messageTemplate}
            onChange={e => setMessageTemplate(e.target.value)}
            disabled={loading}
          />
          <div className="mt-1 text-xs text-emerald-300">
            No provedor Meta oficial, o envio usa o template aprovado na Meta. Este campo fica como fallback/legado.
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            Access Token da Meta (criptografado) — gere via helper e cole aqui
          </div>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white"
            style={{
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#ffffff',
              borderColor: '#374151',
            }}
            rows={3}
            value={apiKeyEncrypted}
            onChange={e => setApiKeyEncrypted(e.target.value)}
            placeholder="(cole aqui o ciphertext gerado pelo encryptApiKey.ts)"
            disabled={loading}
          />
          {apiKeyEncryptedMaskedHint ? (
            <div className="mt-1 text-xs text-emerald-300">
              Chave salva neste navegador (mascarada): <span className="font-mono">{apiKeyEncryptedMaskedHint}</span>
            </div>
          ) : null}
          <div className="mt-1 text-xs text-gray-400" style={{ color: '#9ca3af' }}>
            Por segurança, após salvar o campo continua limpo. O resumo mascarado acima confirma que voce salvou.
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-gray-700 bg-black/30 p-3">
        <div className="text-sm font-semibold text-white">Métricas do mês ({metrics.monthLabel || '-'})</div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded border border-gray-700 p-2">
            <div className="text-[11px] text-gray-400">Total</div>
            <div className="text-base font-bold text-white">{metrics.total}</div>
          </div>
          <div className="rounded border border-gray-700 p-2">
            <div className="text-[11px] text-gray-400">Enviados</div>
            <div className="text-base font-bold text-emerald-400">{metrics.sent}</div>
          </div>
          <div className="rounded border border-gray-700 p-2">
            <div className="text-[11px] text-gray-400">Falhas</div>
            <div className="text-base font-bold text-red-400">{metrics.failed}</div>
          </div>
          <div className="rounded border border-gray-700 p-2">
            <div className="text-[11px] text-gray-400">Entregues</div>
            <div className="text-base font-bold text-cyan-400">{metrics.delivered}</div>
          </div>
          <div className="rounded border border-gray-700 p-2">
            <div className="text-[11px] text-gray-400">Lidas</div>
            <div className="text-base font-bold text-violet-400">{metrics.read}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3">
        <div className="text-sm font-semibold text-red-200">Falhas recentes (somente Admin)</div>
        {recentFailures.length === 0 ? (
          <div className="mt-2 text-xs text-gray-300">Nenhuma falha recente encontrada para este estabelecimento.</div>
        ) : (
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
            {recentFailures.map((row, idx) => (
              <div key={`${String(row.meta_message_id || 'no-wamid')}-${idx}`} className="rounded border border-red-500/20 bg-black/30 p-2">
                <div className="text-[11px] text-gray-300">
                  {formatFailureDate(row.created_at)} • Destino: {String(row.phone_to || '-')}
                </div>
                <div className="text-[11px] text-gray-300">
                  status={String(row.status || '-')} • meta_status={String(row.meta_status || '-')}
                </div>
                <div className="mt-1 break-all text-[11px] text-red-200">{getFailureReason(row)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-white/5"
          onClick={load}
          disabled={loading}
        >
          Recarregar
        </button>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={salvar}
          disabled={loading}
        >
          Salvar
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-400">
        Segurança: a coluna sensível <code className="text-gray-200">api_key_encrypted</code> tem <b>SELECT revogado</b>{' '}
        para <code className="text-gray-200">anon/authenticated</code> no banco.
      </div>
    </div>
  );
}


