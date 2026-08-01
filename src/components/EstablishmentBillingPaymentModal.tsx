import { Copy, CreditCard, Loader2, QrCode, Trophy, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CardPaymentBrick } from './CardPaymentBrick';
import { fetchEstablishmentMonthlyGoal, fetchMonthlyGoalCredit, type MonthlyGoalCredit } from '../lib/monthlyGoal';
import {
  MONTHLY_GOAL_MILESTONES,
  computeGoalDiscount,
  formatCentsBRL,
  formatReferenceMonthLabel,
  type MonthlyGoalView,
} from '../utils/monthlyGoal';

type BillingMethod = 'pix' | 'credit_card' | null;

interface EstablishmentBillingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  establishmentName: string;
  onPaid?: () => Promise<void> | void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');

export const EstablishmentBillingPaymentModal: React.FC<EstablishmentBillingPaymentModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  establishmentName,
  onPaid,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<BillingMethod>('credit_card');
  const [billingAmount, setBillingAmount] = useState<number>(0);
  // 🏆 Meta Mensal — painel motivacional (somente leitura, não altera valor nem cobrança)
  const [goalView, setGoalView] = useState<MonthlyGoalView | null>(null);
  const [isLoadingGoal, setIsLoadingGoal] = useState(false);
  const [showGoalPanel, setShowGoalPanel] = useState(false);
  // 🏆 Crédito de desconto de um mês já fechado. Vale UMA vez e SÓ no PIX —
  // o cartão recorrente não pode ter o valor alterado (ver a função Netlify).
  const [goalCredit, setGoalCredit] = useState<MonthlyGoalCredit | null>(null);
  const [useGoalCredit, setUseGoalCredit] = useState(false);
  const [isLoadingAmount, setIsLoadingAmount] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [pixCode, setPixCode] = useState('');
  const [pixQrBase64, setPixQrBase64] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [configError, setConfigError] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerDocument, setPayerDocument] = useState('');
  const [billingCep, setBillingCep] = useState('');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingNumber, setBillingNumber] = useState('');
  const [billingNeighborhood, setBillingNeighborhood] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const mercadoPagoPublicKey = String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim();

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  const formatCpfCnpj = (value: string) => {
    const digits = onlyDigits(value).slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    }
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMethod('credit_card');
    setPixCode('');
    setPixQrBase64('');
    setPaymentId('');
    setStatusMessage('');
    setConfigError('');
    setBillingAmount(0);
    setShowGoalPanel(false);
    setGoalCredit(null);
    setUseGoalCredit(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !establishmentId) return;

    const loadAuthEmail = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = String(data?.user?.email || '').trim().toLowerCase();
        if (email) setPayerEmail(email);
      } catch (error) {
        console.warn('Falha ao carregar e-mail autenticado:', error);
      }
    };

    const loadAmount = async () => {
      setIsLoadingAmount(true);
      try {
        const { data: est } = await supabase
          .from('establishments')
          .select('mercadopago_billing_amount')
          .eq('id', establishmentId)
          .maybeSingle();
        let v = Number((est as any)?.mercadopago_billing_amount ?? 0);
        if (!Number.isFinite(v) || v <= 0) {
          const { data: admin } = await supabase.from('admin_billing_links').select('mercadopago_billing_amount').eq('id', 'global').maybeSingle();
          v = Number((admin as any)?.mercadopago_billing_amount ?? 0);
        }
        if (Number.isFinite(v) && v > 0) setBillingAmount(v);
      } catch {
        /* RLS pode bloquear admin_billing_links — valor aparece após gerar PIX */
      } finally {
        setIsLoadingAmount(false);
      }
    };

    // 🏆 Meta Mensal: progresso do mês atual, para mostrar ao barbeiro quanto ele
    // economizaria se puxasse mais pagamentos online. Somente leitura.
    const loadMonthlyGoal = async () => {
      setIsLoadingGoal(true);
      try {
        const r = await fetchEstablishmentMonthlyGoal(establishmentId);
        setGoalView(r.ok ? r.view : null);
      } finally {
        setIsLoadingGoal(false);
      }
    };

    // 🏆 Crédito de mês fechado. Só habilita o botão — quem aplica o desconto
    // de fato é o servidor, que busca o percentual direto no banco.
    const loadGoalCredit = async () => {
      try {
        setGoalCredit(await fetchMonthlyGoalCredit(establishmentId));
      } catch {
        setGoalCredit(null);
      }
    };

    void loadAuthEmail();
    void loadAmount();
    void loadMonthlyGoal();
    void loadGoalCredit();
  }, [isOpen, establishmentId]);

  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.touchAction = originalBodyTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !paymentId) return;

    const interval = window.setInterval(async () => {
      setIsRefreshingStatus(true);
      try {
        const { data, error } = await (supabase as any)
          .from('establishment_billing_payments')
          .select('status, paid_at')
          .eq('payment_id', paymentId)
          .eq('establishment_id', establishmentId)
          .maybeSingle();

        if (error) throw error;

        const normalizedStatus = String((data as any)?.status || '').toLowerCase().trim();
        if (normalizedStatus === 'paid') {
          setStatusMessage('Pagamento confirmado! Seu sistema foi regularizado automaticamente.');
          if (onPaid) await onPaid();
          window.clearInterval(interval);
          return;
        }

        if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled' || normalizedStatus === 'refunded') {
          setStatusMessage('O pagamento foi recusado ou cancelado. Tente outro meio ou gere um novo pagamento.');
          window.clearInterval(interval);
          return;
        }
      } catch (error) {
        console.warn('Falha ao atualizar status da cobrança:', error);
      } finally {
        setIsRefreshingStatus(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isOpen, paymentId, establishmentId, onPaid]);

  const handleGeneratePix = async () => {
    setIsGenerating(true);
    setStatusMessage('');
    setConfigError('');
    try {
      const endpoint = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-establishment-billing'
        : '/api/mercadopago/create-establishment-billing';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          description: `Regularizacao Agendei Facil - ${establishmentName}`,
          payer: {
            email: `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`,
          },
          // Apenas sinaliza a intenção. O percentual é resolvido no servidor,
          // direto no banco — nada de valor vindo do navegador.
          ...(useGoalCredit && goalCredit?.available ? { use_monthly_goal_credit: true } : {}),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = String(payload?.userMessage || payload?.error || `Erro ${response.status}`);
        setConfigError(message);
        throw new Error(message);
      }

      // 🏆 100% de desconto: o Mercado Pago não aceita cobrança de R$ 0,00.
      // O crédito NÃO foi gasto — o suporte libera manualmente.
      if ((payload as any)?.monthly_goal_free_month === true) {
        setStatusMessage(String((payload as any)?.userMessage || 'Sua mensalidade deste mês é gratuita. Chame o suporte.'));
        return;
      }

      const trx = (payload as any)?.point_of_interaction?.transaction_data || {};
      const qrCode = String(trx?.qr_code || '').trim();
      const qrBase64Raw = String(trx?.qr_code_base64 || '').trim();
      if (!qrCode && !qrBase64Raw) {
        throw new Error('Nao foi possível gerar QR Code PIX.');
      }

      setPixCode(qrCode);
      setPixQrBase64(qrBase64Raw ? `data:image/png;base64,${qrBase64Raw}` : '');
      setPaymentId(String((payload as any)?.id || ''));
      const amountUsed = Number((payload as any)?.amount_brl_used ?? 0);
      if (Number.isFinite(amountUsed) && amountUsed > 0) {
        setBillingAmount(amountUsed);
      }
      if ((payload as any)?.monthly_goal_credit_applied === true) {
        const pct = Number((payload as any)?.monthly_goal_percent || 0);
        const saved = Number((payload as any)?.monthly_goal_discount_cents || 0);
        // O crédito foi consumido — some o botão para não sugerir usar de novo.
        setGoalCredit(null);
        setUseGoalCredit(false);
        setStatusMessage(
          `🏆 Desconto de ${pct}% aplicado! Você economizou ${formatCentsBRL(saved)}. Após o pagamento, o sistema regulariza automaticamente.`
        );
      } else {
        setStatusMessage('PIX gerado! Após o pagamento, o sistema regulariza automaticamente.');
      }
    } catch (error: any) {
      console.error('Erro ao gerar PIX de regularização:', error);
      setStatusMessage(String(error?.message || 'Erro ao gerar PIX.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRecurringSubscription = async () => {
    setIsCreatingSubscription(true);
    setStatusMessage('');
    setConfigError('');
    try {
      const endpoint = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-establishment-billing-subscription'
        : '/api/mercadopago/create-establishment-billing-subscription';
      const currentUrl =
        typeof window !== 'undefined' && /^https:\/\//i.test(window.location.href)
          ? window.location.href
          : '';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          description: `Assinatura mensal Agendei Facil - ${establishmentName}`,
          backUrl: currentUrl || undefined,
          payer: {
            email: payerEmail || `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String((payload as any)?.userMessage || (payload as any)?.error || `Erro ${response.status}`);
        setConfigError(message);
        throw new Error(message);
      }

      const initPoint = String((payload as any)?.init_point || (payload as any)?.sandbox_init_point || '').trim();
      if (!initPoint) {
        throw new Error('Mercado Pago não retornou o link da assinatura.');
      }

      const amountUsed = Number((payload as any)?.amount_brl_used ?? 0);
      if (Number.isFinite(amountUsed) && amountUsed > 0) setBillingAmount(amountUsed);
      setPaymentId(String((payload as any)?.preapproval_id || ''));
      setStatusMessage('Abrindo Mercado Pago para ativar a assinatura mensal automática.');
      window.location.href = initPoint;
    } catch (error: any) {
      setStatusMessage(String(error?.message || 'Erro ao criar assinatura recorrente.'));
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const handleCreditCardSubmit = async (cardData: {
    token: string;
    payment_method_id: string;
    issuer_id: string;
    installments: number;
  }) => {
    const documentDigits = onlyDigits(payerDocument);
    if (!isValidEmail(payerEmail)) {
      setConfigError('Preencha um e-mail válido para pagar no cartão.');
      return;
    }
    if (documentDigits.length !== 11 && documentDigits.length !== 14) {
      setConfigError('Preencha CPF ou CNPJ válido do titular.');
      return;
    }
    if (!onlyDigits(billingCep) || !billingStreet.trim() || !billingNumber.trim() || !billingCity.trim() || billingState.trim().length < 2) {
      setConfigError('Preencha o endereço de cobrança para reduzir recusa do cartão.');
      return;
    }

    setIsCreatingSubscription(true);
    setStatusMessage('');
    setConfigError('');
    try {
      const endpoint = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-establishment-billing'
        : '/api/mercadopago/create-establishment-billing';
      const nameParts = String(establishmentName || 'Cliente Agendei').split(/\s+/).filter(Boolean);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          description: `Regularizacao Agendei Facil - ${establishmentName}`,
          token: cardData.token,
          payment_method_id: cardData.payment_method_id,
          issuer_id: cardData.issuer_id,
          installments: cardData.installments,
          create_recurring_subscription: true,
          backUrl: typeof window !== 'undefined' && /^https:\/\//i.test(window.location.href) ? window.location.href : undefined,
          payer: {
            email: payerEmail,
            first_name: nameParts[0] || 'Cliente',
            last_name: nameParts.slice(1).join(' ') || 'Agendei Facil',
            identification: {
              type: documentDigits.length === 14 ? 'CNPJ' : 'CPF',
              number: documentDigits,
            },
            address: {
              zip_code: onlyDigits(billingCep),
              street_name: billingStreet.trim(),
              street_number: Number(onlyDigits(billingNumber)) || 0,
              neighborhood: billingNeighborhood.trim() || 'Centro',
              city: billingCity.trim(),
              federal_unit: billingState.trim().slice(0, 2).toUpperCase(),
            },
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String((payload as any)?.userMessage || (payload as any)?.error || `Erro ${response.status}`);
        setConfigError(message);
        throw new Error(message);
      }

      const status = String((payload as any)?.status || '').toLowerCase();
      setPaymentId(String((payload as any)?.id || ''));
      if (status === 'approved' || status === 'authorized') {
        setStatusMessage(
          (payload as any)?.recurrence_created
            ? 'Mensalidade paga e recorrência criada para os próximos meses.'
            : 'Mensalidade paga. Não foi possível criar a recorrência automática; você poderá tentar novamente depois.'
        );
        if (onPaid) await onPaid();
      } else {
        setStatusMessage('Pagamento enviado. Estamos aguardando confirmação do Mercado Pago.');
      }
    } catch (error: any) {
      setStatusMessage(String(error?.message || 'Erro ao pagar no cartão.'));
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const handleCopyPix = async () => {
    try {
      if (!pixCode) return;
      await navigator.clipboard.writeText(pixCode);
      setStatusMessage('Código PIX copiado.');
    } catch (error) {
      console.error('Erro ao copiar código PIX:', error);
      setStatusMessage('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  };

  // 🏆 Prévia do desconto do crédito. É só para EXIBIR — o valor real é
  // recalculado no servidor a partir do percentual gravado no banco.
  const billingCents = Math.round(Math.max(0, billingAmount) * 100);
  const creditPreview =
    goalCredit?.available && billingCents > 0
      ? computeGoalDiscount(billingCents, goalCredit.percent)
      : null;
  // Só vale no PIX: se o barbeiro voltar para cartão, o desconto some da tela
  // — assim o valor exibido nunca promete o que a cobrança não vai fazer.
  const isCreditActive = Boolean(useGoalCredit && creditPreview && selectedMethod === 'pix');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[12000] p-3 sm:p-4 overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-[#151618] border border-gray-700 rounded-xl w-full max-w-md text-white max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3 className="font-bold text-base sm:text-lg">Regularizar pagamento do sistema</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          <div className="rounded-lg border border-gray-700 bg-[#1c1d20] p-3">
            <p className="text-sm text-gray-300">
              Estabelecimento: <span className="text-white font-semibold">{establishmentName}</span>
            </p>
            <p className="text-sm text-gray-300 mt-1">
              Valor cobrança MP:{' '}
              {isCreditActive && creditPreview ? (
                <>
                  <span className="text-gray-500 line-through mr-1.5">{formatBRL(billingAmount)}</span>
                  <span className="text-emerald-300 font-bold">{formatCentsBRL(creditPreview.finalCents)}</span>
                </>
              ) : (
                <span className="text-emerald-300 font-bold">
                  {billingAmount > 0 ? formatBRL(billingAmount) : isLoadingAmount ? '…' : 'Definido no Admin'}
                </span>
              )}
            </p>

            {/* 🏆 Crédito conquistado num mês já fechado. Vale UMA vez e SÓ no PIX:
                a assinatura no cartão tem valor fixo no Mercado Pago e não pode
                ser alterada. Por isso clicar já troca o método para PIX. */}
            {creditPreview && !pixCode && (
              isCreditActive ? (
                <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5">
                  <p className="text-sm font-bold text-emerald-300">
                    ✅ Desconto de {goalCredit?.percent}% aplicado — você economiza{' '}
                    {formatCentsBRL(creditPreview.discountCents)}
                  </p>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Conquistado em {formatReferenceMonthLabel(goalCredit?.referenceMonth || '')} · vale uma única vez.
                    O desconto só é gasto quando o PIX for pago.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUseGoalCredit(false)}
                    className="mt-1.5 text-[11px] text-gray-400 underline hover:text-gray-200"
                  >
                    Remover desconto
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setUseGoalCredit(true);
                    setSelectedMethod('pix');
                  }}
                  className="mt-2 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-2.5 text-sm font-extrabold text-black hover:from-emerald-400 hover:to-green-400 transition-colors"
                >
                  🏆 Usar meu desconto de {goalCredit?.percent}% — pagar{' '}
                  {formatCentsBRL(creditPreview.finalCents)}
                </button>
              )
            )}

            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Pagamento da <span className="text-gray-200 font-semibold">mensalidade do Agendei Fácil</span> pelo seu
              estabelecimento.
            </p>
          </div>

          {/* 🏆 META MENSAL — botão sempre visível. Sem desconto disponível, ele
              mostra quanto o barbeiro DEIXOU de economizar e o que falta. Somente
              leitura: não altera valor, não cria nem modifica cobrança. */}
          {!isLoadingGoal && goalView && (
            <div className="rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGoalPanel((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-amber-500/10 transition-colors"
              >
                <Trophy className="h-5 w-5 text-amber-300 flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold text-amber-200">
                    {goalView.percent > 0 ? `Você tem ${goalView.percent}% de desconto` : 'Quer pagar menos no mês que vem?'}
                  </span>
                  <span className="block text-[11px] text-amber-100/80">
                    {goalView.validPayments} pagamento{goalView.validPayments === 1 ? '' : 's'} online neste mês · toque para ver
                  </span>
                </span>
                <span className="text-amber-300 text-lg flex-shrink-0">{showGoalPanel ? '▲' : '▼'}</span>
              </button>

              {showGoalPanel && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-amber-500/25">
                  {goalView.percent > 0 ? (
                    <p className="text-sm text-amber-100 leading-relaxed">
                      Você já garantiu <strong className="text-white">{goalView.percent}% de desconto</strong> com{' '}
                      {goalView.validPayments} pagamentos online neste mês. Ao fechar o mês, esse desconto fica
                      disponível para você usar numa próxima mensalidade.
                    </p>
                  ) : (
                    <p className="text-sm text-amber-100 leading-relaxed">
                      Neste mês você teve <strong className="text-white">{goalView.validPayments} pagamento
                      {goalView.validPayments === 1 ? '' : 's'} online</strong>. Ainda não deu para desbloquear
                      desconto — mas dá tempo de virar o jogo.
                    </p>
                  )}

                  {goalView.nextMilestone && billingAmount > 0 && (
                    <div className="rounded-lg bg-black/30 border border-amber-500/25 p-2.5">
                      <p className="text-sm text-white font-bold">
                        Faltam {goalView.nextMilestone.missing} pagamento
                        {goalView.nextMilestone.missing === 1 ? '' : 's'} para {goalView.nextMilestone.percent}% de desconto
                      </p>
                      <p className="text-[12px] text-amber-100/90 mt-0.5">
                        Sua mensalidade cairia de {formatBRL(billingAmount)} para{' '}
                        <strong className="text-emerald-300">
                          {formatCentsBRL(
                            computeGoalDiscount(Math.round(billingAmount * 100), goalView.nextMilestone.percent).finalCents
                          )}
                        </strong>
                        {' '}— economia de{' '}
                        {formatCentsBRL(
                          computeGoalDiscount(Math.round(billingAmount * 100), goalView.nextMilestone.percent).discountCents
                        )}.
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] text-amber-100/75 leading-relaxed">
                    <p className="font-bold text-amber-200 mb-0.5">Como funciona:</p>
                    {MONTHLY_GOAL_MILESTONES.map((m) => (
                      <span key={m.percent} className="inline-block mr-3">
                        {goalView.validPayments >= m.payments ? '✅' : '•'} {m.payments} = {m.percent}%
                        {m.percent === 100 ? ' (grátis)' : ''}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-amber-100/75 leading-relaxed">
                    💡 Peça para seus clientes pagarem <strong className="text-white">online</strong> na hora de agendar.
                    Cada pagamento conta, e a contagem zera todo dia 1º.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('pix')}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedMethod === 'pix'
                ? 'border-emerald-400 bg-emerald-500/20'
                : 'border-gray-700 bg-[#1c1d20] hover:border-gray-500'
                }`}
            >
              <p className="font-semibold">PIX</p>
              <p className="text-xs text-gray-300 mt-1">Pague quando gerar o código</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('credit_card')}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedMethod === 'credit_card'
                ? 'border-blue-400 bg-blue-500/20'
                : 'border-gray-700 bg-[#1c1d20] hover:border-gray-500'
                }`}
            >
              <p className="font-semibold">Cartão de crédito</p>
              <p className="text-xs text-gray-300 mt-1">Assinatura mensal automática</p>
            </button>
          </div>

          {selectedMethod === 'pix' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGeneratePix}
                disabled={isGenerating || isLoadingAmount}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {isGenerating ? 'Gerando PIX...' : 'Gerar PIX'}
              </button>

              {pixQrBase64 ? (
                <div className="flex justify-center">
                  <img src={pixQrBase64} alt="QR Code PIX" className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg bg-white p-2" />
                </div>
              ) : null}

              {pixCode ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-300 text-center">PIX copia e cola</p>
                  <textarea
                    value={pixCode}
                    readOnly
                    rows={4}
                    className="w-full rounded-lg bg-[#0f1012] border border-gray-700 text-xs text-gray-100 p-3 resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="w-full border border-gray-600 hover:border-gray-400 rounded-lg py-2 font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar codigo PIX
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {selectedMethod === 'credit_card' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
                <div className="inline-flex items-start gap-2">
                  <CreditCard className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    O cartão cobra a <strong>mensalidade atual agora</strong>. Depois da aprovação, o sistema tenta criar
                    a recorrência automática para os próximos meses.
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-[#1c1d20] p-2 space-y-2 text-xs text-gray-200">
                <label className="block text-[11px] text-gray-400 mb-1">E-mail do titular</label>
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(String(e.target.value || '').trim().toLowerCase())}
                  placeholder="email@exemplo.com"
                  className="w-full rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                />
                <label className="block text-[11px] text-gray-400 mb-1">CPF ou CNPJ do titular</label>
                <input
                  value={payerDocument}
                  onChange={(e) => setPayerDocument(formatCpfCnpj(e.target.value))}
                  placeholder="CPF ou CNPJ"
                  inputMode="numeric"
                  className="w-full rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={billingCep}
                    onChange={(e) => setBillingCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="CEP"
                    inputMode="numeric"
                    className="rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                  />
                  <input
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="UF"
                    maxLength={2}
                    className="rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                  />
                </div>
                <input
                  value={billingStreet}
                  onChange={(e) => setBillingStreet(e.target.value)}
                  placeholder="Rua"
                  className="w-full rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={billingNumber}
                    onChange={(e) => setBillingNumber(e.target.value)}
                    placeholder="Número"
                    inputMode="numeric"
                    className="rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                  />
                  <input
                    value={billingNeighborhood}
                    onChange={(e) => setBillingNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className="rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                  />
                </div>
                <input
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  placeholder="Cidade"
                  className="w-full rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>

              {!isValidEmail(payerEmail) ? (
                <p className="text-xs text-amber-200/90 rounded border border-amber-500/30 bg-amber-500/10 p-2">
                  Preencha um e-mail válido para pagar no cartão.
                </p>
              ) : mercadoPagoPublicKey ? (
                <div className="rounded-lg border border-gray-700 bg-[#111213] p-2">
                  {isCreatingSubscription ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-blue-100">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processando cartão...
                    </div>
                  ) : (
                    <CardPaymentBrick
                      publicKey={mercadoPagoPublicKey}
                      amount={billingAmount || 1}
                      creditOnly
                      payerData={{
                        email: payerEmail,
                        identificationType: onlyDigits(payerDocument).length === 14 ? 'CNPJ' : 'CPF',
                        identificationNumber: onlyDigits(payerDocument),
                        firstName: String(establishmentName || 'Cliente').trim().split(/\s+/)[0] || 'Cliente',
                        lastName: String(establishmentName || '').trim().split(/\s+/).slice(1).join(' ') || 'Agendei Facil',
                      }}
                      onSubmit={handleCreditCardSubmit}
                      onError={(error: any) => {
                        const msg = String(error?.message || '').trim();
                        if (msg) setStatusMessage(msg);
                      }}
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-red-200 rounded border border-red-500/30 bg-red-500/10 p-2">
                  Configure VITE_MERCADOPAGO_PUBLIC_KEY para pagar cartão no dashboard.
                </p>
              )}

              <p className="text-[11px] text-gray-400 leading-relaxed">
                Se o cartão for recusado, o sistema não regulariza. Ele só marca como em dia quando o Mercado Pago
                confirmar pagamento aprovado.
              </p>
            </div>
          )}

          {(configError || statusMessage) && (
            <div
              className={`rounded-lg border p-3 text-sm ${configError
                ? 'border-red-500/40 bg-red-500/10 text-red-100'
                : statusMessage.toLowerCase().includes('confirmado')
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : 'border-gray-600 bg-[#1c1d20] text-gray-200'
                }`}
            >
              {configError || statusMessage}
            </div>
          )}

          {paymentId && (
            <p className="text-xs text-gray-400 text-center">
              Pagamento em verificação automática {isRefreshingStatus ? '(atualizando...)' : ''}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
