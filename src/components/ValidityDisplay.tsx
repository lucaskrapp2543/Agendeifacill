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

      setValidity((data as EstablishmentValidity) || null);
    } catch (error) {
      console.error('Erro ao buscar dados de validade:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysRemaining = () => {
    if (!validity?.payment_due_date) return;

    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const parts = validity.payment_due_date.split(/[-T]/);
    const dueLocal = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const daysDiff = Math.round((dueLocal.getTime() - todayLocal.getTime()) / (1000 * 3600 * 24));

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

    if (daysRemaining <= 0 || normalizedStatus === 'expired') {
      return 'Sistema vencido, pode bloquear a qualquer momento';
    } else if (normalizedStatus === 'paid') {
      return 'Em dia';
    } else if (daysRemaining === 1) {
      return 'Vence amanhã';
    } else {
      return `Vence em ${daysRemaining} dias`;
    }
  };

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

  // Verifica se está em dia (mais de 7 dias restantes e não está vencido)
  const normalizedDisplayStatus = String(validity?.payment_status || '').toLowerCase().trim();
  const isInGoodStanding =
    (normalizedDisplayStatus === 'paid' && daysRemaining > 0) ||
    (daysRemaining > 7 && normalizedDisplayStatus !== 'expired' && daysRemaining >= 0);

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
  const isOverdue = daysRemaining <= 0 || normalizedDisplayStatus === 'expired';
  const alertTitle = isOverdue
    ? '⚠️ Sistema vencido — pode bloquear a qualquer momento'
    : daysRemaining === 1
      ? '⚠️ Seu sistema vence amanhã!'
      : `⚠️ Faltam ${daysRemaining} dias para o vencimento`;

  return (
    <div className="rounded-2xl overflow-hidden border border-red-500/30">
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-extrabold flex-1">{alertTitle}</p>
        </div>
        <p className="text-xs text-red-100/80 mt-1 ml-7">
          Vencimento: {formatDate(validity.payment_due_date)} • Plano {validity.plan_type === 'monthly' ? 'Mensal' : validity.plan_type === 'annual' ? 'Anual' : 'Teste'}
        </p>
      </div>
      <div className="bg-[#1a1b1c] px-4 py-3">
        <button
          onClick={() => setShowBillingPaymentModal(true)}
          className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-extrabold py-3 px-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
        >
          💳 PAGAR AGORA
        </button>
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
