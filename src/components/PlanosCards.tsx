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
  whatsappNumber = '5548991484275'
}: {
  whatsappNumber?: string;
}) {
  const precoPrata = 27.9;
  const precoOuro = 47.9;
  const precoDiamante = 77.9;

  const waLink = (plano: 'PRATA' | 'OURO' | 'DIAMANTE') => {
    const message =
      plano === 'PRATA'
        ? 'Olá, quero o PLANO PRATA (R$ 27,90/mês).'
        : plano === 'OURO'
          ? 'Olá, quero subir meu plano para o OURO (R$ 47,90).'
          : `Olá, quero subir meu plano para o DIAMANTE (R$ ${formatarPrecoBRL(precoDiamante)}/mês).`;

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  };

  const prataOk = [
    '1 profissional',
    'Agendamentos ilimitado',
    'Pagina de agendamentos exclusiva\u00A0sua',
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
    'Lembretes automaticos para clientes 1h antes no WhatsApp',
    'Lembretes automaticos clientes sumidos e parabens de aniversario'
  ];

  const ouroOk = [
    'Profissionais ilimitado',
    'Agendamentos ilimitado',
    'Pagina de agendamentos exclusiva\u00A0sua',
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
    'Lembretes automaticos para clientes 1h antes no WhatsApp',
    'Lembretes automaticos clientes sumidos e parabens de aniversario'
  ];

  const diamanteOk = [
    'Profissionais ilimitado',
    'Agendamentos ilimitado',
    'Pagina de agendamentos exclusiva\u00A0sua',
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
    'Lembretes automaticos para clientes 1h antes no WhatsApp\u00A0ILIMITADO',
    'Lembretes automaticos clientes sumidos e parabens de aniversario'
  ];

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {/* PLANO PRATA */}
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

      {/* PLANO OURO */}
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-yellow-200 via-yellow-300 to-amber-500 p-1 shadow-xl">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-yellow-300 to-amber-400">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PLANO</div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">OURO</div>
              </div>
              <div className="bg-black/35 rounded-2xl p-3 border border-white/15">
                <Award className="h-10 w-10 text-yellow-100" />
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
              ESTILO NETFLIX PAGA O MES QUE USAR
              <span className="block mt-2">Pode trocar de plano depois — simples, rápido e sem burocracia.</span>
            </div>

            <a
              href={waLink('OURO')}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-black bg-amber-400 hover:bg-amber-300 transition-colors text-center"
            >
              Quero esse plano
            </a>
          </div>
        </div>
      </div>

      {/* PLANO DIAMANTE */}
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-sky-300 via-blue-500 to-indigo-700 p-1 shadow-xl">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-blue-500 to-indigo-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PLANO</div>
                <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">DIAMANTE</div>
              </div>
              <div className="bg-black/35 rounded-2xl p-3 border border-white/15">
                <Gem className="h-10 w-10 text-sky-100" />
              </div>
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
              ESTILO NETFLIX PAGA O MES QUE USAR
              <span className="block mt-2">Pode trocar de plano depois — simples, rápido e sem burocracia.</span>
            </div>

            <a
              href={waLink('DIAMANTE')}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-blue-900 bg-white hover:bg-gray-100 transition-colors text-center"
            >
              Quero esse plano
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

