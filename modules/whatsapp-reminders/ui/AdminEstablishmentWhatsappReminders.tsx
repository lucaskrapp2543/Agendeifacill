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

/**
 * Seção isolada para ser embutida no Admin (por estabelecimento).
 *
 * IMPORTANTE:
 * - Não faz SELECT da coluna `api_key_encrypted` (bloqueada por privilégio).
 * - Para armazenar a chave, espera receber o valor JÁ criptografado (ciphertext).
 *   Use o helper: `modules/whatsapp-reminders/tools/encryptApiKey.ts`.
 */
export function AdminEstablishmentWhatsappReminders({ establishmentId }: Props) {
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
  const [status, setStatus] = useState<InstanceRow['status']>('pending');
  const [enabled, setEnabled] = useState(false);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState(60);
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [apiKeyEncrypted, setApiKeyEncrypted] = useState('');

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

      setInstance((inst as any) || null);
      setSettings((cfg as any) || null);

      setPhoneNumber(String((inst as any)?.phone_number || ''));
      setStatus(String((inst as any)?.status || 'pending'));
      setEnabled(Boolean((cfg as any)?.enabled ?? false));
      setRemindBeforeMinutes(Number((cfg as any)?.remind_before_minutes ?? 60));
      setMessageTemplate(String((cfg as any)?.message_template || '').trim() || templatePadrao);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar config de WhatsApp');
    } finally {
      setLoading(false);
    }
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
          provider: 'wasender',
          phone_number: phoneNumber.trim(),
          status,
        };

        // Só atualizar api_key_encrypted se o admin colar um ciphertext
        if (apiKeyEncrypted.trim()) payload.api_key_encrypted = apiKeyEncrypted.trim();

        const { error: iErr } = await supabase.from('whatsapp_instances').upsert(payload, {
          onConflict: 'establishment_id',
        });
        if (iErr) throw iErr;
      }

      toast.success('Configuração de WhatsApp salva');
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
            WhatsApp do estabelecimento (E.164, só dígitos)
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
            placeholder="5511999999999"
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
        </div>

        <div className="md:col-span-2">
          <div className="text-sm text-gray-300" style={{ color: '#d1d5db' }}>
            API Key (criptografada) — gere via helper e cole aqui (não é exibida depois)
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
          <div className="mt-1 text-xs text-gray-400" style={{ color: '#9ca3af' }}>
            Por segurança, após salvar este campo é limpo e a chave não é exibida novamente. Isso não significa que “não salvou”.
          </div>
        </div>
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


