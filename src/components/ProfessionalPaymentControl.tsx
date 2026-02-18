import { Check, EyeOff, History, Minus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useProfessionalLiquidValue } from '../hooks/useProfessionalLiquidValue';
import { useProfessionalPayments } from '../hooks/useProfessionalPayments';
import { supabase } from '../lib/supabase';

interface ProfessionalPaymentControlProps {
  establishmentId: string;
  professionalId: string;
  professionalName: string;
  currentLiquidValue: number;
  // Quando informado, passa a considerar este valor como "pendente para pagar"
  // (ex.: novas vendas desde o último pagamento), mesmo que o acumulado do mês tenha ficado "pago a mais".
  newSalesValue?: number;
  validatedPaidAmount?: number;
  validatedPendingAmount?: number;
  ignoredAdvanceAmount?: number;
  ignoredPaymentIds?: string[];
  selectedMonth?: Date;
  onPaymentRecorded?: () => void;
}

export const ProfessionalPaymentControl: React.FC<ProfessionalPaymentControlProps> = ({
  establishmentId,
  professionalId,
  professionalName,
  currentLiquidValue,
  newSalesValue,
  validatedPaidAmount,
  validatedPendingAmount,
  ignoredAdvanceAmount = 0,
  ignoredPaymentIds = [],
  selectedMonth,
  onPaymentRecorded
}) => {
  const {
    loading,
    recordPayment,
    deletePayment,
    getPaymentSummary,
    getProfessionalPayments
  } = useProfessionalPayments(establishmentId, selectedMonth, 'normal');

  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Estados para o botão "PEGAR VALOR"
  const [showTakeValueModal, setShowTakeValueModal] = useState(false);
  const [takeValueAmount, setTakeValueAmount] = useState('');
  const [takeValueReason, setTakeValueReason] = useState('');

  // Usar hook para calcular valor líquido correto
  const {
    currentLiquidValue: currentLiquidDisplay,
    pendingAmount,
    totalPaid
  } = useProfessionalLiquidValue(establishmentId, professionalId, currentLiquidValue, selectedMonth);

  // O valor original (total do mês) é o currentLiquidValue passado como prop
  const totalLiquidValue = currentLiquidValue; // Valor total do mês
  const totalPaidEffective =
    typeof validatedPaidAmount === 'number' ? Math.max(0, validatedPaidAmount) : totalPaid;
  const overpaidAmount = Math.max(0, totalPaidEffective - totalLiquidValue);
  // Pendente = o que falta para fechar o mês (líquido - já pago), respeitando trava contra adiantamentos.
  const pendingByLiquid = Math.max(0, totalLiquidValue - totalPaidEffective);
  const pendingByValidatedRule =
    typeof validatedPendingAmount === 'number' ? Math.max(0, validatedPendingAmount) : pendingByLiquid;
  // Regra principal: "Pagar pendente" deve respeitar o pendente validado.
  // newSalesValue é informativo (resumo), não deve reduzir o valor realmente pendente.
  const pendingToPay = Math.max(0, Math.min(pendingByLiquid, pendingByValidatedRule));

  const paymentSummary = getPaymentSummary(professionalId);
  const professionalPayments = getProfessionalPayments(professionalId).filter(
    (payment) => !ignoredPaymentIds.includes(payment.id)
  );

  const forMonthKey = selectedMonth
    ? `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
    : undefined;

  const handlePayFullAmount = async () => {
    if (pendingToPay <= 0) {
      toast.error('Não há valor pendente para pagar');
      return;
    }

    if (isProcessing) {
      toast.error('Processando pagamento... Aguarde!');
      return;
    }

    setIsProcessing(true);

    try {
      await recordPayment(professionalId, professionalName, pendingToPay, forMonthKey);
      toast.success(`Pagamento de ${formatCurrency(pendingToPay)} registrado para ${professionalName}`);
      onPaymentRecorded?.();
      setShowPaymentOptions(false);

      // Forçar refresh da página após pagamento para garantir atualização
      setTimeout(() => {
        console.log('🔄 Fazendo refresh após pagamento');
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayCustomAmount = async () => {
    const amount = parseFloat(customAmount.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    if (amount > pendingToPay) {
      toast.error(`Valor não pode ser maior que ${formatCurrency(pendingToPay)}`);
      return;
    }

    if (isProcessing) {
      toast.error('Processando pagamento... Aguarde!');
      return;
    }

    setIsProcessing(true);

    try {
      await recordPayment(professionalId, professionalName, amount, forMonthKey);
      toast.success(`Pagamento de ${formatCurrency(amount)} registrado para ${professionalName}`);
      onPaymentRecorded?.();
      setCustomAmount('');
      setShowCustomInput(false);
      setShowPaymentOptions(false);

      // Forçar refresh da página após pagamento para garantir atualização
      setTimeout(() => {
        console.log('🔄 Fazendo refresh após pagamento customizado');
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentClick = () => {
    if (pendingToPay <= 0) {
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
      toast.error(`Valor não pode ser maior que ${formatCurrency(currentLiquidDisplay)}`);
      return;
    }

    if (!takeValueReason.trim()) {
      toast.error('Digite o motivo da retirada');
      return;
    }

    if (isProcessing) {
      toast.error('Processando... Aguarde!');
      return;
    }

    setIsProcessing(true);

    try {
      // Registrar como "pagamento negativo" para o profissional
      // Isso vai diminuir o valor líquido dele e aumentar o caixa do estabelecimento
      const retiradaPayload: Record<string, unknown> = {
        establishment_id: establishmentId,
        professional_id: professionalId,
        professional_name: professionalName,
        amount: -amount,
        payment_date: new Date().toISOString()
      };
      if (forMonthKey) retiradaPayload.for_month = forMonthKey;
      const { data, error } = await supabase
        .from('professional_payments')
        .insert(retiradaPayload)
        .select()
        .single();

      if (error) {
        console.error('Erro ao registrar retirada:', error);
        throw error;
      }

      console.log('✅ Retirada registrada com sucesso:', data);

      toast.success(`Valor de ${formatCurrency(amount)} retirado de ${professionalName} e adicionado ao caixa`);
      setTakeValueAmount('');
      setTakeValueReason('');
      setShowTakeValueModal(false);
      onPaymentRecorded?.();

      // Forçar refresh da página após retirada
      setTimeout(() => {
        console.log('🔄 Fazendo refresh após retirada de valor');
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao retirar valor:', error);
      toast.error('Erro ao retirar valor: ' + error.message);
    } finally {
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
      toast.success(`Pagamento de ${formatCurrency(paymentAmount)} deletado com sucesso!`);
      onPaymentRecorded?.();

      // Forçar refresh da página após deletar para garantir atualização
      setTimeout(() => {
        console.log('🔄 Fazendo refresh após deletar pagamento');
        window.location.reload();
      }, 1000);
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
      <div className="bg-gray-50 rounded-lg p-3 space-y-3">
        {/* Informações Financeiras */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm font-medium text-gray-700">
              Líquido: {formatCurrency(totalLiquidValue)}
            </span>
            {totalPaidEffective > 0 && (
              <span className="text-xs text-gray-500">
                (Pago: {formatCurrency(totalPaidEffective)})
              </span>
            )}
          </div>

          {pendingToPay > 0 && (
            <div className="text-sm text-blue-600 font-medium">
              Pendente: {formatCurrency(pendingToPay)}
            </div>
          )}
          {ignoredAdvanceAmount > 0 && (
            <div className="text-xs text-amber-700 font-medium">
              Adiantamentos ignorados: {formatCurrency(ignoredAdvanceAmount)}
            </div>
          )}
        </div>

        {/* Botões - Layout Mobile */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Botão PAGAR */}
          {pendingToPay > 0 && !showPaymentOptions && (
            <button
              onClick={handlePaymentClick}
              disabled={isProcessing || loading}
              className="w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title={`Pagar ${formatCurrency(pendingToPay)} para ${professionalName}`}
            >
              <Check className="w-4 h-4" />
              <span>PAGAR</span>
            </button>
          )}

          {/* Botão PEGAR VALOR */}
          {currentLiquidDisplay > 0 && !showTakeValueModal && (
            <button
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
              className={`w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 text-sm rounded ${overpaidAmount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
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
              onClick={() => setShowHistory(!showHistory)}
              className="w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
            </button>
          )}
        </div>
      </div>

      {/* Opções de Pagamento */}
      {showPaymentOptions && pendingToPay > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-blue-700">
              Opções de Pagamento - {professionalName}
            </h4>
            <button
              onClick={() => setShowPaymentOptions(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Pagar Todo */}
            <button
              onClick={handlePayFullAmount}
              disabled={isProcessing}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Pagar Pendente ({formatCurrency(pendingToPay)})</span>
            </button>

            {/* Pagar Valor Específico */}
            <div className="space-y-2">
              <button
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handlePayCustomAmount}
                      disabled={isProcessing || !customAmount}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Processando...' : 'Confirmar Pagamento'}
                    </button>
                    <button
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
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              Histórico de Pagamentos - {professionalName}
              {selectedMonth && (
                <span className="text-xs text-gray-500 ml-2">
                  ({selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})
                </span>
              )}
            </h4>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {professionalPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className={`text-sm font-medium ${payment.amount > 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                    {payment.amount > 0 ? formatCurrency(payment.amount) : formatCurrency(Math.abs(payment.amount))}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(payment.payment_date)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-xs font-medium ${payment.amount > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {payment.amount > 0 ? '✓ Pago' : '↩ Retirado'}
                  </div>
                  <button
                    onClick={() => handleDeletePayment(payment.id, payment.amount)}
                    disabled={isProcessing}
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Deletar este pagamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Pago:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(totalPaidEffective)}
              </span>
            </div>
            {ignoredAdvanceAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Adiantamentos ignorados:</span>
                <span className="font-medium text-amber-700">
                  {formatCurrency(ignoredAdvanceAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pagamentos:</span>
              <span className="font-medium text-gray-700">
                {paymentSummary.paymentCount}
              </span>
            </div>
            {paymentSummary.lastPaymentDate && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Último Pagamento:</span>
                <span className="font-medium text-gray-700">
                  {formatDate(paymentSummary.lastPaymentDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status quando não há pagamentos */}
      {!showHistory && professionalPayments.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-2">
          {selectedMonth ?
            `Nenhum pagamento registrado em ${selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` :
            'Nenhum pagamento registrado ainda'
          }
        </div>
      )}

      {/* Modal PEGAR VALOR */}
      {showTakeValueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Retirar Valor - {professionalName}
              </h3>
              <button
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
              {/* Valor disponível */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Valor disponível:</div>
                <div className="text-lg font-medium text-gray-900">
                  {formatCurrency(currentLiquidDisplay)}
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
                  onClick={handleTakeValue}
                  disabled={isProcessing || !takeValueAmount || !takeValueReason.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processando...' : 'Confirmar Retirada'}
                </button>
                <button
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
    </div>
  );
};