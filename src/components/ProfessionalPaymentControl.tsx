import { Check, EyeOff, History, Minus, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useProfessionalLiquidValue } from '../hooks/useProfessionalLiquidValue';
import { useProfessionalPayments } from '../hooks/useProfessionalPayments';
import { supabase } from '../lib/supabase';
import { resolveSubscriberAttendanceProfessionalGroup } from '../lib/subscriberSystem';
import { buildProfessionalControlGroups, loadProfessionalControlSnapshot } from '../lib/professionalSubscriberControl';
import { PRODUCT_PAYOUT_START_DATE } from '../lib/professionalPaymentSources';

interface ProfessionalPaymentControlProps {
  establishmentId: string;
  professionalId: string;
  professionalName: string;
  currentLiquidValue: number;
  newSalesValue?: number;
  validatedPaidAmount?: number;
  validatedPendingAmount?: number;
  cardTaxLoss?: number;
  ignoredPaymentIds?: string[];
  selectedMonth?: Date;
  onPaymentRecorded?: () => void;
  readOnly?: boolean;
  /** Dono (100%) não acumula repasse de assinatura — pula o cálculo/pagamento de assinatura. */
  isOwnerProfessional?: boolean;
  /**
   * Comissão de PRODUTO ainda não paga a este profissional no mês.
   * Vem pronta do pai (nenhuma consulta a mais aqui) e já considera a data de corte:
   * vendas antigas continuam sendo acertadas por fora.
   */
  productPending?: number;
  /** Quanto de produto JÁ foi pago a ele neste mês (registros com origem 'product'). */
  productPaidThisMonth?: number;
}

