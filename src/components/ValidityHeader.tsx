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

export const ValidityHeader: React.FC<ValidityHeaderProps> = ({ establishmentId }) => {
  const [validity, setValidity] = useState<EstablishmentValidity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    fetchValidity();
  }, [establishmentId]);

  const fetchValidity = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('establishments')
        .select('payment_due_date, payment_status, plan_type, name')
        .eq('id', establishmentId)
        .single();

      if (error) {
        console.error('Erro ao buscar validade:', error);
        return;
      }

      setValidity(data);
      calculateDaysRemaining(data.payment_due_date);
    } catch (error) {
      console.error('Erro:', error);
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
    } else if (daysRemaining <= 3) {
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

  if (isLoading || !validity) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Calendar className="h-4 w-4" />
        <span>Carregando validade...</span>
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
