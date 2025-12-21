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
export function EstablishmentWhatsappRemindersInfo({
  establishmentId,
  useLightLayout = true,
  establishmentNome,
  establishmentCodigo,
}: {
  establishmentId: string;
  useLightLayout?: boolean;
  establishmentNome?: string;
  establishmentCodigo?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);

  const ativo = Boolean(settings?.enabled) && instance?.status === 'active';
  const isLight = useLightLayout;
  const whatsappSuporteNumero = '5548991265320';

  const status = useMemo(() => {
    if (!settings?.enabled) {
      return {
        label: 'Não ativo (admin ainda não liberou)',
        variant: 'bloqueado' as const,
      };
    }
    if (!instance) {
      return {
        label: 'Aguardando configuração pelo admin',
        variant: 'aguardando' as const,
      };
    }
    if (instance.status === 'active') {
      return {
        label: 'Ativo',
        variant: 'ativo' as const,
      };
    }
    if (instance.status === 'connected') {
      return {
        label: 'Conectado (aguardando ativação)',
        variant: 'aguardando' as const,
      };
    }
    if (instance.status === 'pending') {
      return {
        label: 'Pendente',
        variant: 'pendente' as const,
      };
    }
    if (instance.status === 'error') {
      return {
        label: 'Erro',
        variant: 'erro' as const,
      };
    }
    return {
      label: String(instance.status),
      variant: 'aguardando' as const,
    };
  }, [settings?.enabled, instance]);

  const statusBadgeClass = useMemo(() => {
    const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1';
    if (status.variant === 'ativo') {
      return `${base} ${isLight ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'}`;
    }
    if (status.variant === 'erro') {
      return `${base} ${isLight ? 'bg-red-50 text-red-900 ring-red-200' : 'bg-red-500/15 text-red-200 ring-red-500/30'}`;
    }
    if (status.variant === 'pendente') {
      return `${base} ${isLight ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-amber-500/15 text-amber-200 ring-amber-500/30'}`;
    }
    if (status.variant === 'bloqueado') {
      return `${base} ${isLight ? 'bg-gray-100 text-gray-800 ring-gray-200' : 'bg-white/10 text-gray-200 ring-white/10'}`;
    }
    return `${base} ${isLight ? 'bg-blue-50 text-blue-900 ring-blue-200' : 'bg-blue-500/15 text-blue-200 ring-blue-500/30'}`;
  }, [status.variant, isLight]);

  const contextoEstabelecimento = useMemo(() => {
    const partes: string[] = [];
    if (establishmentNome) partes.push(`Estabelecimento: ${establishmentNome}`);
    if (establishmentCodigo) partes.push(`Código: ${establishmentCodigo}`);
    partes.push(`ID: ${establishmentId}`);
    return partes.join(' | ');
  }, [establishmentNome, establishmentCodigo, establishmentId]);

  const criarLinkWhatsApp = (mensagem: string) => {
    return `https://wa.me/${whatsappSuporteNumero}?text=${encodeURIComponent(mensagem)}`;
  };

  const linkAtivarLembretes = useMemo(() => {
    const msg =
      `Olá! Quero ativar o recurso de Lembretes Automáticos por WhatsApp no Agendei Fácil.\n` +
      `${contextoEstabelecimento}\n\n` +
      `Pode liberar/ativar para mim, por favor?`;
    return criarLinkWhatsApp(msg);
  }, [contextoEstabelecimento]);

  const linkAtivarPagamentos = useMemo(() => {
    const msg =
      `Olá! Quero ativar o recurso de Pagamentos Adiantados no Agendei Fácil.\n` +
      `${contextoEstabelecimento}\n\n` +
      `Pode liberar/ativar para mim, por favor?`;
    return criarLinkWhatsApp(msg);
  }, [contextoEstabelecimento]);

  const linkAtivarAmbos = useMemo(() => {
    const msg =
      `Olá! Quero ativar os recursos de Lembretes Automáticos (WhatsApp) + Pagamentos Adiantados no Agendei Fácil.\n` +
      `${contextoEstabelecimento}\n\n` +
      `Pode liberar/ativar para mim, por favor?`;
    return criarLinkWhatsApp(msg);
  }, [contextoEstabelecimento]);

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
      className={`rounded-2xl border p-5 sm:p-6 shadow-sm ${isLight
        ? 'bg-white border-gray-200 text-gray-900'
        : 'bg-gradient-to-b from-[#101112] via-[#0b0c0d] to-black border-gray-800 text-white'
        }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg sm:text-xl font-bold">
            Lembretes para Clientes <span className={isLight ? 'text-gray-600' : 'text-gray-300'}>(WhatsApp)</span>
          </div>
          <div className={`mt-1 text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
            {loading ? 'Carregando status...' : 'Status do recurso:'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={statusBadgeClass}>{loading ? 'Carregando...' : status.label}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          className={`rounded-2xl border overflow-hidden ${isLight
            ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-white border-amber-200/70'
            : 'bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-white/5 border-amber-400/20'
            }`}
        >
          <div className="p-4 sm:p-5">
            <div className={`text-sm font-semibold ${isLight ? 'text-amber-950' : 'text-amber-200'}`}>
              Visual do lembrete
            </div>
            <div className={`mt-1 text-xs ${isLight ? 'text-amber-800' : 'text-amber-200/80'}`}>
              Exemplo de comunicação automática com seu cliente.
            </div>
          </div>
          <div className={`px-4 pb-5 sm:px-5 ${isLight ? '' : ''}`}>
            <img
              src="/lembrete.png"
              alt="Exemplo de lembrete por WhatsApp"
              className={`w-full max-w-md mx-auto rounded-xl ${isLight
                ? 'shadow-md shadow-amber-500/15 ring-1 ring-amber-200/70'
                : 'shadow-lg shadow-black/40 ring-1 ring-white/10'
                }`}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-4 sm:p-5 ${isLight
              ? 'bg-white border-gray-200'
              : 'bg-black/30 border-gray-800'
              }`}
          >
            <div className={`text-sm font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Como funciona
            </div>
            <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
              Quando estiver ativo, o Agendei Fácil envia automaticamente um lembrete por WhatsApp para o cliente cerca de{' '}
              <span className="font-semibold">{settings?.remind_before_minutes ?? 60} minutos</span> antes do agendamento.
              As mensagens são enviadas do seu próprio número vinculado ao sistema.
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 sm:p-5 ${isLight
              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200/80'
              : 'bg-gradient-to-r from-amber-500/15 to-yellow-500/10 border-amber-400/20'
              }`}
          >
            <div className={`text-sm font-semibold ${isLight ? 'text-amber-950' : 'text-amber-200'}`}>
              Qual o valor desse recurso?
            </div>
            <div className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-amber-950' : 'text-amber-100'}`}>
              <span className="font-bold">Apenas R$ 29,90</span> a mais na sua fatura mensal do Agendei Fácil.
            </div>
            <div className={`mt-1 text-sm ${isLight ? 'text-amber-900' : 'text-amber-200/90'}`}>
              Mensagens <span className="font-semibold">ilimitadas</span> enviadas do seu próprio número conectado ao Agendei Fácil.
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 sm:p-5 ${isLight
              ? 'bg-gradient-to-br from-white via-white to-emerald-50/60 border-emerald-200/70 shadow-sm'
              : 'bg-gradient-to-br from-black/30 via-black/20 to-emerald-500/10 border-emerald-500/20 shadow-sm shadow-black/30'
              }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Quer reduzir drasticamente as faltas?
              </div>
              <span
                className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isLight
                  ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                  : 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                  }`}
              >
                Pagamentos Adiantados
              </span>
            </div>

            <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
              Seu cliente paga <span className="font-semibold">antes</span> de confirmar o agendamento.
              Você escolhe como quer trabalhar: <span className="font-semibold">exigir</span> o pagamento ou deixar como{' '}
              <span className="font-semibold">opcional</span>. O resultado é um atendimento mais sério, mais previsível e com muito menos “furos”.
            </p>

            <ul className={`mt-3 text-sm ${isLight ? 'text-gray-700' : 'text-gray-200'} space-y-1`}>
              <li>
                <span className="font-semibold">•</span> Cai drasticamente o número de faltas
              </li>
              <li>
                <span className="font-semibold">•</span> Você protege seu tempo e seu faturamento
              </li>
              <li>
                <span className="font-semibold">•</span> Seu negócio fica mais profissional
              </li>
            </ul>

            <div
              className={`mt-4 rounded-xl border p-4 ${isLight
                ? 'bg-white border-emerald-200/70 shadow-sm'
                : 'bg-white/5 border-emerald-500/20 shadow-sm shadow-black/30'
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Eu pago para ter Pagamentos Adiantados?
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isLight
                    ? 'bg-gray-100 text-gray-900 ring-gray-200'
                    : 'bg-white/10 text-gray-200 ring-white/10'
                    }`}
                >
                  Não
                </span>
              </div>

              <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
                Você <span className="font-semibold">não</span> paga mensalidade extra. Existe apenas a taxa de processamento da{' '}
                <span className="font-semibold">Pagar.me</span> (não é nossa):
              </p>

              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100'
                  }`}
              >
                1,19% + R$ 0,50 <span className="font-normal opacity-90">por pagamento</span>
              </div>

              <div className={`mt-3 text-xs ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                Reflexão: <span className="font-semibold">1,19% sai muito mais barato do que um furo no mês inteiro.</span>
              </div>

              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${isLight
                  ? 'bg-gray-50 border-gray-200 text-gray-700'
                  : 'bg-black/20 border-white/10 text-gray-200'
                  }`}
              >
                <span className="font-semibold">Exemplo:</span> serviço de <span className="font-semibold">R$ 10,00</span> → você recebe aproximadamente{' '}
                <span className="font-semibold">R$ 9,38</span> (já com as taxas descontadas).
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href={linkAtivarLembretes}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${isLight
            ? 'bg-black text-white hover:bg-gray-900 shadow-md'
            : 'bg-white text-black hover:bg-gray-100 shadow-md'
            }`}
        >
          Quero ativar lembrete automático
        </a>

        <a
          href={linkAtivarPagamentos}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${isLight
            ? 'bg-gray-900 text-white hover:bg-black shadow-md'
            : 'bg-white/10 text-white hover:bg-white/15 ring-1 ring-white/10 shadow-md'
            }`}
        >
          Quero ativar pagamentos adiantados
        </a>

        <a
          href={linkAtivarAmbos}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full rounded-xl px-4 py-3 text-center text-sm font-bold transition-all ${isLight
            ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 ring-1 ring-amber-200/40 hover:brightness-105'
            : 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black shadow-lg shadow-black/40 ring-1 ring-amber-400/30 hover:brightness-105'
            }`}
        >
          Quero ativar os dois
        </a>
      </div>

      <div className={`mt-4 text-xs ${isLight ? 'text-gray-500' : 'text-gray-300'}`}>
        {ativo
          ? 'Perfeito — seus lembretes já estão ativos.'
          : 'Para ativar, clique em um botão acima e peça a liberação pelo WhatsApp. Nossa equipe faz o restante.'}
      </div>
    </div>
  );
}


