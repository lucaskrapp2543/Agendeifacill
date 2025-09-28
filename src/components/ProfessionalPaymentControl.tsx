import { Check, EyeOff, History } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useProfessionalLiquidValue } from '../hooks/useProfessionalLiquidValue';
import { useProfessionalPayments } from '../hooks/useProfessionalPayments';

interface ProfessionalPaymentControlProps {
  establishmentId: string;
  professionalId: string;
  professionalName: string;
  currentLiquidValue: number;
  selectedMonth?: Date;
  onPaymentRecorded?: () => void;
}

export const ProfessionalPaymentControl: React.FC<ProfessionalPaymentControlProps> = ({
  establishmentId,
  professionalId,
  professionalName,
  currentLiquidValue,
  selectedMonth,
  onPaymentRecorded
}) => {
  const {
    loading,
    recordPayment,
    getPaymentSummary,
    getProfessionalPayments
  } = useProfessionalPayments(establishmentId, selectedMonth);

  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Usar hook para calcular valor líquido correto
  const {
    currentLiquidValue: currentLiquidDisplay,
    pendingAmount,
    totalPaid
  } = useProfessionalLiquidValue(establishmentId, professionalId, currentLiquidValue, selectedMonth);

  const paymentSummary = getPaymentSummary(professionalId);
  const professionalPayments = getProfessionalPayments(professionalId);

  const handlePayFullAmount = async () => {
    if (pendingAmount <= 0) {
      toast.error('Não há valor pendente para pagar');
      return;
    }

    if (isProcessing) {
      toast.error('Processando pagamento... Aguarde!');
      return;
    }

    setIsProcessing(true);

    try {
      await recordPayment(professionalId, professionalName, pendingAmount);
      toast.success(`Pagamento de ${formatCurrency(pendingAmount)} registrado para ${professionalName}`);
      onPaymentRecorded?.();
      setShowPaymentOptions(false);
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

    if (amount > pendingAmount) {
      toast.error(`Valor não pode ser maior que ${formatCurrency(pendingAmount)}`);
      return;
    }

    if (isProcessing) {
      toast.error('Processando pagamento... Aguarde!');
      return;
    }

    setIsProcessing(true);

    try {
      await recordPayment(professionalId, professionalName, amount);
      toast.success(`Pagamento de ${formatCurrency(amount)} registrado para ${professionalName}`);
      onPaymentRecorded?.();
      setCustomAmount('');
      setShowCustomInput(false);
      setShowPaymentOptions(false);
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentClick = () => {
    if (pendingAmount <= 0) {
      toast.error('Não há valor pendente para pagar');
      return;
    }
    setShowPaymentOptions(true);
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

  return (
    <div className="space-y-2">
      {/* Controles de Pagamento */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">
              Líquido: {formatCurrency(currentLiquidDisplay)}
            </span>
            {totalPaid > 0 && (
              <span className="text-xs text-gray-500">
                (Pago: {formatCurrency(totalPaid)})
              </span>
            )}
          </div>

          {pendingAmount > 0 && (
            <div className="text-sm text-blue-600 font-medium">
              Pendente: {formatCurrency(pendingAmount)}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Botão PAGAR */}
          {pendingAmount > 0 && !showPaymentOptions && (
            <button
              onClick={handlePaymentClick}
              disabled={isProcessing || loading}
              className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title={`Pagar ${formatCurrency(pendingAmount)} para ${professionalName}`}
            >
              <Check className="w-4 h-4" />
              <span>PAGAR</span>
            </button>
          )}

          {/* Mensagem quando não há valor pendente */}
          {pendingAmount <= 0 && !isProcessing && (
            <div className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded">
              <Check className="w-4 h-4" />
              <span>Em dia</span>
            </div>
          )}

          {/* Botão Histórico */}
          {professionalPayments.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
            </button>
          )}
        </div>
      </div>

      {/* Opções de Pagamento */}
      {showPaymentOptions && pendingAmount > 0 && (
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
              <span>Pagar Todo Líquido ({formatCurrency(pendingAmount)})</span>
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
                    placeholder={`Máximo: ${formatCurrency(pendingAmount)}`}
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
                className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">
                    {formatCurrency(payment.amount)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(payment.payment_date)}
                  </div>
                </div>
                <div className="text-xs text-green-600 font-medium">
                  ✓ Pago
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Pago:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(paymentSummary.totalPaid)}
              </span>
            </div>
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
    </div>
  );
};