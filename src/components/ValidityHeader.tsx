import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface EstablishmentValidity {
  payment_due_date: string;
  payment_status: 'paid' | 'unpaid' | 'expired';
  plan_type: 'monthly' | 'annual' | 'trial';
  name?: string;
}

interface ValidityHeaderProps {
  establishmentId: string;
}

const VALIDITY_FETCH_TIMEOUT_MS = 12000; // 12s - evita travar em "Carregando validade..." quando Supabase está lento

export const ValidityHeader: React.FC<ValidityHeaderProps> = ({ establishmentId }) => {
  const [validity, setValidity] = useState<EstablishmentValidity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    fetchValidity();
  }, [establishmentId]);

  const fetchValidity = async () => {
    try {
      setIsLoading(true);
      setFetchError(false);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), VALIDITY_FETCH_TIMEOUT_MS)
      );
      const fetchPromise = supabase
        .from('establishments')
        .select('payment_due_date, payment_status, plan_type, name')
        .eq('id', establishmentId)
        .single();

      const result = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as { data: EstablishmentValidity | null; error: { message: string } | null };
      const { data, error } = result;

      if (error) {
        console.error('Erro ao buscar validade:', error);
        setFetchError(true);
        return;
      }

      setValidity(data);
      calculateDaysRemaining(data.payment_due_date);
    } catch (error) {
      console.error('Erro ao buscar validade (timeout ou rede):', error);
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysRemaining = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const timeDiff = due.getTime() - today.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24));
    setDaysRemaining(days);
  };

  const getStatusColor = () => {
    if (!validity) return 'text-gray-500';

    if (validity.payment_status === 'expired' || daysRemaining < 0) {
      return 'text-red-500';
    } else if (daysRemaining >= 1 && daysRemaining <= 4) {
      return 'text-red-600';
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
    } else {
      return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    if (!validity || isLoading) return 'Carregando...';

    if (validity.payment_status === 'expired' || daysRemaining < 0) {
      const daysOverdue = Math.abs(daysRemaining);
      const daysUntilBlock = Math.max(0, 4 - daysOverdue);
      return `⚠️ Vencido há ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''} - Acesso bloqueia em ${daysUntilBlock} dia${daysUntilBlock !== 1 ? 's' : ''}!`;
    } else if (daysRemaining === 0) {
      return 'Vence hoje';
    } else if (daysRemaining === 1) {
      return 'Vence amanhã';
    } else {
      return `Vence em ${daysRemaining} dias`;
    }
  };

  if (fetchError) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-amber-600">Falha ao carregar. Conexão lenta.</span>
        <button
          type="button"
          onClick={() => fetchValidity()}
          className="text-xs text-blue-600 hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (isLoading || !validity) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Calendar className="h-4 w-4" />
        <span>Carregando validade...</span>
      </div>
    );
  }

  // Aviso chamativo em vermelho piscando para 1-4 dias
  if (daysRemaining >= 1 && daysRemaining <= 4 && validity.payment_status !== 'expired') {
    return (
      <div className="flex flex-col gap-2">
        <div className={`flex items-center gap-2 text-sm font-bold text-red-600 bg-red-100 px-4 py-2 rounded-lg border-2 border-red-400 animate-red-blink shadow-lg`}>
          <AlertTriangle className="h-5 w-5 animate-bounce" />
          <span>
            {daysRemaining === 1
              ? '⚠️ FALTA 1 DIA PARA O VENCIMENTO!'
              : `⚠️ FALTAM ${daysRemaining} DIAS PARA O VENCIMENTO!`
            }
          </span>
        </div>
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg border-2 border-red-400 animate-red-blink shadow-lg">
          <p className="text-xs font-semibold text-center mb-2">
            💰 Regularize seu pagamento para manter o sistema ativo.
          </p>
          <button
            onClick={() => {
              const message = 'Olá, quero regularizar meu pagamento.';
              const whatsappUrl = `https://wa.me/5548991265320?text=${encodeURIComponent(message)}`;
              window.open(whatsappUrl, '_blank');
            }}
            className="w-full bg-white text-red-600 font-bold py-2 px-4 rounded-lg hover:bg-red-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            💳 PAGAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${getStatusColor()} bg-white/80 px-2 py-1 rounded-full border`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
};
