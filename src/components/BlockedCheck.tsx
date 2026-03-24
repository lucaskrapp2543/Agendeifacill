import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface BlockedCheckProps {
  children: React.ReactNode;
}

const BlockedCheck: React.FC<BlockedCheckProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const checkBlockedStatus = async () => {
      if (!user) {
        setIsChecking(false);
        return;
      }

      try {
        // ✅ Fail-open com timeout: evita travar infinito em mobile/PWA ou quando há outra aba aberta
        // Se a checagem demorar demais, liberamos o app e registramos no console.
        let timeoutFired = false;
        const timeoutId = window.setTimeout(() => {
          timeoutFired = true;
          console.warn('⚠️ Timeout ao verificar status de bloqueio. Liberando acesso (fail-open).');
          setIsChecking(false);
        }, 8000);

        // Verificar bloqueio apenas em estabelecimentos ativos do proprietário.
        // Evita falso bloqueio quando existem registros antigos/deletados.
        const { data: establishmentsData, error } = await supabase
          .from('establishments')
          .select('id,is_blocked,is_deleted,created_at')
          .eq('owner_id', user.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false });

        window.clearTimeout(timeoutId);
        if (timeoutFired) return; // já liberamos o app; não sobrescrever estado

        if (error) {
          console.error('Erro ao verificar status de bloqueio:', error);
          setIsChecking(false);
          return;
        }

        const activeEstablishments = Array.isArray(establishmentsData) ? establishmentsData : [];
        if (activeEstablishments.length === 0) {
          setIsChecking(false);
          return;
        }

        // Regra defensiva: só bloqueia se TODOS os estabelecimentos ativos estiverem bloqueados.
        const shouldBlock = activeEstablishments.every((est) => Boolean((est as any)?.is_blocked));
        if (shouldBlock) {
          setIsBlocked(true);
          navigate('/blocked');
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error('Erro ao verificar bloqueio:', error);
        setIsChecking(false);
      }
    };

    checkBlockedStatus();
  }, [user, navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando status...</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return null; // O redirecionamento já foi feito
  }

  return <>{children}</>;
};

export default BlockedCheck;
