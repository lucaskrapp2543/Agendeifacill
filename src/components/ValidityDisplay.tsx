import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

    if (validity.payment_status === 'expired' || daysRemaining < 0) {
      return 'text-red-500';
    } else if (daysRemaining <= 7) {
      return 'text-yellow-500';
    } else {
      return 'text-green-500';
    }
  };

  const getStatusIcon = () => {
    if (!validity) return <Calendar className="h-4 w-4" />;

    if (validity.payment_status === 'expired' || daysRemaining < 0) {
      return <AlertTriangle className="h-4 w-4" />;
    } else if (daysRemaining <= 7) {
      return <Clock className="h-4 w-4" />;
    } else {
      return <Calendar className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    if (!validity) return 'Carregando...';

    if (validity.payment_status === 'expired' || daysRemaining < 0) {
      return 'Vencido';
    } else if (daysRemaining === 0) {
      return 'Vence hoje';
    } else if (daysRemaining === 1) {
      return 'Vence amanhã';
    } else {
      return `Vence em ${daysRemaining} dias`;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-white">Validade Agendei Fácil</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!validity) {
    return (
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-white">Validade Agendei Fácil</h3>
        </div>
        <p className="text-gray-400">Não foi possível carregar as informações de validade.</p>
      </div>
    );
  }

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

        {daysRemaining > 0 && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-blue-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                {daysRemaining === 1
                  ? 'Falta 1 dia para o vencimento'
                  : `Faltam ${daysRemaining} dias para o vencimento`
                }
              </span>
            </div>
          </div>
        )}

        {(validity.payment_status === 'expired' || daysRemaining < 0) && (
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
                onClick={() => {
                  const establishmentName = validity?.name || 'Meu Estabelecimento';
                  const message = `Olá! Quero deixar meu sistema em dia. Estabelecimento: ${establishmentName}`;
                  const whatsappUrl = `https://wa.me/5548991265320?text=${encodeURIComponent(message)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="w-full bg-white text-red-600 font-bold py-3 px-4 rounded-lg hover:bg-red-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-base"
              >
                💳 PAGAR AGORA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