export const ProfessionalPaymentControl: React.FC<ProfessionalPaymentControlProps> = ({
  establishmentId,
  professionalId,
  professionalName,
  currentLiquidValue,
  newSalesValue,
  validatedPaidAmount,
  validatedPendingAmount,
  cardTaxLoss,
  ignoredPaymentIds: _ignoredPaymentIds = [],
  selectedMonth,
  onPaymentRecorded,
  readOnly = false,
  isOwnerProfessional = false,
  productPending: productPendingProp = 0,
  productPaidThisMonth: productPaidThisMonthProp = 0,
}) => {
  // Só entra na conta se realmente sobrou produto a pagar (nunca negativo).
  const productPending = Math.max(0, Number(productPendingProp) || 0);
  const productPaidThisMonth = Math.max(0, Number(productPaidThisMonthProp) || 0);
  const {
    loading,
    recordPayment,
    deletePayment,
    getProfessionalPayments,
    refreshPayments
  } = useProfessionalPayments(establishmentId, selectedMonth, 'normal');

  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false); // trava síncrona: evita pagamento duplicado em clique duplo rápido
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [datePicker, setDatePicker] = useState<{ amount: number; isCustom: boolean; date: string } | null>(null);

  const _now = new Date();
  const isCurrentMonth = selectedMonth
    ? selectedMonth.getFullYear() === _now.getFullYear() && selectedMonth.getMonth() === _now.getMonth()
    : true;
  const _pad = (n: number) => String(n).padStart(2, '0');
  const _pickerYear = selectedMonth ? selectedMonth.getFullYear() : _now.getFullYear();
  const _pickerMonth = selectedMonth ? selectedMonth.getMonth() : _now.getMonth();
  const _pickerLastDay = new Date(_pickerYear, _pickerMonth + 1, 0).getDate();
  const _pickerMinDate = `${_pickerYear}-${_pad(_pickerMonth + 1)}-01`;
  const _pickerMaxDate = `${_pickerYear}-${_pad(_pickerMonth + 1)}-${_pad(_pickerLastDay)}`;

  // Estados para o botão "PEGAR VALOR"
  const [showTakeValueModal, setShowTakeValueModal] = useState(false);
  const [takeValueAmount, setTakeValueAmount] = useState('');
  const [takeValueReason, setTakeValueReason] = useState('');

  // Assinatura pendente do mês (mesma conta de "Meus Assinantes" / agenda) — pago junto no PAGAR.
  const [subscriptionAccumulated, setSubscriptionAccumulated] = useState(0);
  const [subscriptionPaid, setSubscriptionPaid] = useState(0);
  const subscriptionPending = Math.max(0, subscriptionAccumulated - subscriptionPaid);

  // Usar hook para calcular valor líquido correto
  const {
    totalPaid,
    totalWithdrawn,
    refreshLiquidValue
  } = useProfessionalLiquidValue(establishmentId, professionalId, currentLiquidValue, selectedMonth);

  // O valor original (total do mês) é o currentLiquidValue passado como prop
  const totalLiquidValue = currentLiquidValue; // Valor total do mês
  // Regra oficial do financeiro:
  // quando existe validação do pai, ela é a fonte de verdade (anti-adiantamento).
  const totalPaidEffective =
    typeof validatedPaidAmount === 'number' ? Math.max(0, validatedPaidAmount) : totalPaid;
  // Retirada ("pegar valor") também reduz o saldo do profissional.
  const settledAgainstProfessional = Math.max(0, totalPaidEffective + Math.max(0, totalWithdrawn));
  const currentLiquidDisplay = Math.max(0, totalLiquidValue - settledAgainstProfessional);
  const overpaidAmount = Math.max(0, settledAgainstProfessional - totalLiquidValue);
  // Pendente = o que falta para fechar o mês (líquido - já pago), respeitando trava contra adiantamentos.
  const pendingByLiquid = Math.max(0, totalLiquidValue - settledAgainstProfessional);
  const pendingByValidatedRule =
    typeof validatedPendingAmount === 'number' ? Math.max(0, validatedPendingAmount) : pendingByLiquid;
  // Regra operacional: pagar apenas o que ficou pendente após o último pagamento válido.
  const pendingToPay = Math.max(0, Math.min(pendingByLiquid, pendingByValidatedRule));
  // Tudo que o botão PAGAR quita de uma vez: serviços + assinatura + produtos.
  const totalPendingAll = pendingToPay + subscriptionPending + productPending;
  const payLabelParts = [
    pendingToPay > 0 ? 'serviços' : null,
    subscriptionPending > 0 ? 'assinatura' : null,
    productPending > 0 ? 'produtos' : null,
  ].filter(Boolean) as string[];
  const payLabelSuffix = payLabelParts.length > 1 ? ` (${payLabelParts.join(' + ')})` : '';
  const operationalNewSales =
    typeof newSalesValue === 'number' ? Math.max(0, newSalesValue) : null;
  const pendingFromPriorServices = operationalNewSales === null
    ? null
    : Math.max(0, pendingToPay - operationalNewSales);
  const reconciledLiquidValue =
    typeof validatedPendingAmount === 'number'
      ? Math.max(0, totalPaidEffective + pendingToPay)
      : totalLiquidValue;

  // A caixa mostra a conta aberta ("produziu − pago − retirado = falta") só quando
  // ela REALMENTE fecha. A trava anti-adiantamento (pendingToPay usa o menor entre
  // dois critérios) pode deixar sobra em casos de borda — e exibir uma conta que não
  // bate é pior que não exibir. Nesse caso cai no resumo simples, sem inventar número.
  const breakdownDiff =
    (totalLiquidValue - totalPaidEffective - Math.max(0, totalWithdrawn)) - pendingToPay;

  // ADIANTAMENTO: quanto do dinheiro que saiu do caixa NÃO tem serviço válido por trás.
  // Nasce quando um atendimento é pago ao profissional e DEPOIS é desfeito (volta para
  // pendente, vira "cliente faltou" ou é cancelado): o dinheiro já está com ele, mas o
  // serviço sumiu da conta. O sistema abatia isso do acerto seguinte em silêncio — foi
  // o que fez um profissional aparecer com R$ 556,83 a receber quando havia produzido
  // R$ 1.100 no período, sem nada na tela explicando o porquê.
  const advancedAmount = Math.max(0, totalPaid - totalPaidEffective);
  const breakdownFecha = Math.abs(breakdownDiff) < 0.02;

  // ===== Financeiro de ASSINATURA deste profissional no mês =====
  // Usa a MESMA engine de "Meus Assinantes" (loadProfessionalControlSnapshot + buildProfessionalControlGroups),
  // que já mescla subscriber_attendances com agendamentos de assinatura CONCLUÍDOS. Assim o valor bate
  // exatamente com Meus Assinantes (não a fonte incompleta do subscriber_attendances cru).
  const loadSubscriptionFinancial = async () => {
    const estId = String(establishmentId || '').trim();
    const proId = String(professionalId || '').trim();
    if (isOwnerProfessional || !estId || !proId) {
      setSubscriptionAccumulated(0);
      setSubscriptionPaid(0);
      return;
    }
    try {
      const ref = selectedMonth || new Date();
      const snapshot = await loadProfessionalControlSnapshot({ establishmentId: estId, month: ref.getMonth(), year: ref.getFullYear() });
      const groups = buildProfessionalControlGroups({
        subscriberAttendances: snapshot.subscriberAttendances,
        subscriptionSaleCommissions: snapshot.subscriptionSaleCommissions,
        establishmentProfessionals: snapshot.establishmentProfessionals,
        deletedProfessionals: snapshot.deletedProfessionals,
        clientSubscriptions: snapshot.clientSubscriptions,
        subscriptions: snapshot.subscriptions,
      });
      const groupKey = `id:${proId}`;
      const group = groups.find((g: any) => g.groupKey === groupKey);
      if (!group) {
        setSubscriptionAccumulated(0);
        setSubscriptionPaid(0);
        return;
      }
      const accumulated = Number(group.attendanceTotalValue ?? group.totalValue ?? 0);

      // Pagamentos de assinatura deste grupo no mês (mesma lógica de Meus Assinantes ~5605-5623)
      const monthKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
      const monthStartT = new Date(ref.getFullYear(), ref.getMonth(), 1).getTime();
      const monthEndT = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const paid = (snapshot.professionalPayments || [])
        .filter((p: any) => {
          if (String(p?.payment_source || '') !== 'subscription') return false;
          const pg = resolveSubscriberAttendanceProfessionalGroup(
            { professional_id: p.professional_id, professional_name: p.professional_name },
            snapshot.establishmentProfessionals,
            snapshot.deletedProfessionals
          );
          if (pg.groupKey !== groupKey) return false;
          const fm = String(p?.for_month || '').trim();
          if (fm) return fm === monthKey;
          const t = new Date(p.payment_date).getTime();
          return t >= monthStartT && t <= monthEndT;
        })
        .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0);

      setSubscriptionAccumulated(Math.max(0, accumulated));
      setSubscriptionPaid(Math.max(0, paid));
    } catch (error) {
      console.error('Erro ao carregar assinatura pendente (controle de pagamento):', error);
      setSubscriptionAccumulated(0);
      setSubscriptionPaid(0);
    }
  };

  // ⚠️ LOOP INFINITO — corrigido em 27/08/2026. NÃO voltar a depender de `selectedMonth`.
  //
  // `selectedMonth` é um OBJETO Date criado a cada render pelo pai
  // (resolveProfessionalRevenueReferenceMonth em EstablishmentDashboard). Para o React,
  // objeto novo = dependência mudou — então este efeito rodava a cada render, buscava,
  // atualizava estado, renderizava de novo, e recomeçava. Como este card aparece uma vez
  // POR PROFISSIONAL, o efeito era multiplicado.
  //
  // Medido em produção: ~159 requisições/s no painel (picos de 800/s) com a tela parada.
  // Era a causa do "sistema travando/pesado", dos ~16 MILHÕES de requisições/mês no
  // Netlify e do 429 do Supabase.
  //
  // A correção compara o VALOR (ano-mês) em vez da identidade do objeto: a consulta
  // continua idêntica e roda sempre que o mês realmente muda — só não repete à toa.
  const selectedMonthKey = selectedMonth
    ? `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`
    : '';

  useEffect(() => {
    void loadSubscriptionFinancial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, professionalId, professionalName, selectedMonthKey, isOwnerProfessional]);

  // Registra o pagamento da assinatura (source: subscription) — MESMO registro que "Meus Assinantes" cria,
  // então lá reconhece como pago automaticamente. Isolado do pagamento normal (source: normal).
  const paySubscriptionPending = async (paymentDate?: Date): Promise<boolean> => {
    if (isOwnerProfessional || subscriptionPending <= 0) return true;
    const ref = selectedMonth || new Date();
    const monthKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const isCurrentMonthSel = ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth();
    const dateForRecord = paymentDate ?? (isCurrentMonthSel ? now : new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12, 0, 0, 0));
    const basePayload: any = {
      establishment_id: establishmentId,
      professional_id: professionalId,
      professional_name: professionalName,
      amount: subscriptionPending,
      payment_date: dateForRecord.toISOString(),
      payment_source: 'subscription',
      for_month: monthKey,
    };
    let { error } = await supabase.from('professional_payments').insert(basePayload);
    if (error && String(error.message || '').toLowerCase().includes('for_month')) {
      const legacy = { ...basePayload };
      delete legacy.for_month;
      ({ error } = await supabase.from('professional_payments').insert(legacy));
    }
    if (error) {
      console.error('Erro ao registrar pagamento de assinatura:', error);
      toast.error('Pagamento normal ok, mas houve erro ao registrar a parte da assinatura.');
      return false;
    }
    await loadSubscriptionFinancial();
    return true;
  };

  // Registra o pagamento da comissão de PRODUTO (source: 'product').
  // Fica separado do pagamento de serviço para que nenhuma tela some as duas coisas:
  // se este registro entrasse como 'normal', o "falta pagar" dos serviços cairia sozinho
  // e o profissional receberia a menos.
  const payProductPending = async (paymentDate?: Date): Promise<boolean> => {
    if (productPending <= 0) return true;
    const ref = selectedMonth || new Date();
    const monthKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const isCurrentMonthSel = ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth();
    const dateForRecord = paymentDate ?? (isCurrentMonthSel ? now : new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12, 0, 0, 0));
    const basePayload: any = {
      establishment_id: establishmentId,
      professional_id: professionalId,
      professional_name: professionalName,
      amount: productPending,
      payment_date: dateForRecord.toISOString(),
      payment_source: 'product',
      for_month: monthKey,
    };
    let { error } = await supabase.from('professional_payments').insert(basePayload);
    if (error && String(error.message || '').toLowerCase().includes('for_month')) {
      const legacy = { ...basePayload };
      delete legacy.for_month;
      ({ error } = await supabase.from('professional_payments').insert(legacy));
    }
    if (error) {
      // Sem fallback removendo payment_source de propósito: um registro de produto sem
      // origem seria lido como serviço e bagunçaria o acerto. Melhor não gravar e avisar.
      console.error('Erro ao registrar pagamento de produto:', error);
      toast.error('Pagamento dos serviços ok, mas houve erro ao registrar a parte dos produtos.');
      return false;
    }
    return true;
  };

  // Histórico precisa ser transparente: mostra todos os pagamentos registrados,
  // mesmo quando algum lançamento foi desconsiderado pela regra anti-adiantamento.
  const professionalPayments = getProfessionalPayments(professionalId);
  const visiblePaymentCount = professionalPayments.length;
  const visibleLastPaymentDate = professionalPayments.length > 0
    ? professionalPayments
      .slice()
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0]?.payment_date || null
    : null;

  const forMonthKey = selectedMonth
    ? `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
    : undefined;

  // Salva espelho no localStorage para o modal do profissional ler
  useEffect(() => {
    if (!professionalId || !forMonthKey) return;
    try {
      localStorage.setItem(
        `prof_financial_mirror:${professionalId}:${forMonthKey}`,
        JSON.stringify({ validPaid: totalPaidEffective, pending: pendingToPay, month: forMonthKey })
      );
    } catch { /* ignore */ }
  }, [professionalId, forMonthKey, totalPaidEffective, pendingToPay]);

  const handlePayFullAmount = async (paymentDate?: Date) => {
    if (pendingToPay <= 0 && subscriptionPending <= 0 && productPending <= 0) {
      toast.error('Não há valor pendente para pagar');
      return;
    }

    if (isProcessingRef.current || isProcessing) {
      toast.error('Processando pagamento... Aguarde!');
      return;
    }

    if (!isCurrentMonth && !paymentDate) {
      setDatePicker({ amount: totalPendingAll, isCustom: false, date: _pickerMaxDate });
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      // Pagamento normal (serviços) — source 'normal', via hook, como sempre.
      if (pendingToPay > 0) {
        await recordPayment(professionalId, professionalName, pendingToPay, forMonthKey, paymentDate);
        await Promise.all([refreshPayments(), refreshLiquidValue()]);
      }
      // Pagamento da assinatura junto — source 'subscription', reflete em Meus Assinantes.
      const subscriptionPaidNow = subscriptionPending;
      if (subscriptionPending > 0) {
        await paySubscriptionPending(paymentDate);
      }
      // Comissão de produto junto — source 'product', registro separado do serviço.
      const productPaidNow = productPending;
      if (productPending > 0) {
        await payProductPending(paymentDate);
      }
      const totalPaidNow = pendingToPay + subscriptionPaidNow + productPaidNow;
      const partes = [
        pendingToPay > 0 ? 'serviços' : null,
        subscriptionPaidNow > 0 ? 'assinatura' : null,
        productPaidNow > 0 ? 'produtos' : null,
      ].filter(Boolean);
      toast.success(
        partes.length > 1
          ? `Pago ${formatCurrency(totalPaidNow)} para ${professionalName} (${partes.join(' + ')})`
          : `Pagamento de ${formatCurrency(totalPaidNow)} registrado para ${professionalName}`
      );
      onPaymentRecorded?.();
      setShowPaymentOptions(false);
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento: ' + error.message);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handlePayCustomAmount = async (paymentDate?: Date) => {
    const amount = parseFloat(customAmount.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    if (amount > pendingToPay) {
      toast.error(`Valor não pode ser maior que ${formatCurrency(pendingToPay)}`);
      return;
    }

    if (amount > totalLiquidValue && totalLiquidValue > 0) {
      const monthLabel = forMonthKey
        ? new Date(forMonthKey + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : 'mês selecionado';
      const confirmed = window.confirm(
        `⚠️ ATENÇÃO: Você está pagando ${formatCurrency(amount)}, mas o líquido apurado de ${monthLabel} é apenas ${formatCurrency(totalLiquidValue)}.\n\nO excesso de ${formatCurrency(amount - totalLiquidValue)} vai cobrir automaticamente novos atendimentos que forem concluídos neste mês.\n\nTem certeza que deseja continuar?`
      );
      if (!confirmed) return;
    }

    if (!isCurrentMonth && !paymentDate) {
      setDatePicker({ amount, isCustom: true, date: _pickerMaxDate });
      return;
    }

    if (isProcessingRef.current || isProcessing) {
      toast.error('Processando pagamento... Aguarde!');
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      await recordPayment(professionalId, professionalName, amount, forMonthKey, paymentDate);
      await Promise.all([refreshPayments(), refreshLiquidValue()]);
      toast.success(`Pagamento de ${formatCurrency(amount)} registrado para ${professionalName}`);
      onPaymentRecorded?.();
      setCustomAmount('');
      setShowCustomInput(false);
      setShowPaymentOptions(false);
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento: ' + error.message);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handlePaymentClick = () => {
    if (pendingToPay <= 0 && subscriptionPending <= 0 && productPending <= 0) {
      toast.error('Não há valor pendente para pagar');
      return;
    }
    setShowPaymentOptions(true);
  };

  const handleTakeValueClick = () => {
    if (currentLiquidDisplay <= 0) {
      toast.error('Não há valor disponível para retirar');
      return;
    }
    setShowTakeValueModal(true);
  };

  const handleTakeValue = async () => {
    const amount = parseFloat(takeValueAmount.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    if (amount > currentLiquidDisplay) {
      toast.error(
        `Ele produziu ${formatCurrency(totalLiquidValue)} e já saiu ${formatCurrency(totalPaidEffective + Math.max(0, totalWithdrawn))}. ` +
        `Só é possível retirar até ${formatCurrency(currentLiquidDisplay)}.`
      );
      return;
    }

    if (!takeValueReason.trim()) {
      toast.error('Digite o motivo da retirada');
      return;
    }

    // Confirmação com a conta na frente: depois desta retirada, quanto do que o
    // profissional produziu já terá saído do caixa. Sem isso, dá para esvaziar o
    // saldo dele sem perceber e o acerto seguinte vem "estranhamente baixo" —
    // exatamente a confusão que gerou toda a investigação do financeiro.
    {
      const jaSaiu = totalPaidEffective + Math.max(0, totalWithdrawn);
      const saiUTotal = jaSaiu + amount;
      const sobra = Math.max(0, totalLiquidValue - saiUTotal);
      const okRetirar = window.confirm(
        `Confirmar retirada de ${formatCurrency(amount)} de ${professionalName}?\n\n` +
        `Ele produziu no período: ${formatCurrency(totalLiquidValue)}\n` +
        `Já saiu do caixa: ${formatCurrency(jaSaiu)}\n` +
        `Com esta retirada sai: ${formatCurrency(saiUTotal)}\n\n` +
        `Vai sobrar ${formatCurrency(sobra)} para ele receber no acerto.`
      );
      if (!okRetirar) return;
    }

    if (isProcessingRef.current || isProcessing) {
      toast.error('Processando... Aguarde!');
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      // Registrar como "pagamento negativo" para o profissional
      // Isso vai diminuir o valor líquido dele e aumentar o caixa do estabelecimento
      const retiradaPayload: Record<string, unknown> = {
        establishment_id: establishmentId,
        professional_id: professionalId,
        professional_name: professionalName,
        amount: -amount,
        payment_date: new Date().toISOString(),
        payment_source: 'normal'
      };
      if (forMonthKey) retiradaPayload.for_month = forMonthKey;
      let { error } = await supabase
        .from('professional_payments')
        .insert(retiradaPayload)
        .select()
        .single();

      if (error) {
        const msg = String((error as any)?.message || '').toLowerCase();
        const missingPaymentSource = msg.includes('payment_source') && msg.includes('does not exist');
        const missingForMonth = msg.includes('for_month') && msg.includes('does not exist');
        if (missingPaymentSource || missingForMonth) {
          const fallbackPayload = { ...retiradaPayload };
          if (missingPaymentSource) delete (fallbackPayload as any).payment_source;
          if (missingForMonth) delete (fallbackPayload as any).for_month;
          const retry = await supabase
            .from('professional_payments')
            .insert(fallbackPayload)
            .select()
            .single();
          error = retry.error;
        }
      }

      if (error) {
        console.error('Erro ao registrar retirada:', error);
        throw error;
      }

      toast.success(`Valor de ${formatCurrency(amount)} retirado de ${professionalName} e adicionado ao caixa`);
      setTakeValueAmount('');
      setTakeValueReason('');
      setShowTakeValueModal(false);
      await Promise.all([refreshPayments(), refreshLiquidValue()]);
      onPaymentRecorded?.();
    } catch (error: any) {
      console.error('Erro ao retirar valor:', error);
      toast.error('Erro ao retirar valor: ' + error.message);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeletePayment = async (paymentId: string, paymentAmount: number) => {
    // Calcular o valor total pago atual
    const currentTotalPaid = totalPaidEffective;

    // Calcular o valor que ficaria após deletar este pagamento
    const newTotalPaid = currentTotalPaid - paymentAmount;

    // Verificar se há pagamentos duplicados (mesmo valor)
    const duplicatePayments = professionalPayments.filter(
      p => Math.abs(p.amount - paymentAmount) < 0.01 && p.id !== paymentId
    );
    const hasDuplicate = duplicatePayments.length > 0;

    // Validar: não pode deixar o valor acumulado negativo
    // EXCETO se houver pagamento duplicado (para corrigir erro)
    if (currentTotalPaid > currentLiquidValue) {
      const maxAllowedToDelete = currentTotalPaid - currentLiquidValue;

      if (paymentAmount > maxAllowedToDelete) {
        // Se há pagamento duplicado, permitir deletar com confirmação especial
        if (hasDuplicate) {
          const excessAmount = paymentAmount - maxAllowedToDelete;
          const confirmMessage =
            `⚠️ ATENÇÃO: Este pagamento parece ser uma duplicação!\n\n` +
            `Você está tentando deletar um pagamento de ${formatCurrency(paymentAmount)}.\n` +
            `Isso deixaria o valor acumulado negativo em ${formatCurrency(excessAmount)}.\n\n` +
            `Valor líquido: ${formatCurrency(currentLiquidValue)}\n` +
            `Total pago atual: ${formatCurrency(currentTotalPaid)}\n` +
            `Total pago após deletar: ${formatCurrency(newTotalPaid)}\n\n` +
            `Há ${duplicatePayments.length} outro(s) pagamento(s) com o mesmo valor.\n\n` +
            `Deseja mesmo deletar este pagamento duplicado?`;

          if (!window.confirm(confirmMessage)) {
            return;
          }
          // Continuar com a deleção mesmo deixando negativo (é para corrigir erro)
        } else {
          // Não há duplicação, bloquear normalmente
          const excessAmount = paymentAmount - maxAllowedToDelete;
          toast.error(
            `Não é possível deletar este pagamento de ${formatCurrency(paymentAmount)}. ` +
            `Isso deixaria o valor acumulado negativo em ${formatCurrency(excessAmount)}. ` +
            `Você só pode deletar até ${formatCurrency(maxAllowedToDelete)} para manter o valor correto. ` +
            `(Valor líquido: ${formatCurrency(currentLiquidValue)}, Total pago: ${formatCurrency(currentTotalPaid)})`
          );
          return;
        }
      }
    }

    // Confirmar antes de deletar (caso normal)
    if (!hasDuplicate) {
      if (!window.confirm(
        `Tem certeza que deseja deletar este pagamento de ${formatCurrency(paymentAmount)}?\n\n` +
        `Valor total pago atual: ${formatCurrency(currentTotalPaid)}\n` +
        `Valor total pago após deletar: ${formatCurrency(newTotalPaid)}`
      )) {
        return;
      }
    }

    if (isProcessing) {
      toast.error('Processando... Aguarde!');
      return;
    }

    setIsProcessing(true);

    try {
      await deletePayment(paymentId);
      await Promise.all([refreshPayments(), refreshLiquidValue()]);
      toast.success(`Pagamento de ${formatCurrency(paymentAmount)} deletado com sucesso!`);
      onPaymentRecorded?.();
    } catch (error: any) {
      console.error('Erro ao deletar pagamento:', error);
      toast.error('Erro ao deletar pagamento: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Controles de Pagamento - Layout Mobile Responsivo */}
      <div className="bg-[#0b0e13] border border-gray-700 rounded-lg p-3 space-y-3">
        {/* Informações Financeiras */}
        <div className="space-y-2">
          {/* ── RESUMO EM FORMA DE CONTA ────────────────────────────────────────
              Antes esta caixa tinha "Líquido", "Líquido do mês (total)", "Saldo" e
              "Pendente do mês (total)": quatro números com nomes técnicos, dois deles
              chamados "líquido" com valores diferentes, e a retirada não aparecia em
              lugar nenhum. Dava reclamação de "financeiro errado" quando estava certo.
              Agora é uma subtração na ordem em que a pessoa pensa. Nenhum cálculo mudou:
              todos os valores são os mesmos de antes, só reorganizados e renomeados. */}
          <div className="rounded-xl border border-gray-700 bg-[#0f141c] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
                {pendingToPay > 0.009 ? 'Falta pagar para ele' : 'Nada a pagar'}
              </span>
              <span className={`text-2xl font-extrabold ${pendingToPay > 0.009 ? 'text-cyan-300' : 'text-emerald-300'}`}>
                {formatCurrency(pendingToPay)}
              </span>
            </div>

            {breakdownFecha && totalLiquidValue > 0.009 && (
              <div className="mt-2 border-t border-gray-700 pt-2 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  De onde vem esse valor
                </div>
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-gray-300">Ele produziu no mês</span>
                  <span className="font-semibold text-gray-100">{formatCurrency(totalLiquidValue)}</span>
                </div>
                {totalPaidEffective > 0.009 && (
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-gray-300">Você já pagou</span>
                    <span className="font-semibold text-emerald-300">− {formatCurrency(totalPaidEffective)}</span>
                  </div>
                )}
                {totalWithdrawn > 0.009 && (
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-gray-300">Ele já retirou (pegar valor)</span>
                    <span className="font-semibold text-orange-300">− {formatCurrency(totalWithdrawn)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-gray-700 pt-1 text-[12px]">
                  <span className="font-bold text-gray-200">Falta pagar</span>
                  <span className="font-extrabold text-cyan-300">{formatCurrency(pendingToPay)}</span>
                </div>

                {/* Fica FORA da subtração de propósito: este valor já está embutido no
                    "Você já pagou" (que mostra só a parte com serviço por trás). Se
                    entrasse como mais uma linha de "−", a conta na tela não fecharia e
                    voltaria a confundir. Aqui é só o aviso do que saiu a mais do caixa. */}
                {/* Texto propositalmente NEUTRO quanto à causa: este valor é só a
                    diferença entre o que saiu do caixa e o que tinha serviço concluído
                    por trás no momento. Pode vir de pagamento adiantado OU de
                    atendimento desfeito depois de pago — a tela não tem como saber qual
                    foi, e afirmar a causa errada confunde mais do que ajuda. */}
                {advancedAmount > 0.009 && (
                  <div className="mt-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1">
                    <div className="text-[11px] text-amber-200">
                      Saiu {formatCurrency(advancedAmount)} a mais do caixa do que havia de serviço
                      concluído na hora do pagamento. Esse valor já está descontado acima e sai do
                      próximo acerto. Veja o Histórico para conferir.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sem a conta aberta (caso de borda), pelo menos mostra o total do mês
                para a pessoa não ficar só com um número solto na tela. */}
            {!breakdownFecha && totalLiquidValue > 0.009 && (
              <div className="mt-2 border-t border-gray-700 pt-2 text-[11px] text-gray-400">
                Ele produziu {formatCurrency(totalLiquidValue)} no mês
                {totalPaidEffective > 0.009 && <> • já pago {formatCurrency(totalPaidEffective)}</>}
                {totalWithdrawn > 0.009 && <> • já retirou {formatCurrency(totalWithdrawn)}</>}
              </div>
            )}
          </div>

          {subscriptionPending > 0 && (
            <div className="text-sm text-amber-300 font-medium">
              👑 Falta pagar das assinaturas: {formatCurrency(subscriptionPending)}
            </div>
          )}
          {productPending > 0 && (
            <div className="text-sm text-purple-300 font-medium">
              📦 Falta pagar dos produtos: {formatCurrency(productPending)}
            </div>
          )}
          {/* Pagamento de produto é gravado com origem própria e por isso NÃO aparece no
              histórico de serviços. Sem esta linha o dinheiro sairia do caixa sem deixar
              rastro na tela — foi assim que valores "sumidos" viraram dúvida antes. */}
          {productPaidThisMonth > 0 && (
            <div className="text-[11px] text-purple-300/70">
              📦 Produtos já pagos neste mês: {formatCurrency(productPaidThisMonth)}
            </div>
          )}
          {typeof cardTaxLoss === 'number' && cardTaxLoss > 0.009 && pendingToPay > 0 && (
            <div className="mt-1 rounded-lg border border-gray-700 bg-[#0b0e13] px-3 py-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-red-300">
                <span>– Taxa de cartão (parte dele)</span>
                <span className="font-semibold">– {formatCurrency(cardTaxLoss)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-gray-700 pt-1">
                <span className="text-gray-200 font-semibold">Total líquido a receber</span>
                <span className="text-emerald-300 font-bold">{formatCurrency(Math.max(0, pendingToPay - cardTaxLoss))}</span>
              </div>
            </div>
          )}
          {/* Detalhes operacionais: úteis em casos específicos, mas secundários —
              ficam discretos para não competir com a conta principal. A legenda
              "Pago = total válido no mês • Total = líquido apurado..." saiu: ninguém
              entendia, e a conta acima já responde a mesma pergunta. */}
          {(operationalNewSales !== null ||
            (pendingFromPriorServices !== null && pendingFromPriorServices > 0.009)) && (
            <div className="space-y-0.5 px-1">
              {operationalNewSales !== null && (
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-gray-500">Entrou depois do último acerto</span>
                  <span className="text-gray-400">{formatCurrency(operationalNewSales)}</span>
                </div>
              )}
              {pendingFromPriorServices !== null && pendingFromPriorServices > 0.009 && (
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-gray-500">Sobrou de acertos anteriores</span>
                  <span className="text-amber-400">{formatCurrency(pendingFromPriorServices)}</span>
                </div>
              )}
            </div>
          )}

          {/* O que o PROFISSIONAL vê no aparelho dele — mesmos números, para o barbeiro
              conferir junto com ele na hora do acerto e não haver discussão. */}
          {typeof validatedPaidAmount === 'number' && typeof validatedPendingAmount === 'number' && (
            <div className="mt-2 border-t border-gray-700 pt-2 space-y-0.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                O que o profissional vê
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-gray-400">Já recebeu</span>
                <span className="font-semibold text-gray-200">{formatCurrency(totalPaidEffective)}</span>
              </div>
              {/* Ele também precisa enxergar o que pegou adiantado — sem isso vê só o
                  pendente menor e acha que está sendo lesado. */}
              {totalWithdrawn > 0.009 && (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-gray-400">Já retirou</span>
                  <span className="font-semibold text-orange-300">− {formatCurrency(totalWithdrawn)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-gray-400">Ainda vai receber</span>
                <span className="font-semibold text-cyan-300">{formatCurrency(pendingToPay)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Botões - Layout Mobile */}
        {!readOnly && <div className="flex flex-col sm:flex-row gap-2">
          {/* Botão PAGAR */}
          {(pendingToPay > 0 || subscriptionPending > 0 || productPending > 0) && !showPaymentOptions && (
            <button
              type="button"
              onClick={handlePaymentClick}
              disabled={isProcessing || loading}
              className="w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title={`Pagar ${formatCurrency(totalPendingAll)} para ${professionalName}${payLabelSuffix}`}
            >
              <Check className="w-4 h-4" />
              <span>PAGAR</span>
            </button>
          )}

          {/* Botão PEGAR VALOR */}
          {currentLiquidDisplay > 0 && !showTakeValueModal && (
            <button
              type="button"
              onClick={handleTakeValueClick}
              disabled={isProcessing || loading}
              className="w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title={`Retirar valor de ${professionalName} para o caixa`}
            >
              <Minus className="w-4 h-4" />
              <span>PEGAR VALOR</span>
            </button>
          )}

          {/* Mensagem quando não há valor pendente */}
          {pendingToPay <= 0 && !isProcessing && (
            <div
              className={`w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 text-sm rounded ${overpaidAmount > 0 ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'bg-gray-800/80 text-gray-200 border border-gray-700'
                }`}
              title={
                overpaidAmount > 0
                  ? `Pago a mais: ${formatCurrency(overpaidAmount)} (ver Histórico para corrigir)`
                  : 'Sem pendências de pagamento'
              }
            >
              <Check className="w-4 h-4" />
              <span>{overpaidAmount > 0 ? `Pago a mais: ${formatCurrency(overpaidAmount)}` : 'Em dia'}</span>
            </div>
          )}

          {/* Botão Histórico */}
          {professionalPayments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
            </button>
          )}
        </div>}
      </div>

      {/* Opções de Pagamento */}
      {!readOnly && showPaymentOptions && (pendingToPay > 0 || subscriptionPending > 0 || productPending > 0) && (
        <div className="bg-[#121722] border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-blue-300">
              Opções de Pagamento - {professionalName}
            </h4>
            <button
              type="button"
              onClick={() => setShowPaymentOptions(false)}
              className="text-blue-300 hover:text-blue-200"
            >
              ✕
            </button>
          </div>

          {/* Detalhe do que será pago (serviços + assinatura + produtos) */}
          {(subscriptionPending > 0 || productPending > 0) && (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1 text-xs">
              {pendingToPay > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Serviços (normal)</span>
                  <span className="font-semibold text-emerald-300">{formatCurrency(pendingToPay)}</span>
                </div>
              )}
              {subscriptionPending > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-amber-200">👑 Assinatura do mês</span>
                  <span className="font-semibold text-amber-300">{formatCurrency(subscriptionPending)}</span>
                </div>
              )}
              {productPending > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-purple-200">📦 Produtos vendidos</span>
                  <span className="font-semibold text-purple-300">{formatCurrency(productPending)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-amber-500/20 pt-1">
                <span className="text-gray-200 font-semibold">Total</span>
                <span className="font-bold text-white">{formatCurrency(totalPendingAll)}</span>
              </div>
              {subscriptionPending > 0 && (
                <p className="text-[10px] text-amber-200/70 pt-0.5">Pagar aqui também quita a assinatura em "Meus Assinantes".</p>
              )}
              {productPending > 0 && (
                <p className="text-[10px] text-purple-200/70 pt-0.5">
                  Só entram vendas a partir de {new Date(PRODUCT_PAYOUT_START_DATE + 'T12:00:00').toLocaleDateString('pt-BR')} — o que é anterior continua sendo acertado por fora.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {/* Pagar Todo (serviços + assinatura) */}
            <button
              type="button"
              onClick={() => handlePayFullAmount()}
              disabled={isProcessing}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>
                {subscriptionPending > 0 || productPending > 0
                  ? `Pagar Tudo (${formatCurrency(totalPendingAll)})`
                  : `Pagar Pendente (${formatCurrency(pendingToPay)})`}
              </span>
            </button>

            {/* Pagar Valor Específico */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
              >
                <span>Pagar Valor Específico</span>
              </button>

              {showCustomInput && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Máximo: ${formatCurrency(pendingToPay)}`}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg text-sm text-gray-100 bg-[#0b0e13] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handlePayCustomAmount()}
                      disabled={isProcessing || !customAmount}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Processando...' : 'Confirmar Pagamento'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAmount('');
                        setShowCustomInput(false);
                      }}
                      className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Pagamentos */}
      {showHistory && professionalPayments.length > 0 && (
        <div className="bg-[#121722] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-200">
              Histórico de Pagamentos - {professionalName}
              {selectedMonth && (
                <span className="text-xs text-gray-400 ml-2">
                  ({selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})
                </span>
              )}
            </h4>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {professionalPayments.map((payment) => {
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between bg-[#0b0e13] border border-gray-700 rounded-lg p-2 hover:bg-[#101622] transition-colors"
                >
                <div className="flex-1">
                  <div className={`text-sm font-medium ${payment.amount > 0 ? 'text-gray-100' : 'text-orange-300'}`}>
                    {payment.amount > 0 ? formatCurrency(payment.amount) : formatCurrency(Math.abs(payment.amount))}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(payment.payment_date)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-xs font-medium ${payment.amount > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {payment.amount > 0 ? '✓ Pago' : '↩ Retirado'}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(payment.id, payment.amount)}
                      disabled={isProcessing}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Deletar este pagamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Resumo */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Total Pago:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(totalPaidEffective)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Pagamentos:</span>
              <span className="font-medium text-gray-100">
                {visiblePaymentCount}
              </span>
            </div>
            {visibleLastPaymentDate && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Último Pagamento:</span>
                <span className="font-medium text-gray-100">
                  {formatDate(visibleLastPaymentDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status quando não há pagamentos */}
      {!showHistory && professionalPayments.length === 0 && (
        <div className="text-xs text-gray-400 text-center py-2">
          {selectedMonth ?
            `Nenhum pagamento registrado em ${selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` :
            'Nenhum pagamento registrado ainda'
          }
        </div>
      )}

      {/* Modal PEGAR VALOR */}
      {!readOnly && showTakeValueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Retirar Valor - {professionalName}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTakeValueModal(false);
                  setTakeValueAmount('');
                  setTakeValueReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-900 leading-relaxed">
                  Ao confirmar esta operação, o valor informado será retirado do saldo líquido deste colaborador e
                  transferido para o caixa da barbearia.
                </p>
              </div>

              {/* Conta aberta, não só o "disponível" solto.
                  Caso real: retiraram R$ 430,00 e, 23 segundos depois, pagaram o acerto
                  cheio de R$ 637,10 — R$ 1.067,10 saindo do caixa para quem tinha
                  produzido R$ 517,51 até ali. A tela mostrava só "valor disponível",
                  sem deixar claro quanto o profissional realmente tinha gerado. */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ele produziu no período</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(totalLiquidValue)}</span>
                </div>
                {totalPaidEffective > 0.009 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Já recebeu</span>
                    <span className="font-semibold text-emerald-700">− {formatCurrency(totalPaidEffective)}</span>
                  </div>
                )}
                {totalWithdrawn > 0.009 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Já retirou</span>
                    <span className="font-semibold text-orange-700">− {formatCurrency(totalWithdrawn)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-200 pt-1 text-sm">
                  <span className="font-bold text-gray-800">Pode retirar até</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(currentLiquidDisplay)}</span>
                </div>
              </div>

              {/* Valor a retirar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor a retirar
                </label>
                <input
                  type="text"
                  value={takeValueAmount}
                  onChange={(e) => setTakeValueAmount(e.target.value)}
                  placeholder={`Máximo: ${formatCurrency(currentLiquidDisplay)}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Motivo da retirada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo da retirada
                </label>
                <input
                  type="text"
                  value={takeValueReason}
                  onChange={(e) => setTakeValueReason(e.target.value)}
                  placeholder="Ex: Quebrou equipamento, adiantamento, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Botões */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleTakeValue}
                  disabled={isProcessing || !takeValueAmount || !takeValueReason.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processando...' : 'Confirmar Retirada'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTakeValueModal(false);
                    setTakeValueAmount('');
                    setTakeValueReason('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: escolha de data para pagamento de mês passado */}
      {datePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Data do pagamento</h3>
            <p className="text-xs text-gray-400 mb-4">
              Escolha uma data dentro do mês{' '}
              <span className="text-white font-medium">
                {selectedMonth?.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>{' '}
              para registrar o pagamento de{' '}
              <span className="text-white font-medium">{professionalName}</span>.
            </p>
            <input
              type="date"
              min={_pickerMinDate}
              max={_pickerMaxDate}
              value={datePicker.date}
              onChange={(e) => setDatePicker(prev => prev ? { ...prev, date: e.target.value } : null)}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 text-white px-3 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDatePicker(null)}
                className="flex-1 rounded-xl border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-semibold py-2.5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const { date, isCustom } = datePicker;
                  if (!date || date < _pickerMinDate || date > _pickerMaxDate) {
                    toast.error(`Escolha uma data entre ${_pickerMinDate} e ${_pickerMaxDate}`);
                    return;
                  }
                  setDatePicker(null);
                  const [y, m, d] = date.split('-').map(Number);
                  const chosen = new Date(y, m - 1, d, 12, 0, 0);
                  if (isCustom) handlePayCustomAmount(chosen);
                  else handlePayFullAmount(chosen);
                }}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};