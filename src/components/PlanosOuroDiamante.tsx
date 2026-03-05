import { Award, Gem, CheckCircle2, XCircle } from 'lucide-react';

type PlanosOuroDiamanteProps = {
  ouroHref: string;
  diamanteHref: string;
  ouroCtaLabel?: string;
  diamanteCtaLabel?: string;
};

type ItemRecurso = {
  texto: string;
  inclusoNoOuro: boolean;
  inclusoNoDiamante: boolean;
  destacado?: boolean;
};

const recursos: ItemRecurso[] = [
  { texto: 'Profissionais ilimitados', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Agendamentos ilimitados', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Página de agendamentos exclusiva sua', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Sistema de fila de espera', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Sistema de estoque', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Sistema completo de assinantes', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Relatórios detalhados financeiro', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Controle de % cada profissional', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Gestão completa de clientes', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Sistema de prêmio para clientes fiéis', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Controle de clientes sumidos', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Serviços ilimitados', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Ranking de clientes', inclusoNoOuro: true, inclusoNoDiamante: true },
  { texto: 'Pagamentos adiantados (Opcional)', inclusoNoOuro: true, inclusoNoDiamante: true },
  // Extras do Diamante (no Ouro ficam como ❌, igual ao exemplo)
  {
    texto: 'Suporte (damos suporte)',
    inclusoNoOuro: true,
    inclusoNoDiamante: true,
    destacado: true
  },
  {
    texto: 'sistema de avaliaçoes',
    inclusoNoOuro: true,
    inclusoNoDiamante: true
  },
  {
    texto: 'Suporte priorizado',
    inclusoNoOuro: false,
    inclusoNoDiamante: true,
    destacado: true
  },
  {
    texto: 'Lembretes automáticos para clientes 1h antes no WhatsApp',
    inclusoNoOuro: false,
    inclusoNoDiamante: true,
    destacado: true
  },
  {
    texto: 'Lembretes automatico para clientes assinantes 1h antes no WhatsApp ILIMITADO',
    inclusoNoOuro: false,
    inclusoNoDiamante: true,
    destacado: true
  }
];

function formatarPrecoBRL(valor: number) {
  // Mantém o formato exato usado nos cards (R$ 47,90)
  return valor.toFixed(2).replace('.', ',');
}

function diferencaBRL(a: number, b: number) {
  return formatarPrecoBRL(Math.abs(a - b));
}

function LinhaRecurso({
  texto,
  incluso,
  escuro
}: {
  texto: string;
  incluso: boolean;
  escuro: boolean;
}) {
  const Icone = incluso ? CheckCircle2 : XCircle;
  const corIcone = incluso ? 'text-green-500' : 'text-red-500';
  const corTexto = escuro ? 'text-white' : 'text-gray-900';
  const corTextoDesabilitado = escuro ? 'text-white/80' : 'text-gray-600';

  return (
    <li className="flex items-start gap-3">
      <Icone className={`h-5 w-5 ${corIcone} flex-shrink-0 mt-0.5`} />
      <span className={`${incluso ? corTexto : corTextoDesabilitado} leading-snug`}>{texto}</span>
    </li>
  );
}

