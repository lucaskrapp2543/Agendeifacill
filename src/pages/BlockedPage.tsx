import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstablishmentBillingPaymentModal } from '../components/EstablishmentBillingPaymentModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const BlockedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showBillingPaymentModal, setShowBillingPaymentModal] = useState(false);
  const [isLoadingEstablishment, setIsLoadingEstablishment] = useState(true);
  const [billingTarget, setBillingTarget] = useState<{ id: string; name: string } | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    const loadBlockedEstablishment = async () => {
      if (!user?.id) {
        setIsLoadingEstablishment(false);
        return;
      }

      setIsLoadingEstablishment(true);
      try {
        const { data, error } = await (supabase as any)
          .from('establishments')
          .select('id, name, is_blocked, is_deleted, created_at')
          .eq('owner_id', user.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const establishments = Array.isArray(data) ? data : [];
        if (establishments.length === 0) {
          setBillingTarget(null);
          return;
        }

        const blocked = establishments.find((est: any) => Boolean(est?.is_blocked));
        const target = blocked || establishments[0];
        setBillingTarget({
          id: String(target?.id || ''),
          name: String(target?.name || 'Estabelecimento'),
        });
      } catch (error: any) {
        const messageParts = [
          String(error?.message || '').trim(),
          error?.code ? `(código: ${error.code})` : '',
          String(error?.details || error?.hint || '').trim(),
        ].filter(Boolean);
        setLoadingMessage(
          messageParts.join(' ') || 'Não foi possível carregar os dados para pagamento automático.'
        );
        setBillingTarget(null);
      } finally {
        setIsLoadingEstablishment(false);
      }
    };

    void loadBlockedEstablishment();
  }, [user?.id]);

  const canOpenAutomatedBilling = useMemo(
    () => !isLoadingEstablishment && Boolean(billingTarget?.id),
    [isLoadingEstablishment, billingTarget?.id]
  );

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Ícone de bloqueio */}
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-red-600" />
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Sistema Bloqueado
        </h1>

        {/* Mensagem */}
        <p className="text-gray-600 mb-4 leading-relaxed">
          Seu sistema foi bloqueado por falta de pagamento.
          Para continuar utilizando nossos serviços, regularize agora no fluxo automático.
        </p>

        {/* Mensagem destacada */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <p className="text-green-800 font-semibold text-center">
            Não se preocupe, os clientes ainda conseguem agendar com você
          </p>
        </div>

        {/* Botão de regularização automática */}
        <button
          onClick={() => setShowBillingPaymentModal(true)}
          disabled={!canOpenAutomatedBilling}
          className={`w-full text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3 mb-4 ${
            canOpenAutomatedBilling
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-green-300 cursor-not-allowed'
          }`}
        >
          {isLoadingEstablishment ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando pagamento automático...</span>
            </>
          ) : (
            <span>Clique aqui para atualizar seu pagamento</span>
          )}
        </button>
        {loadingMessage && (
          <p className="text-xs text-red-600 mb-4">{loadingMessage}</p>
        )}

        {/* Botão voltar */}
        <button
          onClick={handleGoBack}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao início</span>
        </button>

        {/* Informações adicionais */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Em caso de dúvidas, entre em contato com o suporte.
          </p>
        </div>
      </div>

      {billingTarget?.id && (
        <EstablishmentBillingPaymentModal
          isOpen={showBillingPaymentModal}
          onClose={() => setShowBillingPaymentModal(false)}
          establishmentId={billingTarget.id}
          establishmentName={billingTarget.name}
          onPaid={async () => {
            setShowBillingPaymentModal(false);
            navigate('/', { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default BlockedPage;
