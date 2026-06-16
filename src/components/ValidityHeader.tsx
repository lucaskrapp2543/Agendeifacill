import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { EstablishmentBillingPaymentModal } from './EstablishmentBillingPaymentModal';

interface EstablishmentValidity {
  payment_due_date: string;
  payment_status: 'paid' | 'unpaid' | 'expired';
  plan_type: 'monthly' | 'annual' | 'trial';
  name?: string;
}

interface ValidityHeaderProps {
  establishmentId: string;
  /** Visual premium compacto (Meus Agendamentos) — mesma lógica e textos */
  compactPremium?: boolean;
}

const VALIDITY_FETCH_TIMEOUT_MS = 12000; // 12s - evita travar em "Carregando validade..." quando Supabase está lento

export const ValidityHeader: React.FC<ValidityHeaderProps> = ({ establishmentId, compactPremium = false }) => {
  const [validity, setValidity] = useState<EstablishmentValidity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [showBillingPaymentModal, setShowBillingPaymentModal] = useState(false);

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
    if (!validity) return compactPremium ? 'text-gray-600' : 'text-gray-500';
    const normalizedStatus = String(validity.payment_status || '').toLowerCase().trim();

    if (normalizedStatus === 'expired' || daysRemaining < 0) {
      return compactPremium ? 'text-red-800' : 'text-red-500';
    } else if (daysRemaining === 0) {
      return compactPremium ? 'text-red-800' : 'text-red-600';
    } else if (normalizedStatus === 'paid') {
      return compactPremium ? 'text-emerald-800' : 'text-green-600';
    } else if (daysRemaining <= 2) {
      return compactPremium ? 'text-red-800' : 'text-red-600';
    } else if (daysRemaining <= 7) {
      return compactPremium ? 'text-amber-800' : 'text-yellow-500';
    } else {
      return compactPremium ? 'text-emerald-800' : 'text-green-500';
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
    } else {
      return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    if (!validity || isLoading) return 'Carregando...';
    const normalizedStatus = String(validity.payment_status || '').toLowerCase().trim();

    if (normalizedStatus === 'expired' || daysRemaining < 0) {
      const daysOverdue = Math.abs(daysRemaining);
      const daysUntilBlock = Math.max(0, 4 - daysOverdue);
      return `⚠️ Vencido há ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''} - Acesso bloqueia em ${daysUntilBlock} dia${daysUntilBlock !== 1 ? 's' : ''}!`;
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

  const getPremiumPillClasses = () => {
    if (!validity) return 'border-gray-200 bg-gray-50';
    const normalizedStatus = String(validity.payment_status || '').toLowerCase().trim();

    if (normalizedStatus === 'expired' || daysRemaining < 0) {
      return 'border-red-200 bg-gradient-to-r from-red-50 to-red-100/80';
    }
    if (daysRemaining === 0 || daysRemaining <= 2) {
      return 'border-red-200 bg-gradient-to-r from-red-50 to-red-100/80';
    }
    if (daysRemaining <= 7 && normalizedStatus !== 'paid') {
      return 'border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/80';
    }
    return 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/80';
  };

  if (fetchError) {
    return (
      <div
        className={
          compactPremium
            ? 'w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col gap-1'
            : 'flex flex-col gap-1'
        }
      >
        <span className={`text-xs ${compactPremium ? 'text-amber-800' : 'text-amber-600'}`}>
          Falha ao carregar. Conexão lenta.
        </span>
        <button
          type="button"
          onClick={() => fetchValidity()}
          className={`text-xs hover:underline ${compactPremium ? 'text-blue-700' : 'text-blue-600'}`}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (isLoading || !validity) {
    return (
      <div
        className={
          compactPremium
            ? 'w-full flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500'
            : 'flex items-center gap-2 text-sm text-gray-500'
        }
      >
        <Calendar className="h-4 w-4 shrink-0" />
        <span>Carregando validade...</span>
      </div>
    );
  }

  // Aviso chamativo em 2 dias, 1 dia e no dia do vencimento (somente quando ainda não está pago).
  const normalizedHeaderStatus = String(validity.payment_status || '').toLowerCase().trim();
  if (daysRemaining <= 2 && daysRemaining >= 0 && normalizedHeaderStatus !== 'expired') {
    const alertTitle =
      daysRemaining === 0
        ? '⚠️ VENCE HOJE!'
        : daysRemaining === 1
          ? '⚠️ FALTA 1 DIA PARA O VENCIMENTO!'
          : '⚠️ FALTAM 2 DIAS PARA O VENCIMENTO!';
    return (
      <>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-100 px-4 py-2 rounded-lg border-2 border-red-400 animate-red-blink shadow-lg">
            <AlertTriangle className="h-5 w-5 animate-bounce" />
            <span>{alertTitle}</span>
          </div>
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg border-2 border-red-400 animate-red-blink shadow-lg">
            <p className="text-xs font-semibold text-center mb-2">
              💰 Regularize seu pagamento para manter o sistema ativo.
            </p>
            <button
              onClick={() => setShowBillingPaymentModal(true)}
              className="w-full bg-white text-red-600 font-bold py-2 px-4 rounded-lg hover:bg-red-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-sm"
            >
              💳 PAGAR
            </button>
          </div>
        </div>

        <EstablishmentBillingPaymentModal
          isOpen={showBillingPaymentModal}
          onClose={() => setShowBillingPaymentModal(false)}
          establishmentId={String(establishmentId || '')}
          establishmentName={String(validity?.name || 'Estabelecimento')}
          onPaid={async () => {
            setShowBillingPaymentModal(false);
            await fetchValidity();
          }}
        />
      </>
    );
  }

  const shouldShowPaymentButton = normalizedHeaderStatus === 'expired' || daysRemaining <= 2;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full">
        <div
          className={
            compactPremium
              ? `w-full sm:w-auto flex items-center gap-2 text-sm font-semibold ${getStatusColor()} rounded-xl border px-3 py-2 shadow-sm ${getPremiumPillClasses()}`
              : `flex items-center gap-1 text-xs font-medium ${getStatusColor()} bg-white/80 px-2 py-1 rounded-full border`
          }
        >
          {getStatusIcon()}
          <span className="leading-snug">{getStatusText()}</span>
        </div>

        {shouldShowPaymentButton ? (
          <button
            type="button"
            onClick={() => setShowBillingPaymentModal(true)}
            className="inline-flex w-fit items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700"
          >
            💳 PAGAR AGORA
          </button>
        ) : null}
      </div>

      <EstablishmentBillingPaymentModal
        isOpen={showBillingPaymentModal}
        onClose={() => setShowBillingPaymentModal(false)}
        establishmentId={String(establishmentId || '')}
        establishmentName={String(validity?.name || 'Estabelecimento')}
        onPaid={async () => {
          setShowBillingPaymentModal(false);
          await fetchValidity();
        }}
      />
    </>
  );
};