export default function PlanosOuroDiamante({
  ouroHref,
  diamanteHref,
  ouroCtaLabel = 'Começar Agora',
  diamanteCtaLabel = 'Começar Agora'
}: PlanosOuroDiamanteProps) {
  const precoOuro = 47.9;
  const precoDiamante = 77.9;

  const recursosBase = recursos.filter((r) => !r.destacado);
  const recursosExtra = recursos.filter((r) => r.destacado);

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {/* PLANO OURO */}
      <div className="rounded-3xl bg-gradient-to-b from-yellow-200 via-yellow-300 to-amber-500 p-1 shadow-xl">
        <div className="rounded-[22px] overflow-hidden">
          {/* Header */}
          <div className="relative px-6 py-6 bg-gradient-to-r from-yellow-300 to-amber-400">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow">
                  PLANO
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow">
                  OURO
                </div>
              </div>
              <div className="bg-black/35 rounded-2xl p-3 border border-white/15">
                <Award className="h-10 w-10 text-yellow-100" />
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="bg-[#0b0b0c] px-6 py-6">
            <ul className="space-y-3">
              {recursosBase.map((r) => (
                <LinhaRecurso key={r.texto} texto={r.texto} incluso={r.inclusoNoOuro} escuro />
              ))}

              <div className="my-4 h-px bg-white/15" />

              {recursosExtra.map((r) => (
                <LinhaRecurso key={r.texto} texto={r.texto} incluso={r.inclusoNoOuro} escuro />
              ))}
            </ul>

            {/* Preço */}
            <div className="mt-6 rounded-2xl bg-black/70 border border-white/10 px-5 py-4">
              <div className="flex items-end justify-center gap-2">
                <span className="text-white text-2xl font-bold">R$</span>
                <span className="text-white text-5xl font-extrabold tracking-tight">
                  {formatarPrecoBRL(precoOuro)}
                </span>
                <span className="text-white/80 text-lg font-semibold mb-1">mês</span>
              </div>
            </div>

            <div className="mt-4">
              <a
                href={ouroHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold py-3 text-center transition-colors"
              >
                {ouroCtaLabel}
              </a>
            </div>

            <div className="mt-4 text-center text-[12px] leading-snug text-white/80">
              NÃO É PARCELAMENTO É MENSALIDADE
              <br />
              ESTILO NETFLIX PAGA O MÊS QUE USAR
            </div>
          </div>
        </div>
      </div>

      {/* PLANO DIAMANTE */}
      <div className="rounded-3xl bg-gradient-to-b from-sky-300 via-blue-500 to-indigo-700 p-1 shadow-xl">
        <div className="rounded-[22px] overflow-hidden">
          {/* Header */}
          <div className="relative px-6 py-6 bg-gradient-to-r from-blue-500 to-indigo-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow">
                  PLANO
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow">
                  DIAMANTE
                </div>
              </div>
              <div className="bg-black/35 rounded-2xl p-3 border border-white/15">
                <Gem className="h-10 w-10 text-sky-100" />
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="bg-[#0b0b0c] px-6 py-6">
            <ul className="space-y-3">
              {recursosBase.map((r) => (
                <LinhaRecurso key={r.texto} texto={r.texto} incluso={r.inclusoNoDiamante} escuro />
              ))}

              <div className="my-4 h-px bg-white/15" />

              {recursosExtra.map((r) => (
                <LinhaRecurso key={r.texto} texto={r.texto} incluso={r.inclusoNoDiamante} escuro />
              ))}
            </ul>
            <div className="mt-3 rounded-xl border border-cyan-300/40 bg-gradient-to-b from-cyan-500/15 to-blue-500/10 px-4 py-3 text-center shadow-[0_0_18px_rgba(34,211,238,0.2)]">
              <div className="text-[13px] leading-relaxed text-cyan-50 font-semibold">
                No plano Diamante, seus clientes recebem lembretes automáticos ilimitados no WhatsApp.
                <span className="block mt-1">Isso ajuda o cliente a não esquecer o compromisso com você.</span>
              </div>
              <span className="block mt-2 text-[13px] font-extrabold text-cyan-100">Você escolhe quando enviar: 2h antes, 1h antes ou 30 min antes.</span>
              <span className="inline-flex mt-2 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-black tracking-wide text-emerald-100">
                Reduzindo até 60% em faltas
              </span>
            </div>

            {/* Preço */}
            <div className="mt-6 rounded-2xl bg-black/70 border border-white/10 px-5 py-4">
              <div className="flex items-end justify-center gap-2">
                <span className="text-white text-2xl font-bold">R$</span>
                <span className="text-white text-5xl font-extrabold tracking-tight">
                  {formatarPrecoBRL(precoDiamante)}
                </span>
                <span className="text-white/80 text-lg font-semibold mb-1">mês</span>
              </div>
              <div className="mt-2 text-center text-[12px] leading-snug text-white/85 font-semibold">
                APENAS R$ {diferencaBRL(precoDiamante, precoOuro)} DE DIFERENÇA DO PLANO OURO PRO DIAMANTE
              </div>
            </div>

            <div className="mt-4">
              <a
                href={diamanteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-white hover:bg-gray-100 text-blue-700 font-extrabold py-3 text-center transition-colors"
              >
                {diamanteCtaLabel}
              </a>
            </div>

            <div className="mt-4 text-center text-[12px] leading-snug text-white/80">
              NÃO É PARCELAMENTO É MENSALIDADE
              <br />
              ESTILO NETFLIX PAGA O MÊS QUE USAR
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


