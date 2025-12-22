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
  const suporteWhatsapp = '5548991265320';

  const statusText = useMemo(() => {
    if (!settings?.enabled) return '❌ Não ativo (admin ainda não liberou)';
    if (!instance) return '🟡 Aguardando configuração da instância pelo admin';
    if (instance.status === 'active') return '✅ Ativo';
    if (instance.status === 'connected') return '🟡 Conectado (aguardando ativação)';
    if (instance.status === 'pending') return '🟠 Pendente';
    if (instance.status === 'error') return '🔴 Erro';
    return String(instance.status);
  }, [settings?.enabled, instance]);

  const abrirWhatsApp = (tipo: 'lembrete' | 'pagamentos' | 'ambos') => {
    const textoBase =
      tipo === 'lembrete'
        ? 'Quero ativar o lembrete automático para clientes (WhatsApp)'
        : tipo === 'pagamentos'
          ? 'Quero ativar pagamentos adiantados'
          : 'Quero ativar lembrete automático (WhatsApp) + pagamentos adiantados';

    const msg = encodeURIComponent(`${textoBase}\n\nEstablishmentId: ${establishmentId}`);
    window.open(`https://wa.me/${suporteWhatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

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
    <div className="w-full">
      <div className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#0b0b0c] to-black p-5 shadow-xl">
        {/* Header (igual ao deploy) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg sm:text-xl font-extrabold text-white">📣 Lembretes para Clientes (WhatsApp)</div>
            <div className="mt-1 text-sm text-gray-300">Status do recurso:</div>
          </div>

          <span className="inline-flex items-center rounded-full bg-gray-800/70 border border-gray-700 px-3 py-1 text-xs font-semibold text-gray-100 w-fit">
            {loading ? 'Carregando...' : statusText}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          {/* Coluna esquerda: visual */}
          <div className="rounded-2xl border border-amber-500/20 bg-black/40 p-4">
            <div className="text-sm font-bold text-amber-200">Visual do lembrete</div>
            <div className="mt-1 text-xs text-amber-200/70">Exemplo de comunicação automática com seu cliente</div>

            <div className="mt-4 overflow-hidden rounded-xl border border-amber-500/10 bg-black/30">
              <img
                src="/lembrete.png"
                alt="Exemplo de lembrete automático no WhatsApp"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Coluna direita: card único (igual ao deploy) */}
          <div className="rounded-2xl border border-emerald-500/25 bg-black/35 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/15 bg-black/30 p-4">
                <div className="text-sm font-bold text-emerald-200">Como funciona</div>
                <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                  Quando estiver ativo, o Agendei Fácil envia automaticamente um lembrete por WhatsApp para o cliente cerca de{' '}
                  <span className="font-semibold text-white">{settings?.remind_before_minutes ?? 60} minutos</span> antes do
                  agendamento. As mensagens são enviadas do seu próprio número conectado ao sistema.
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/15 bg-black/30 p-4">
                <div className="text-sm font-bold text-emerald-200">Qual o valor desse recurso?</div>
                <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                  Apenas <span className="font-extrabold text-amber-200">R$ 22,00</span> a mais na sua fatura mensal do Agendei Fácil.
                </div>
                <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                  Apenas vinte e dois reais a mais para lembretes ilimitado.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/15 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-white">Quer reduzir drasticamente as faltas?</div>
                <span className="inline-flex items-center rounded-full bg-emerald-600/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  Pagamentos Adiantados
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                Seu cliente paga antes de confirmar o agendamento. Você escolhe como quer trabalhar e exige o pagamento ou deixa como opcional.
                O resultado é um atendimento mais sério, mais previsível e com muito menos “furos”.
              </div>

              <ul className="mt-3 space-y-1 text-sm text-gray-200">
                <li>• Cai drasticamente o número de faltas</li>
                <li>• Você protege seu tempo e seu faturamento</li>
                <li>• Seu negócio fica mais profissional</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/15 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-white">Eu pago para ter Pagamentos Adiantados?</div>
                <span className="inline-flex items-center rounded-full bg-gray-700/50 border border-gray-600 px-3 py-1 text-[11px] font-semibold text-gray-200">
                  Não
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                Você não paga mensalidade extra. Existe apenas a taxa de processamento do PIX.
              </div>

              <div className="mt-3 rounded-xl border border-emerald-500/10 bg-black/35 p-3 text-sm text-gray-200">
                <div className="font-bold text-emerald-200 mb-1">Taxas do PIX</div>
                <div>• 1,19% no PIX</div>
                <div>• R$ 0,50 por pagamento</div>
                <div className="mt-2 text-xs text-gray-400">
                  * Valores aproximados; pode haver variação por arredondamentos e regras do provedor.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões (igual ao deploy) */}
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={() => abrirWhatsApp('lembrete')}
            className="flex-1 rounded-xl border border-amber-500/30 bg-black/40 px-4 py-3 text-sm font-bold text-white hover:bg-black/60 transition-colors"
          >
            Quero ativar lembrete automático
          </button>

          <button
            type="button"
            onClick={() => abrirWhatsApp('pagamentos')}
            className="flex-1 rounded-xl border border-emerald-500/30 bg-black/40 px-4 py-3 text-sm font-bold text-white hover:bg-black/60 transition-colors"
          >
            Quero ativar pagamentos adiantado
          </button>

          <button
            type="button"
            onClick={() => abrirWhatsApp('ambos')}
            className="flex-1 rounded-xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-black hover:bg-amber-300 transition-colors"
          >
            Quero ativar os dois
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          {ativo
            ? '✅ Este recurso já está ativo para seu estabelecimento.'
            : 'Para ativar, clique em um botão acima e solicite ao suporte/ADMIN a liberação.'}
        </div>
      </div>
    </div>
  );
}


