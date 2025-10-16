import { useProfessionalPayments } from './useProfessionalPayments';

/**
 * Hook para calcular valor líquido correto considerando pagamentos já feitos e retiradas
 */
export const useProfessionalLiquidValue = (
  establishmentId: string,
  professionalId: string,
  originalLiquidValue: number,
  selectedMonth?: Date
) => {
  const { getPaymentSummary, getProfessionalPayments } = useProfessionalPayments(establishmentId, selectedMonth);

  const paymentSummary = getPaymentSummary(professionalId);
  const allPayments = getProfessionalPayments(professionalId);

  // Calcular total de retiradas (valores negativos)
  const totalWithdrawn = allPayments
    .filter(p => p.amount < 0)
    .reduce((sum, payment) => sum + Math.abs(payment.amount), 0);

  // Valor líquido atual = Valor original - Total já pago - Total retirado
  const currentLiquidValue = Math.max(0, originalLiquidValue - paymentSummary.totalPaid - totalWithdrawn);

  // Valor pendente para pagamento
  const pendingAmount = currentLiquidValue;

  console.log('💰 Cálculo valor líquido para', professionalId, ':', {
    originalLiquidValue,
    totalPaid: paymentSummary.totalPaid,
    totalWithdrawn,
    currentLiquidValue,
    pendingAmount
  });

  return {
    currentLiquidValue,
    pendingAmount,
    totalPaid: paymentSummary.totalPaid,
    totalWithdrawn,
    hasPayments: paymentSummary.paymentCount > 0
  };
};
