import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { EstablishmentBillingPaymentModal } from './EstablishmentBillingPaymentModal';

interface ValidityDisplayProps {
  establishmentId: string;
}

interface EstablishmentValidity {
  payment_due_date: string;
  payment_status: 'paid' | 'unpaid' | 'expired';
  plan_type: 'monthly' | 'annual' | 'trial';
  name?: string;
}

export const ValidityDisplay: React.FC<ValidityDisplayProps> = ({ establishmentId }) => {
  const [validity, setValidity] = useState<EstablishmentValidity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [showBillingPaymentModal, setShowBillingPaymentModal] = useState(false);

  useEffect(() => {
    fetchValidityData();
  }, [establishmentId]);

  useEffect(() => {
    if (validity?.payment_due_date) {
      calculateDaysRemaining();
    }
  }, [validity]);

  const fetchValidityData = async () => {
    try {
      const { data, error } = await supabase
        .from('establishments')
        .select('payment_due_date, payment_status, plan_type, name')
        .eq('id', establishmentId)
        .single();

      if (error) {
        console.error('Erro ao buscar dados de validade:', error);
        return;
      }

      setValidity(data);
    } catch (error) {
      console.error('Erro ao buscar dados de validade:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysRemaining = () => {
    if (!validity?.payment_due_date) return;

    const today = new Date();
    const dueDate = new Date(validity.payment_due_date);
    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    setDaysRemaining(daysDiff);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = () => {
    if (!validity) return 'text-gray-400';
    const normalizedStatus = String(validity.payment_status || '').toLowerCase().trim();

    if (normalizedStatus === 'expired' || daysRemaining < 0) {
      return 'text-red-500';
    } else if (daysRemaining === 0) {
      return 'text-red-500';
    } else if (normalizedStatus === 'paid') {
      return 'text-green-500';
    } else if (daysRemaining <= 7) {
      return 'text-yellow-500';
    } else {
      return 'text-green-500';
    }
  };

  const getStatusIcon = () => {
    if (!validity) return <Calendar className="h-4 w-4" />;
    const normalizedStatus = String(validity.payment_status || '').toLowerCase().trim();

    if (normalizedStatus === 'expired' || daysRemaining < 0) {
      return <AlertTriangle className="h-4 w-4" />;
    } else if (daysRemaining === 0) {
      return <AlertTriangle className="h-4 w-4" />;
    } else if (normalizedStatus === 'paid') {
      return <Calendar className="h-4 w-4" />;
    } else if (daysRemaining <= 7) {
      return <Clock className="h-4 w-4" />;
    } else {
      return <Calendar className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    if (!validity) return 'Carregando...';
    const normalizedStatus = String(validity.payment_status || '').toLowerCase().trim();

    if (normalizedStatus === 'expired' || daysRemaining < 0) {
      return 'Vencido';
    } else if (daysRemaining === 0) {
      return 'Vence hoje';
    } else if (normalizedStatus === 'paid') {
      return 'Em dia';
    } else if (daysRemaining === 1) {
      return 'Vence amanhã';
    } else {
      return `Vence em ${daysRemaining} dias`;
    }
  };

  // Verifica se está em dia (mais de 7 dias restantes e não está vencido)
  const normalizedDisplayStatus = String(validity.payment_status || '').toLowerCase().trim();
  const isInGoodStanding = validity && (
    (normalizedDisplayStatus === 'paid' && daysRemaining > 0) ||
    (daysRemaining > 7 && normalizedDisplayStatus !== 'expired' && daysRemaining >= 0)
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Calendar className="h-3 w-3" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (!validity) {
    return null;
  }

  // Modo discreto - quando está em dia
  if (isInGoodStanding) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
        <Calendar className="h-3 w-3 text-green-500" />
        <span className="text-gray-600">
          Válido até {formatDate(validity.payment_due_date)}
        </span>
      </div>
    );
  }

  // Modo chamativo - quando está vencido ou próximo do vencimento
  return (
    <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-white">Validade Agendei Fácil</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Data de vencimento:</span>
          <span className="text-white font-medium">{formatDate(validity.payment_due_date)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Status:</span>
          <div className={`flex items-center gap-2 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="font-medium">{getStatusText()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Plano:</span>
          <span className="text-white font-medium capitalize">
            {validity.plan_type === 'monthly' ? 'Mensal' : 'Anual'}
          </span>
        </div>

        {daysRemaining <= 2 && daysRemaining >= 0 && normalizedDisplayStatus !== 'expired' && (
          <div className="mt-4 p-4 bg-gradient-to-r from-red-600 to-red-700 border-4 border-red-400 rounded-xl shadow-2xl animate-red-blink">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-white">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
                <div className="flex-1">
                  <p className="text-lg font-bold">
                    {daysRemaining === 0
                      ? '⚠️ VENCE HOJE!'
                      : daysRemaining === 1
                        ? '⚠️ FALTA 1 DIA PARA O VENCIMENTO!'
                        : '⚠️ FALTAM 2 DIAS PARA O VENCIMENTO!'}
                  </p>
                  <p className="text-sm text-red-100 font-semibold mt-2">
                    💰 Regularize o pagamento para evitar bloqueio do sistema.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBillingPaymentModal(true)}
                className="w-full bg-white text-red-600 font-bold py-3 px-4 rounded-lg hover:bg-red-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-base"
              >
                💳 PAGAR AGORA
              </button>
            </div>
          </div>
        )}

        {(normalizedDisplayStatus === 'expired' || daysRemaining < 0) && (
          <div className="mt-4 p-4 bg-gradient-to-r from-red-600 to-red-700 border-4 border-red-400 rounded-xl shadow-2xl animate-pulse">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-white">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
                <div className="flex-1">
                  <p className="text-lg font-bold">
                    {daysRemaining < 0
                      ? `⚠️ VENCIDO HÁ ${Math.abs(daysRemaining)} DIA${Math.abs(daysRemaining) !== 1 ? 'S' : ''}!`
                      : '⚠️ PLANO VENCIDO!'
                    }
                  </p>
                  <p className="text-sm text-red-100 font-semibold mt-1">
                    🔒 Acesso será bloqueado em {Math.max(0, 4 - Math.abs(daysRemaining))} dia{Math.max(0, 4 - Math.abs(daysRemaining)) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBillingPaymentModal(true)}
                className="w-full bg-white text-red-600 font-bold py-3 px-4 rounded-lg hover:bg-red-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-base"
              >
                💳 PAGAR AGORA
              </button>
            </div>
          </div>
        )}
      </div>

      <EstablishmentBillingPaymentModal
        isOpen={showBillingPaymentModal}
        onClose={() => setShowBillingPaymentModal(false)}
        establishmentId={String(establishmentId || '')}
        establishmentName={String(validity?.name || 'Estabelecimento')}
        onPaid={async () => {
          setShowBillingPaymentModal(false);
          await fetchValidityData();
        }}
      />
    </div>
  );
};
