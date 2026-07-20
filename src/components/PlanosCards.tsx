import React from 'react';
import { Award, Gem, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildCadastroAgLink, normalizePartnerReferralCodeInput } from '../lib/partnerReferralCode';

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
  hidePrata = false,
  referralCupom = null,
  diamanteOnly = false,
}: {
  whatsappNumber?: string;
  hidePrata?: boolean;
  referralCupom?: string | null;
  diamanteOnly?: boolean;
}) {
  const precoPrata = 37.9;
  const precoDiamante = 67.9;
  const normalizedReferralCupom = normalizePartnerReferralCodeInput(String(referralCupom || ''));
  const referralOnlyMode = Boolean(normalizedReferralCupom);
  // diamanteOnly (funil do quiz /conhecer e /planos): SÓ o Diamante, lista curta e
  // oferta com âncora real (concorrente cobra por profissional). Landings intocadas.
  const showLegacyPrata = !hidePrata && !referralOnlyMode && !diamanteOnly;
  const showMainPrata = !referralOnlyMode && !diamanteOnly;
  const cadastroLink = (plan: 'prata' | 'diamante') =>
    buildCadastroAgLink({ plan, cupom: normalizedReferralCupom || null });

  const prataOk = [
    '1 profissional',
    'Agendamentos ilimitados',
    'Duas páginas de agendamentos exclusiva\u00A0sua',
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

  const prataPrincipalOk = [
    '1 profissional',
    'Agendamentos ilimitados',
    'Duas páginas de agendamentos exclusiva\u00A0sua',
    'Sistema de fila de espera',
    'Relatórios detalhados financeiro',
    'Controle de % cada profissional',
    'Gestão completa de clientes',
    'Sistema de prêmio para clientes\u00A0fiéis',
    'Controle de clientes sumidos',
    'Serviços ilimitados',
    'Ranking de clientes',
    'Pagamentos adiantados (Opcional)',
    'Suporte exclusivo seu | todo\u00A0dia',
    'sistema de avaliaçoes'
  ];
  const prataPrincipalX = [
    'Sistema de estoque',
    'Sistema completo de assinantes',
    'WhatsApp conectado ao sistema',
    'cobrança recorrente',
    'Lembretes automáticos para clientes 1h antes no WhatsApp',
    'Lembretes automatico para clientes assinantes 1h antes no WhatsApp'
  ];

  const diamanteOk = [
    'Profissionais ilimitados',
    'Agendamentos ilimitados',
    'Duas páginas de agendamentos exclusiva\u00A0sua',
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
    'Suporte exclusivo seu | todo\u00A0dia',
    'sistema de avaliaçoes',
    'WhatsApp seu conectado ao sistema',
    'Cobranças recorrentes'
  ];
  const diamanteExtra = [
    'Suporte priorizado',
    'Lembretes automáticos para clientes 1h antes no WhatsApp\u00A0ILIMITADO',
    'Lembretes automatico para clientes assinantes 1h antes no WhatsApp\u00A0ILIMITADO'
  ];

  // Modo diamanteOnly: linhas CURTAS de propósito — nenhuma quebra em tela de celular
  const diamanteCompact = [
    'Profissionais ILIMITADOS',
    'Agendamentos ilimitados',
    'WhatsApp com lembretes ILIMITADOS',
    'Clube de assinantes completo',
    'Cobrança recorrente automática',
    'Financeiro + comissões na régua',
    'Página sua — agenda sem app',
    'Estoque, fidelidade e ranking',
    'Suporte exclusivo todo dia',
  ];

  return (
    <div
      className={`grid gap-8 ${
        referralOnlyMode || diamanteOnly
          ? 'max-w-xl mx-auto'
          : hidePrata
            ? 'md:grid-cols-2 max-w-5xl mx-auto'
            : 'md:grid-cols-3'
      }`}
    >
      {/* PLANO PRATA (legado) */}
      {showLegacyPrata && (
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

            <Link
              to={cadastroLink('prata')}
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-black bg-white hover:bg-gray-100 transition-colors text-center"
            >
              Quero esse plano
            </Link>
          </div>
        </div>
      </div>
      )}

      {/* PLANO PRATA */}
      {showMainPrata && (
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-slate-100 via-zinc-300 to-slate-500 p-1 shadow-lg">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-zinc-200 via-slate-300 to-zinc-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold tracking-tight text-slate-800 drop-shadow-sm">PLANO</div>
                <div className="text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">PRATA</div>
              </div>
              <div className="bg-black/25 rounded-2xl p-3 border border-white/30">
                <Award className="h-10 w-10 text-slate-100" />
              </div>
            </div>
          </div>

          <div className="bg-[#0b0b0c] px-4 py-5 sm:px-6 sm:py-6">
            <ul className="space-y-2">
              {prataPrincipalOk.map((t) => (
                <LinhaRecurso key={t} texto={t} incluso />
              ))}
              <div className="my-4 h-px bg-white/15" />
              {prataPrincipalX.map((t) => (
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
              NÃO É PARCELAMENTO É MENSALIDADE
              <br />
              ESTILO NETFLIX PAGA O MÊS QUE USAR
              <span className="block mt-2">Pode trocar de plano depois — simples, rápido e sem burocracia.</span>
            </div>

            <Link
              to={cadastroLink('prata')}
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-white bg-slate-600 hover:bg-slate-500 transition-colors text-center"
            >
              Quero esse plano
            </Link>
          </div>
        </div>
      </div>
      )}

      {/* PLANO DIAMANTE */}
      <div className="w-full max-w-[520px] md:max-w-none mx-auto rounded-3xl bg-gradient-to-b from-cyan-300 via-blue-500 to-indigo-700 p-1 shadow-[0_0_35px_rgba(59,130,246,0.45)] ring-2 ring-cyan-300/80 md:scale-[1.02]">
        <div className="rounded-[22px] overflow-hidden">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                {diamanteOnly ? (
                  <>
                    <div className="text-[11px] font-black tracking-[0.25em] text-cyan-100/90 uppercase mb-1">Agendei Fácil</div>
                    <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">ACESSO</div>
                    <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">COMPLETO</div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">PLANO</div>
                    <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow">DIAMANTE</div>
                  </>
                )}
              </div>
              <div className="bg-white/15 rounded-2xl p-3 border border-cyan-100/70 shadow-lg">
                <Gem className="h-10 w-10 text-cyan-100" />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="rounded-full bg-amber-300 text-black px-3 py-1 text-[11px] font-black tracking-wide shadow-lg border border-amber-100">
                {diamanteOnly ? 'TUDO INCLUSO' : 'MAIS ESCOLHIDO'}
              </span>
            </div>
          </div>

          <div className="bg-[#0b0b0c] px-4 py-5 sm:px-6 sm:py-6">
            <ul className="space-y-2">
              {(diamanteOnly ? diamanteCompact : diamanteOk).map((t) => (
                <LinhaRecurso key={t} texto={t} incluso />
              ))}
              {!diamanteOnly && (
                <>
                  <div className="my-4 h-px bg-white/15" />
                  {diamanteExtra.map((t) => (
                    <LinhaRecurso key={t} texto={t} incluso />
                  ))}
                </>
              )}
            </ul>
            {diamanteOnly && (
              <div className="mt-3 text-center">
                <span className="text-[13px] font-extrabold text-cyan-200/90">...e muito mais.</span>
                <span className="mt-2 flex justify-center">
                  <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-black tracking-wide text-emerald-100">
                    Lembretes no WhatsApp reduzem até 60% das faltas
                  </span>
                </span>
              </div>
            )}
            {!diamanteOnly && (
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
            )}

            <div className="mt-6 rounded-2xl bg-black/70 border border-white/10 px-5 py-4">
              {diamanteOnly && (
                <div className="mb-2 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-500/15 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-200 uppercase">
                    🔓 Oferta desbloqueada
                  </span>
                </div>
              )}
              {diamanteOnly && (
                <div className="text-center mb-1">
                  <span className="text-white/50 text-lg font-bold line-through decoration-red-400/80">de R$ 119,90</span>
                  <span className="ml-2 text-emerald-300 text-[13px] font-black uppercase tracking-wide">por apenas</span>
                </div>
              )}
              <div className="flex items-end justify-center gap-2">
                <span className="text-white text-2xl font-bold">R$</span>
                <span className="text-white text-5xl font-extrabold tracking-tight">{formatarPrecoBRL(precoDiamante)}</span>
                <span className="text-white/80 text-lg font-semibold mb-1">mês</span>
              </div>
              {diamanteOnly ? (
                <div className="mt-2 text-center text-[12px] leading-snug text-emerald-200/95 font-bold">
                  🔒 Sem aumento — preço travado enquanto sua assinatura estiver ativa
                </div>
              ) : (
                <div className="mt-2 text-center text-[12px] leading-snug text-white/85 font-semibold">
                  APENAS R$ {diferencaBRL(precoDiamante, precoPrata)} DE DIFERENÇA DO PLANO PRATA PRO DIAMANTE
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-[12px] leading-snug text-white/80">
              NÃO É PARCELAMENTO É MENSALIDADE
              <br />
              ESTILO NETFLIX PAGA O MÊS QUE USAR
              {!diamanteOnly && (
                <span className="block mt-2">Pode trocar de plano depois — simples, rápido e sem burocracia.</span>
              )}
            </div>

            <Link
              to={cadastroLink('diamante')}
              className="block w-full mt-4 px-4 py-3 rounded-xl font-extrabold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-colors text-center shadow-lg"
            >
              {diamanteOnly ? 'Quero meu acesso agora 🚀' : 'Quero esse plano'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

