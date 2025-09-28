import { useProfessionalPayments } from './useProfessionalPayments';

/**
 * Hook para calcular valor líquido correto considerando pagamentos já feitos
 */
export const useProfessionalLiquidValue = (
  establishmentId: string,
  professionalId: string,
  originalLiquidValue: number,
  selectedMonth?: Date
) => {
  const { getPaymentSummary } = useProfessionalPayments(establishmentId, selectedMonth);

  const paymentSummary = getPaymentSummary(professionalId);

  // Valor líquido atual = Valor original - Total já pago
  const currentLiquidValue = Math.max(0, originalLiquidValue - paymentSummary.totalPaid);

  // Valor pendente para pagamento
  const pendingAmount = currentLiquidValue;

  return {
    currentLiquidValue,
    pendingAmount,
    totalPaid: paymentSummary.totalPaid,
    hasPayments: paymentSummary.paymentCount > 0
  };
};
