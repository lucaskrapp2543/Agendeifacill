import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface BlockedCheckProps {
  children: React.ReactNode;
}

const BLOCKED_CHECK_LAST_OK_PREFIX = 'blocked_check_last_ok_v1';
const BLOCKED_CHECK_RECENT_OK_MS = 5 * 60 * 1000; // 5 min
const BLOCKED_CHECK_TIMEOUT_COLD_MS = 3500;
const BLOCKED_CHECK_TIMEOUT_WARM_MS = 1500;

let lastBlockedCheckTimeoutWarnAt = 0;

const BlockedCheck: React.FC<BlockedCheckProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: number | null = null;
    let timeoutFired = false;
    const abortController = new AbortController();

    const checkBlockedStatus = async () => {
      if (!user) {
        if (!isCancelled) setIsChecking(false);
        return;
      }

      const cacheKey = `${BLOCKED_CHECK_LAST_OK_PREFIX}:${user.id}`;
      const now = Date.now();
      let hasRecentUnblockedCheck = false;
      try {
        const cached = Number(localStorage.getItem(cacheKey) || 0);
        hasRecentUnblockedCheck = Number.isFinite(cached) && cached > 0 && now - cached < BLOCKED_CHECK_RECENT_OK_MS;
      } catch {
        hasRecentUnblockedCheck = false;
      }

      // Se acabou de validar que está liberado, não trava a tela novamente:
      // revalida em background para evitar loader infinito em oscilações de rede.
      if (hasRecentUnblockedCheck && !isCancelled) {
        setIsChecking(false);
      }

      try {
        const timeoutMs = hasRecentUnblockedCheck ? BLOCKED_CHECK_TIMEOUT_WARM_MS : BLOCKED_CHECK_TIMEOUT_COLD_MS;
        timeoutId = window.setTimeout(() => {
          timeoutFired = true;
          const warnNow = Date.now();
          if (warnNow - lastBlockedCheckTimeoutWarnAt > 30_000) {
            lastBlockedCheckTimeoutWarnAt = warnNow;
            console.warn('⚠️ Timeout ao verificar status de bloqueio. Liberando acesso (fail-open).');
          }
          abortController.abort();
          if (!isCancelled) setIsChecking(false);
        }, timeoutMs);

        // Verificar bloqueio apenas em estabelecimentos ativos do proprietário.
        // Evita falso bloqueio quando existem registros antigos/deletados.
        const { data: establishmentsData, error } = await supabase
          .from('establishments')
          .select('id,name,is_blocked,is_deleted,created_at')
          .eq('owner_id', user.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .abortSignal(abortController.signal)
          .order('created_at', { ascending: false });

        if (timeoutId !== null) window.clearTimeout(timeoutId);
        if (timeoutFired || isCancelled) return; // já liberamos o app; não sobrescrever estado

        if (error) {
          console.error('Erro ao verificar status de bloqueio:', error);
          if (!isCancelled) setIsChecking(false);
          return;
        }

        const activeEstablishments = Array.isArray(establishmentsData) ? establishmentsData : [];
        if (activeEstablishments.length === 0) {
          if (!isCancelled) setIsChecking(false);
          return;
        }

        // Regra defensiva: só bloqueia se TODOS os estabelecimentos ativos estiverem bloqueados.
        const shouldBlock = activeEstablishments.every((est) => Boolean((est as any)?.is_blocked));
        if (shouldBlock) {
          const target = (activeEstablishments[0] as any) || null;
          if (target?.id) {
            try {
              localStorage.setItem(
                'blocked_billing_target',
                JSON.stringify({
                  id: String(target.id),
                  name: String(target.name || 'Estabelecimento'),
                })
              );
            } catch {
              // noop
            }
          }
          if (isCancelled) return;
          setIsBlocked(true);
          navigate('/blocked', {
            state: target?.id
              ? {
                  establishmentId: String(target.id),
                  establishmentName: String(target.name || 'Estabelecimento'),
                }
              : undefined,
          });
          return;
        }

        try {
          localStorage.setItem(cacheKey, String(Date.now()));
        } catch {
          // noop
        }
        if (!isCancelled) setIsChecking(false);
      } catch (error) {
        if (!timeoutFired) {
          console.error('Erro ao verificar bloqueio:', error);
        }
        if (!isCancelled) setIsChecking(false);
      }
    };

    checkBlockedStatus();

    return () => {
      isCancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      abortController.abort();
    };
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
