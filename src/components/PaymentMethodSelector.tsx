import React from 'react';

interface PaymentMethodSelectorProps {
  selectedMethod: string | null;
  onMethodSelect: (method: string) => void;
  showPixOptions?: boolean;
  pixPaymentMethod?: 'pix_now' | 'pix_local' | null;
  onPixMethodSelect?: (method: 'pix_now' | 'pix_local') => void;
  enabledMethods?: string[]; // Formas de pagamento habilitadas pelo estabelecimento
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onMethodSelect,
  showPixOptions = false,
  pixPaymentMethod,
  onPixMethodSelect,
  enabledMethods
}) => {
  const allPaymentMethods = [
    { value: 'pix', label: 'PIX', icon: '💸', color: 'bg-green-500' },
    { value: 'credito', label: 'CRÉDITO', icon: '💳', color: 'bg-blue-500' },
    { value: 'debito', label: 'DÉBITO', icon: '💳', color: 'bg-purple-500' },
    { value: 'dinheiro', label: 'DINHEIRO', icon: '💵', color: 'bg-yellow-500' },
    { value: 'pagar_local', label: 'PAGAR NO LOCAL', icon: '🏪', color: 'bg-orange-500' }
  ];
  const knownValues = new Set(allPaymentMethods.map((m) => m.value));
  const customEnabled = (enabledMethods || []).filter((m) => !knownValues.has(String(m || '').trim()));
  const customPaymentMethods = customEnabled.map((value) => ({
    value,
    label: String(value || '').toUpperCase(),
    icon: '⭐',
    color: 'bg-gray-500'
  }));

  // Filtrar métodos de pagamento com base nas configurações do estabelecimento
  const paymentMethods =
    enabledMethods && enabledMethods.length > 0
      ? [
          ...allPaymentMethods.filter((method) => enabledMethods.includes(method.value)),
          ...customPaymentMethods
        ]
      : allPaymentMethods;

  return (
    <div className="space-y-4">
      {/* Seleção do método principal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paymentMethods.map((method) => (
          <button
            key={method.value}
            type="button"
            onClick={() => onMethodSelect(method.value)}
            className={`
              p-4 rounded-lg border-2 transition-all duration-200 text-sm font-medium min-h-[80px] w-full
              ${selectedMethod === method.value
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }
            `}
          >
            <div className="flex flex-col items-center justify-center gap-2 h-full">
              <span className="text-xl">{method.icon}</span>
              <span className="text-center leading-tight text-xs sm:text-sm">{method.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Opções específicas do PIX */}
      {showPixOptions && selectedMethod === 'pix' && onPixMethodSelect && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Opção de PIX:</h4>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => onPixMethodSelect('pix_now')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${pixPaymentMethod === 'pix_now'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
            >
              ✅ Pagar agora
            </button>
            <button
              type="button"
              onClick={() => onPixMethodSelect('pix_local')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${pixPaymentMethod === 'pix_local'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
            >
              🏪 Pagar no local
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 