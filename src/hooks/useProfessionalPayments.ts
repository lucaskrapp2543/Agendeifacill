import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isServicePaymentSource, isSubscriptionPaymentSource } from '../lib/professionalPaymentSources';

interface ProfessionalPayment {
  id: string;
  establishment_id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  payment_date: string;
  created_at: string;
  /** Mês a que o pagamento se refere (YYYY-MM). Null = considerar pela payment_date. */
  for_month?: string | null;
}

interface PaymentSummary {
  totalPaid: number;
  lastPaymentDate: string | null;
  paymentCount: number;
}

/**
 * Hook para gerenciar pagamentos de profissionais
 */
export type ProfessionalPaymentSourceFilter = 'normal' | 'subscription' | 'all';

export const useProfessionalPayments = (
  establishmentId: string,
  selectedMonth?: Date,
  paymentSource: ProfessionalPaymentSourceFilter = 'normal'
) => {
  const [payments, setPayments] = useState<ProfessionalPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar pagamentos do estabelecimento
  const fetchPayments = async () => {
    if (!establishmentId) return;

    setLoading(true);
    setError(null);

    try {
      const query = supabase
        .from('professional_payments')
        .select('*')
        .eq('establishment_id', establishmentId);

      // Não filtrar por data aqui quando há selectedMonth: vamos filtrar por for_month + fallback por payment_date
      let { data, error } = await query.order('payment_date', { ascending: false });

      // Fallback: bancos antigos sem coluna payment_source
      if (error) {
        const msg = String((error as any)?.message || '');
        if (msg.includes('payment_source') && msg.includes('does not exist')) {
          const { data: legacyData, error: legacyError } = await supabase
            .from('professional_payments')
            .select('*')
            .eq('establishment_id', establishmentId)
            .order('payment_date', { ascending: false });
          if (legacyError) throw legacyError;
          data = legacyData;
          error = null as any;
        } else {
          throw error;
        }
      }

      let list = data || [];
      // Filtragem por origem feita em memória para manter compatibilidade entre bancos
      // com valores antigos/diferentes em payment_source.
      if (paymentSource !== 'all') {
        list = list.filter((p: ProfessionalPayment & { payment_source?: string | null }) => {
          const src = (p as any)?.payment_source;
          if (paymentSource === 'subscription') return isSubscriptionPaymentSource(src);
          // 'normal' = SERVIÇO. Produto tem acerto próprio e não pode abater serviço.
          return isServicePaymentSource(src);
        });
      }
      // Quando há mês selecionado: considerar pagamentos "deste mês" por for_month ou por payment_date (compat)
      if (selectedMonth) {
        const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
        const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getTime();
        const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59).getTime();
        list = list.filter((p: ProfessionalPayment) => {
          if (p.for_month != null && p.for_month !== '') return p.for_month === monthKey;
          const t = new Date(p.payment_date).getTime();
          return t >= startOfMonth && t <= endOfMonth;
        });
      }
      setPayments(list);
    } catch (err: any) {
      console.error('❌ Erro ao buscar pagamentos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Registrar pagamento. forMonth = mês a que o pagamento se refere (YYYY-MM); quando na aba de um mês, deve ser passado.
  const recordPayment = async (
    professionalId: string,
    professionalName: string,
    amount: number,
    forMonth?: string,
    paymentDate?: Date
  ) => {
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        establishment_id: establishmentId,
        professional_id: professionalId,
        professional_name: professionalName,
        amount: amount,
        payment_date: (paymentDate ?? new Date()).toISOString(),
        payment_source: 'normal'
      };
      if (forMonth) payload.for_month = forMonth;

      let { data, error } = await supabase
        .from('professional_payments')
        .insert(payload)
        .select()
        .single();

      // Compatibilidade com bancos antigos sem colunas novas.
      if (error) {
        const msg = String((error as any)?.message || '').toLowerCase();
        const missingPaymentSource = msg.includes('payment_source') && msg.includes('does not exist');
        const missingForMonth = msg.includes('for_month') && msg.includes('does not exist');
        if (missingPaymentSource || missingForMonth) {
          const fallbackPayload = { ...payload };
          if (missingPaymentSource) delete (fallbackPayload as any).payment_source;
          if (missingForMonth) delete (fallbackPayload as any).for_month;
          const retry = await supabase
            .from('professional_payments')
            .insert(fallbackPayload)
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) throw error;

      // Atualizar lista local
      setPayments(prev => [data, ...prev]);

      return data;
    } catch (err: any) {
      console.error('❌ Erro ao registrar pagamento:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Obter resumo de pagamentos por profissional
  const getPaymentSummary = (professionalId: string): PaymentSummary => {
    const professionalPayments = payments.filter(p => p.professional_id === professionalId);

    // Separar pagamentos positivos (pagamentos) e negativos (retiradas)
    const positivePayments = professionalPayments.filter(p => p.amount > 0);
    const negativePayments = professionalPayments.filter(p => p.amount < 0);

    // Total pago = soma dos pagamentos positivos
    const totalPaid = positivePayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Total retirado = soma dos valores negativos (convertidos para positivo)
    const totalWithdrawn = Math.abs(negativePayments.reduce((sum, payment) => sum + payment.amount, 0));

    const lastPayment = professionalPayments[0]; // Já ordenado por data decrescente
    const paymentCount = professionalPayments.length;

    return {
      totalPaid,
      lastPaymentDate: lastPayment?.payment_date || null,
      paymentCount
    };
  };

  // Obter pagamentos de um profissional específico
  const getProfessionalPayments = (professionalId: string): ProfessionalPayment[] => {
    return payments.filter(p => p.professional_id === professionalId);
  };

  // Deletar pagamento
  const deletePayment = async (paymentId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('professional_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      // Atualizar lista local removendo o pagamento deletado
      setPayments(prev => prev.filter(p => p.id !== paymentId));

      return true;
    } catch (err: any) {
      console.error('❌ Erro ao deletar pagamento:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Calcular valor líquido pendente (considerando pagamentos já feitos)
  const calculatePendingAmount = (
    professionalId: string,
    currentLiquidValue: number
  ): number => {
    const summary = getPaymentSummary(professionalId);
    const pendingAmount = currentLiquidValue - summary.totalPaid;
    return Math.max(0, pendingAmount); // Não pode ser negativo
  };

  // ⚠️ Mesmo problema do ProfessionalPaymentControl (corrigido em 27/08/2026):
  // `selectedMonth` é um Date recriado a cada render pelo componente pai. Depender do
  // OBJETO fazia este efeito rodar sem parar (buscar → setState → render → buscar...),
  // multiplicado pela quantidade de profissionais na tela. Dependemos do VALOR (ano-mês):
  // recarrega sempre que o mês muda de verdade, e para de repetir à toa.
  const selectedMonthKey = selectedMonth
    ? `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`
    : '';

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, selectedMonthKey]);

  return {
    payments,
    loading,
    error,
    recordPayment,
    deletePayment,
    getPaymentSummary,
    getProfessionalPayments,
    calculatePendingAmount,
    refreshPayments: fetchPayments
  };
};
