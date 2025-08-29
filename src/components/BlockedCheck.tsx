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
        // Verificar se o usuário é um estabelecimento
        const { data: establishmentData, error } = await supabase
          .from('establishments')
          .select('is_blocked')
          .eq('owner_id', user.id)
          .single();

        if (error) {
          console.error('Erro ao verificar status de bloqueio:', error);
          setIsChecking(false);
          return;
        }

        if (establishmentData && establishmentData.is_blocked) {
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
