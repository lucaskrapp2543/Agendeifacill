import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ProfessionalPayment {
  id: string;
  establishment_id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  payment_date: string;
  created_at: string;
}

interface PaymentSummary {
  totalPaid: number;
  lastPaymentDate: string | null;
  paymentCount: number;
}

/**
 * Hook para gerenciar pagamentos de profissionais
 */
export const useProfessionalPayments = (establishmentId: string, selectedMonth?: Date) => {
  const [payments, setPayments] = useState<ProfessionalPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar pagamentos do estabelecimento
  const fetchPayments = async () => {
    if (!establishmentId) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('professional_payments')
        .select('*')
        .eq('establishment_id', establishmentId);

      // Se um mês específico foi selecionado, filtrar por esse mês
      if (selectedMonth) {
        const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);

        query = query
          .gte('payment_date', startOfMonth.toISOString())
          .lte('payment_date', endOfMonth.toISOString());
      }

      const { data, error } = await query.order('payment_date', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
      console.log('💰 Pagamentos carregados para o mês:', selectedMonth?.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) || 'todos', ':', data?.length || 0);
    } catch (err: any) {
      console.error('❌ Erro ao buscar pagamentos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Registrar pagamento
  const recordPayment = async (
    professionalId: string,
    professionalName: string,
    amount: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('professional_payments')
        .insert({
          establishment_id: establishmentId,
          professional_id: professionalId,
          professional_name: professionalName,
          amount: amount,
          payment_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista local
      setPayments(prev => [data, ...prev]);
      console.log('✅ Pagamento registrado:', data);

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

    const totalPaid = professionalPayments.reduce((sum, payment) => sum + payment.amount, 0);
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

  // Calcular valor líquido pendente (considerando pagamentos já feitos)
  const calculatePendingAmount = (
    professionalId: string,
    currentLiquidValue: number
  ): number => {
    const summary = getPaymentSummary(professionalId);
    const pendingAmount = currentLiquidValue - summary.totalPaid;
    return Math.max(0, pendingAmount); // Não pode ser negativo
  };

  useEffect(() => {
    fetchPayments();
  }, [establishmentId, selectedMonth]);

  return {
    payments,
    loading,
    error,
    recordPayment,
    getPaymentSummary,
    getProfessionalPayments,
    calculatePendingAmount,
    refreshPayments: fetchPayments
  };
};
