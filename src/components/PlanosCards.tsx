import React from 'react';
import { Award, Gem, CheckCircle2, XCircle } from 'lucide-react';

function formatarPrecoBRL(valor: number) {
  return valor.toFixed(2).replace('.', ',');
}

function diferencaBRL(a: number, b: number) {
  return formatarPrecoBRL(Math.abs(a - b));
}

function LinhaRecurso({
  texto,
  incluso
}: {
  texto: string;
  incluso: boolean;
}) {
  const Icone = incluso ? CheckCircle2 : XCircle;
  const corIcone = incluso ? 'text-green-500' : 'text-red-500';
  const corTexto = 'text-white';
  const corTextoDesabilitado = 'text-white/85';

  return (
    <li className="flex items-start gap-2">
      <Icone className={`h-4 w-4 sm:h-5 sm:w-5 ${corIcone} flex-shrink-0 mt-0.5`} />
      <span className={`${incluso ? corTexto : corTextoDesabilitado} text-[13px] sm:text-sm leading-snug tracking-tight break-words`}>
        {texto}
      </span>
    </li>
  );
}

export default function PlanosCards({
  whatsappNumber = '5548991484275',
  hidePrata = false
}: {
  whatsappNumber?: string;
  hidePrata?: boolean;
}) {
  const precoPrata = 27.9;
  const precoOuro = 37.9;
  const precoDiamante = 77.9;

  const waLink = (plano: 'PRATA' | 'OURO' | 'DIAMANTE') => {
    const message =
      plano === 'PRATA'
        ? 'Olá, quero o PLANO PRATA (R$ 27,90/mês).'
        : plano === 'OURO'
          ? 'Olá, quero subir meu plano para o OURO (R$ 37,90).'
          : `Olá, quero subir meu plano para o DIAMANTE (R$ ${formatarPrecoBRL(precoDiamante)}/mês).`;

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  };

  const prataOk = [
    '1 profissional',
    'Agendamentos ilimitados',
    'Página de agendamentos exclusiva\u00A0sua',
    'Relatórios detalhados financeiro',
    'Gestão completa de clientes',
    'Sistema de prêmio para clientes\u00A0fiéis',
    'Serviços ilimitados',
    'Pagamentos adiantados (Opcional)',
    'Suporte exclusivo seu | todo\u00A0dia'
  ];
  const prataX = [
    'Sistema de estoque de produtos',
    'Sistema completo de assinantes',
    'Controle de comissão por profissional',
    'Controle de clientes sumidos',
    'Ranking de clientes',
    'Lembretes automáticos para clientes 1h antes no WhatsApp',
    'Repescagem automática de clientes sumidos',
    'Mensagem de parabéns automática para clientes'
  ];

  const ouroOk = [
    'Profissionais ilimitados',
    'Agendamentos ilimitados',
    'Página de agendamentos exclusiva\u00A0sua',
    'Sistema de fila de espera',
    'Sistema de estoque',
    'Sistema completo de assinantes',
    'Relatórios detalhados financeiro',
    'Controle de % cada profissional',
    'Gestão completa de clientes',
    'Sistema de prêmio para clientes\u00A0fiéis',
    'Controle de clientes sumidos',
    'Serviços ilimitados',
    'Ranking de clientes',
    'Pagamentos adiantados (Opcional)',
    'Suporte exclusivo seu | todo\u00A0dia'
  ];
  const ouroX = [
    'Lembretes automáticos para clientes 1h antes no WhatsApp',
    'Lembretes automáticos para clientes na fila de espera',
    'Repescagem automática de clientes sumidos',
    'Mensagem de parabéns automática para clientes',
    'Mensagem automática após atendimento para cliente avaliar você no Google'
  ];

  const diamanteOk = [
    'Profissionais ilimitados',
    'Agendamentos ilimitados',
    'Página de agendamentos exclusiva\u00A0sua',
    'Sistema de fila de espera',
    'Sistema de estoque',
    'Sistema completo de assinantes',
    'Relatórios detalhados financeiro',
    'Controle de % cada profissional',
    'Gestão completa de clientes',
    'Sistema de prêmio para clientes\u00A0fiéis',
    'Controle de clientes sumidos',
    'Serviços ilimitados',
    'Ranking de clientes',
    'Pagamentos adiantados (Opcional)',
    'Suporte exclusivo seu | todo\u00A0dia'
  ];
  const diamanteExtra = [
    'Lembretes automáticos para clientes 1h antes no WhatsApp\u00A0ILIMITADO',
    'Lembretes automáticos para clientes na fila de espera',
    'Repescagem automática de clientes sumidos',
    'Mensagem de parabéns automática para clientes',
    'Mensagem automática após atendimento para cliente avaliar você no Google'
  ];

  return (
    <div className={`grid gap-8 ${hidePrata ? 'md:grid-cols-2 max-w-5xl mx-auto' : 'md:grid-cols-3'}`}>
      {/* PLANO PRATA */}
      {!hidePrata && (
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-gray-400 via-gray-300 to-gray-500 p-1 shadow-xl">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-gray-300 to-gray-400">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PLANO</div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PRATA</div>
              </div>
              <div className="bg-black/35 rounded-2xl p-3 border border-white/15">
                <div className="h-10 w-10 rounded-full bg-white/90 shadow-inner" />
              </div>
            </div>
          </div>

          <div className="bg-[#0b0b0c] px-4 py-5 sm:px-6 sm:py-6">
            <ul className="space-y-2">
              {prataOk.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso />
              ))}
              <div className="my-4 h-px bg-white/15" />
              {prataX.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso={false} />
              ))}
            </ul>

            <div className="mt-6 rounded-2xl bg-black/70 border border-white/10 px-5 py-4">
              <div className="flex items-end justify-center gap-2">
                <span className="text-white text-2xl font-bold">R$</span>
                <span className="text-white text-5xl font-extrabold tracking-tight">{formatarPrecoBRL(precoPrata)}</span>
                <span className="text-white/80 text-lg font-semibold mb-1">mês</span>
              </div>
            </div>

            <div className="mt-4 text-center text-[12px] leading-snug text-white/80">
              Pode trocar de plano depois — simples, rápido e sem burocracia.
            </div>

            <a
              href={waLink('PRATA')}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-black bg-white hover:bg-gray-100 transition-colors text-center"
            >
              Quero esse plano
            </a>
          </div>
        </div>
      </div>
      )}

      {/* PLANO OURO */}
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-amber-100 via-amber-200 to-yellow-400 p-1 shadow-lg">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-amber-300 to-yellow-400">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PLANO</div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">OURO</div>
              </div>
              <div className="bg-black/25 rounded-2xl p-3 border border-white/20">
                <Award className="h-10 w-10 text-amber-100" />
              </div>
            </div>
          </div>

          <div className="bg-[#0b0b0c] px-4 py-5 sm:px-6 sm:py-6">
            <ul className="space-y-2">
              {ouroOk.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso />
              ))}
              <div className="my-4 h-px bg-white/15" />
              {ouroX.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso={false} />
              ))}
            </ul>

            <div className="mt-6 rounded-2xl bg-black/70 border border-white/10 px-5 py-4">
              <div className="flex items-end justify-center gap-2">
                <span className="text-white text-2xl font-bold">R$</span>
                <span className="text-white text-5xl font-extrabold tracking-tight">{formatarPrecoBRL(precoOuro)}</span>
                <span className="text-white/80 text-lg font-semibold mb-1">mês</span>
              </div>
            </div>

            <div className="mt-4 text-center text-[12px] leading-snug text-white/80">
              NÃO É PARCELAMENTO É MENSALIDADE
              <br />
              ESTILO NETFLIX PAGA O MÊS QUE USAR
              <span className="block mt-2">Pode trocar de plano depois — simples, rápido e sem burocracia.</span>
            </div>

            <a
              href={waLink('OURO')}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-amber-50 bg-amber-700 hover:bg-amber-600 transition-colors text-center"
            >
              Quero esse plano
            </a>
          </div>
        </div>
      </div>

      {/* PLANO DIAMANTE */}
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-cyan-300 via-blue-500 to-indigo-700 p-1 shadow-[0_0_35px_rgba(59,130,246,0.45)] ring-2 ring-cyan-300/80 md:scale-[1.02]">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PLANO</div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">DIAMANTE</div>
              </div>
              <div className="bg-white/15 rounded-2xl p-3 border border-cyan-100/70 shadow-lg">
                <Gem className="h-10 w-10 text-cyan-100" />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="rounded-full bg-amber-300 text-black px-3 py-1 text-[11px] font-black tracking-wide shadow-lg border border-amber-100">
                MAIS ESCOLHIDO
              </span>
            </div>
          </div>

          <div className="bg-[#0b0b0c] px-4 py-5 sm:px-6 sm:py-6">
            <ul className="space-y-2">
              {diamanteOk.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso />
              ))}
              <div className="my-4 h-px bg-white/15" />
              {diamanteExtra.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso />
              ))}
            </ul>

            <div className="mt-6 rounded-2xl bg-black/70 border border-white/10 px-5 py-4">
              <div className="flex items-end justify-center gap-2">
                <span className="text-white text-2xl font-bold">R$</span>
                <span className="text-white text-5xl font-extrabold tracking-tight">{formatarPrecoBRL(precoDiamante)}</span>
                <span className="text-white/80 text-lg font-semibold mb-1">mês</span>
              </div>
              <div className="mt-2 text-center text-[12px] leading-snug text-white/85 font-semibold">
                APENAS R$ {diferencaBRL(precoDiamante, precoOuro)} DE DIFERENÇA DO PLANO OURO PRO DIAMANTE
              </div>
            </div>

            <div className="mt-4 text-center text-[12px] leading-snug text-white/80">
              NÃO É PARCELAMENTO É MENSALIDADE
              <br />
              ESTILO NETFLIX PAGA O MÊS QUE USAR
              <span className="block mt-2">Pode trocar de plano depois — simples, rápido e sem burocracia.</span>
            </div>

            <a
              href={waLink('DIAMANTE')}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-colors text-center shadow-lg"
            >
              Quero esse plano
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

