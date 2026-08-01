import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  fetchEstablishmentMonthlyGoal,
  fetchMonthlyGoalCredit,
  fetchMonthlyGoalHistory,
  type MonthlyGoalCredit,
  type MonthlyGoalHistoryItem,
  type MonthlyGoalResult,
} from '../lib/monthlyGoal';
import {
  MONTHLY_GOAL_MILESTONES,
  MONTHLY_GOAL_TARGET,
  computeGoalDiscount,
  formatCentsBRL,
  formatReferenceMonthLabel,
} from '../utils/monthlyGoal';

interface MonthlyGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  /**
   * Sem Mercado Pago conectado o estabelecimento NÃO consegue receber pagamento
   * online — ou seja, é impossível pontuar na meta. Mostrar "0%" para ele só
   * desanima. Nesse caso o modal vira um convite para conectar.
   * Default true para não mudar o comportamento de quem não passa a prop.
   */
  hasMercadoPago?: boolean;
  onConnectMercadoPago?: () => void;
}

/**
 * 🏆 Meta Mensal — visão do estabelecimento (somente leitura).
 * Não cria, não altera e não aplica nenhuma cobrança.
 */
export function MonthlyGoalModal({
  isOpen,
  onClose,
  establishmentId,
  hasMercadoPago = true,
  onConnectMercadoPago,
}: MonthlyGoalModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MonthlyGoalResult | null>(null);
  const [history, setHistory] = useState<MonthlyGoalHistoryItem[]>([]);
  const [credit, setCredit] = useState<MonthlyGoalCredit | null>(null);

  useEffect(() => {
    if (!isOpen || !establishmentId) return;
    let cancelled = false;
    setLoading(true);
    fetchEstablishmentMonthlyGoal(establishmentId)
      .then((r) => { if (!cancelled) setResult(r); })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Crédito do mês anterior. Consultar isso também CONGELA o mês passado
    // automaticamente (o banco cuida disso) — por isso o histórico é lido
    // DEPOIS: assim o mês recém-congelado já aparece na lista.
    fetchMonthlyGoalCredit(establishmentId)
      .catch(() => null)
      .then((c) => {
        if (!cancelled && c) setCredit(c);
        return fetchMonthlyGoalHistory(establishmentId, 6);
      })
      .then((h) => { if (!cancelled && h) setHistory(h.items); })
      .catch(() => { /* crédito e histórico são complementares, nunca bloqueiam */ });

    return () => { cancelled = true; };
  }, [isOpen, establishmentId]);

  if (!isOpen) return null;

  const view = result?.ok ? result.view : null;
  const counts = result?.ok ? result.counts : null;
  // Valor real da mensalidade dele — é o que dá peso ao convite. Sem esse dado,
  // o texto cai para uma versão genérica em vez de inventar número.
  const planCents = view?.planCents ?? 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 sm:p-4">
      <div className="w-full max-w-lg bg-[#141516] border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-white leading-tight">🏆 Meta Mensal</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {view ? view.referenceMonthLabel : 'Carregando...'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando seu progresso...</span>
            </div>
          )}

          {/* Sem MP conectado o convite abaixo já explica tudo — não faz sentido
              empilhar um aviso técnico em cima dele. */}
          {!loading && hasMercadoPago && result && !result.ok && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {result.reason === 'not_available'
                ? 'A Meta Mensal ainda não está disponível na sua conta. Fale com o suporte.'
                : 'Não foi possível carregar seu progresso agora. Tente novamente em alguns instantes.'}
            </div>
          )}

          {/* SEM MERCADO PAGO: mostrar "0%" só desanima, porque ele não tem como
              pontuar. Aqui o modal vira convite — com o dinheiro dele na conta. */}
          {!loading && !hasMercadoPago && (
            <>
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
                <p className="text-sm text-amber-200 font-semibold">Sua mensalidade pode chegar a</p>
                <p className="text-5xl font-black text-emerald-400 leading-none my-2">R$ 0,00</p>
                {planCents > 0 ? (
                  <p className="text-sm text-amber-100/90">
                    Hoje você paga <strong className="text-white">{formatCentsBRL(planCents)}</strong> por mês.
                    Cada cliente que paga <strong className="text-white">online</strong> derruba esse valor.
                  </p>
                ) : (
                  <p className="text-sm text-amber-100/90">
                    Cada cliente que paga <strong className="text-white">online</strong> derruba o valor da sua
                    mensalidade.
                  </p>
                )}
              </div>

              {planCents > 0 && (
                <div className="rounded-2xl border border-gray-700 bg-black/30 p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Quanto você economiza por mês</div>
                  <div className="space-y-1.5">
                    {MONTHLY_GOAL_MILESTONES.map((m) => {
                      const d = computeGoalDiscount(planCents, m.percent);
                      return (
                        <div key={m.percent} className="flex items-start justify-between gap-2 text-sm">
                          <span className="text-gray-300 pt-0.5">
                            <strong className="text-white">{m.payments}</strong> pagamentos online
                          </span>
                          <span className="text-right flex-shrink-0">
                            <strong
                              className={`block ${m.percent === 100 ? 'text-emerald-400' : 'text-emerald-300'}`}
                            >
                              economiza {formatCentsBRL(d.discountCents)}
                            </strong>
                            <span className="block text-[11px] text-gray-400">
                              {m.percent === 100
                                ? 'mensalidade grátis'
                                : `paga ${formatCentsBRL(d.finalCents)}`}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    A contagem zera todo dia 1º. O desconto conquistado vale para a mensalidade seguinte.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                <p className="text-sm font-extrabold text-red-300">⚠️ Só que hoje você não pontua nada</p>
                <p className="text-sm text-red-100/90 mt-1 leading-relaxed">
                  Seu Mercado Pago <strong className="text-white">não está conectado</strong>. Sem isso, seus clientes
                  não conseguem pagar no momento do agendamento — e nenhum pagamento entra na meta. É por isso que seu
                  progresso está em 0%.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-700 bg-black/30 p-4">
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">E não é só a mensalidade</div>
                <div className="space-y-2 text-sm text-gray-300 leading-relaxed">
                  <p>
                    💸 <strong className="text-white">O dinheiro cai direto na sua conta</strong> do Mercado Pago, na
                    hora do agendamento. Não passa por nós.
                  </p>
                  <p>
                    🚫 <strong className="text-white">Cliente que pagou não some.</strong> Quem já deixou o dinheiro
                    dificilmente falta no horário.
                  </p>
                  <p>
                    ⏱️ <strong className="text-white">Chega de cobrar na cadeira.</strong> O cliente já chega pago, você
                    só atende.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConnectMercadoPago?.();
                }}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-black font-extrabold text-base hover:from-emerald-400 hover:to-green-400 transition-colors"
              >
                Conectar meu Mercado Pago
              </button>
              <p className="text-[12px] text-gray-500 text-center leading-relaxed">
                Você conecta a sua própria conta do Mercado Pago. Os recebimentos são seus e vão direto para ela.
              </p>
            </>
          )}

          {/* Crédito já conquistado no mês anterior — o que ele pode usar AGORA */}
          {!loading && hasMercadoPago && credit?.available && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-base font-extrabold text-emerald-300">
                🎁 Você tem {credit.percent}% de desconto guardado
              </p>
              <p className="text-sm text-emerald-100/90 mt-1 leading-relaxed">
                Conquistado em {formatReferenceMonthLabel(credit.referenceMonth)} com {credit.validPayments}{' '}
                pagamentos online. Para usar, abra a tela de pagamento da mensalidade e toque em{' '}
                <strong className="text-white">“Usar meu desconto”</strong> — vale uma única vez, no PIX.
              </p>
            </div>
          )}

          {!loading && hasMercadoPago && view && (
            <>
              <p className="text-sm text-gray-300 leading-relaxed">
                Quanto mais pagamentos <strong className="text-white">online</strong> seus clientes fizerem,
                menor fica a sua próxima mensalidade. O desconto sobe por{' '}
                <strong className="text-white">faixas</strong> — você precisa bater o número cheio de cada uma.
              </p>

              {/* Progresso */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-4xl font-black text-amber-300 leading-none">{view.percent}%</div>
                    <div className="text-xs text-amber-200/90 mt-1">conquistado</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-white">{view.validPayments}</div>
                    <div className="text-xs text-amber-200/90">de {MONTHLY_GOAL_TARGET} pagamentos</div>
                  </div>
                </div>

                <div className="h-3 w-full rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${view.barColor}`}
                    style={{ width: `${view.percent}%` }}
                  />
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] text-center">
                  {MONTHLY_GOAL_MILESTONES.map((m) => {
                    const reached = view.validPayments >= m.payments;
                    return (
                      <div key={m.percent} className={reached ? 'text-emerald-300 font-bold' : 'text-amber-200/70'}>
                        <div>{reached ? '✅' : m.emoji} {m.percent}%</div>
                        <div className="opacity-80">{m.payments}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Valores */}
              {view.planCents > 0 ? (
                <div className="rounded-2xl border border-gray-700 bg-black/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mensalidade atual</span>
                    <span className="font-semibold text-white">{formatCentsBRL(view.planCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Desconto conquistado</span>
                    <span className="font-semibold text-emerald-400">- {formatCentsBRL(view.discountCents)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="font-bold text-white">Próxima mensalidade estimada</span>
                    <span className="font-black text-emerald-400 text-base">{formatCentsBRL(view.finalCents)}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-700 bg-black/30 p-4 text-sm text-gray-400">
                  Seu progresso está sendo contado. O valor estimado da mensalidade aparece assim que o
                  suporte configurar o valor do seu plano.
                </div>
              )}

              {/* Próximo marco */}
              {view.nextMilestone && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
                  Faltam <strong className="text-white">{view.nextMilestone.missing}</strong> pagamento
                  {view.nextMilestone.missing === 1 ? '' : 's'} online para você subir para{' '}
                  <strong className="text-white">{view.nextMilestone.percent}% de desconto</strong>
                  {' '}({view.nextMilestone.label}).
                </div>
              )}
              {!view.nextMilestone && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200 font-bold text-center">
                  🎉 Meta máxima atingida! Sua próxima mensalidade fica gratuita.
                </div>
              )}

              {/* Composição */}
              {counts && counts.validPayments > 0 && (
                <div className="rounded-2xl border border-gray-700 bg-black/30 p-4 text-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Como você chegou aqui</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                    <span>PIX</span><span className="text-right font-semibold text-white">{counts.pixCount}</span>
                    <span>Cartão</span><span className="text-right font-semibold text-white">{counts.creditCount}</span>
                    <span>De agendamentos</span><span className="text-right font-semibold text-white">{counts.appointmentCount}</span>
                    <span>De assinaturas</span><span className="text-right font-semibold text-white">{counts.subscriptionCount}</span>
                  </div>
                </div>
              )}

              {/* Histórico de meses fechados */}
              {history.length > 0 && (
                <div className="rounded-2xl border border-gray-700 bg-black/30 p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-2">Meses anteriores</div>
                  <div className="space-y-1">
                    {history.map((h) => (
                      <div key={h.referenceMonth} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-800 last:border-0">
                        <div className="min-w-0">
                          <div className="text-white font-semibold">{formatReferenceMonthLabel(h.referenceMonth)}</div>
                          <div className="text-[11px] text-gray-500">
                            {h.validPayments} pagamentos · {h.percent}%
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {h.discountCents > 0 ? (
                            <div className="text-emerald-400 font-bold">- {formatCentsBRL(h.discountCents)}</div>
                          ) : (
                            <div className="text-gray-500 text-xs">sem desconto</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regras */}
              <div className="rounded-xl border border-gray-800 bg-black/20 p-3 text-[12px] text-gray-400 leading-relaxed space-y-1">
                <p>Somente pagamentos <strong className="text-gray-300">online aprovados</strong> contam para a meta.</p>
                <p>Pagamentos pendentes, cancelados, estornados ou reembolsados não contam.</p>
                <p>
                  O desconto é por faixa: <strong className="text-gray-300">40 = 25%</strong>,{' '}
                  <strong className="text-gray-300">80 = 50%</strong>,{' '}
                  <strong className="text-gray-300">120 = 75%</strong> e{' '}
                  <strong className="text-gray-300">160 = grátis</strong>. Você mantém a faixa até bater a próxima.
                </p>
                <p>A contagem <strong className="text-gray-300">zera todo dia 1º</strong> — cada mês começa do zero.</p>
                <p>O percentual conquistado ao final do mês vale para a próxima mensalidade.</p>
                <p className="text-gray-500">
                  Valor <strong>estimado</strong> — seu percentual ainda pode subir até o fim do mês.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-gray-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-amber-500 text-black font-extrabold hover:bg-amber-400 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default MonthlyGoalModal;
