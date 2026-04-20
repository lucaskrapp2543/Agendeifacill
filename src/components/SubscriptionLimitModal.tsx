import { X } from 'lucide-react';
import React from 'react';

interface SubscriptionLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenewSubscription: () => void;
  onBookAsNormal: () => void;
  currentUsage: number;
  monthlyLimit: number;
  subscriptionName: string;
}

export const SubscriptionLimitModal: React.FC<SubscriptionLimitModalProps> = ({
  isOpen,
  onClose,
  onRenewSubscription,
  onBookAsNormal,
  currentUsage,
  monthlyLimit,
  subscriptionName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        {/* Botão de fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Ícone de aviso */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
          Limite de Serviços Atingido
        </h2>

        {/* Mensagem principal */}
        <div className="text-center mb-6">
          <p className="text-gray-700 mb-2">
            <strong>Atenção:</strong> você já atingiu o limite dos seus serviços como assinante neste mês.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">
              <strong>Assinatura:</strong> {subscriptionName}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Uso atual:</strong> {currentUsage} de {monthlyLimit} serviços
            </p>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="space-y-3">
          <button
            onClick={onRenewSubscription}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔄 Renovar Assinatura
          </button>

          <button
            onClick={onBookAsNormal}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            📅 Agendar como cliente normal
          </button>
        </div>

        {/* Texto explicativo */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Ao renovar a assinatura, você terá acesso a mais serviços no próximo mês.
          <br />
          Ou agende como cliente normal pagando o valor individual do serviço.
        </p>
      </div>
    </div>
  );
};

