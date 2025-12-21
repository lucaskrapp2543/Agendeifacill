import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../src/lib/supabase';

type InstanceRow = {
  establishment_id: string;
  status: 'pending' | 'connected' | 'active' | 'error' | string;
};

type SettingsRow = {
  establishment_id: string;
  enabled: boolean;
  remind_before_minutes: number;
};

/**
 * Tela/Bloco para o dashboard do estabelecimento.
 *
 * - Não expõe número/API key
 * - Mostra apenas status “ativo” quando ADMIN liberou e instância está ativa
 */
export function EstablishmentWhatsappRemindersInfo({ establishmentId }: { establishmentId: string }) {
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);

  const ativo = Boolean(settings?.enabled) && instance?.status === 'active';

  const statusText = useMemo(() => {
    if (!settings?.enabled) return '❌ Não ativo (admin não liberou)';
    if (!instance) return '🟡 Aguardando configuração da instância pelo admin';
    if (instance.status === 'active') return '✅ Ativo';
    if (instance.status === 'connected') return '🟡 Conectado (aguardando ativação)';
    if (instance.status === 'pending') return '🟠 Pendente';
    if (instance.status === 'error') return '🔴 Erro';
    return String(instance.status);
  }, [settings?.enabled, instance]);

  useEffect(() => {
    const load = async () => {
      if (!establishmentId) return;
      setLoading(true);
      try {
        const { data: cfg, error: cfgErr } = await supabase
          .from('whatsapp_reminder_settings')
          .select('establishment_id,enabled,remind_before_minutes')
          .eq('establishment_id', establishmentId)
          .maybeSingle();
        if (cfgErr) throw cfgErr;

        const { data: inst, error: instErr } = await supabase
          .from('whatsapp_instances')
          .select('establishment_id,status')
          .eq('establishment_id', establishmentId)
          .maybeSingle();
        if (instErr) throw instErr;

        setSettings((cfg as any) || null);
        setInstance((inst as any) || null);
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar status dos lembretes WhatsApp');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [establishmentId]);

  return (
    <div
      className="rounded-xl border border-gray-700 bg-[#101112] p-4"
      style={{
        backgroundColor: '#101112',
        color: '#ffffff',
        borderColor: '#374151',
      }}
    >
      <div className="text-lg font-semibold">📣 Lembretes de agendamentos (WhatsApp)</div>
      <div className="mt-1 text-sm text-gray-300" style={{ color: '#d1d5db' }}>
        {loading ? 'Carregando...' : statusText}
      </div>

      <div className="mt-4 text-sm text-gray-200">
        <div className="font-semibold">Como funciona</div>
        <div className="mt-1 text-gray-300" style={{ color: '#d1d5db' }}>
          Quando ativo, o sistema envia automaticamente um lembrete por WhatsApp para o cliente aproximadamente{' '}
          <b>{settings?.remind_before_minutes ?? 60} minutos</b> antes do agendamento.
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400" style={{ color: '#9ca3af' }}>
        {ativo
          ? 'Este recurso está ativo para seu estabelecimento.'
          : 'Se você quiser ativar, solicite ao suporte/ADMIN a liberação.'}
      </div>
    </div>
  );
}


