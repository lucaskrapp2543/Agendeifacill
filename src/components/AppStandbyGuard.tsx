import React, { useEffect } from 'react';
import { isAppStandbyActive, setAppStandbyActive } from '../utils/appStandby';

export const AppStandbyGuard: React.FC = () => {
  // Standby desativado por usabilidade:
  // usuários alternam de aba para copiar informações e perdem contexto ao voltar.
  // Mantemos apenas a limpeza do estado global para evitar bloqueios residuais.
  useEffect(() => {
    if (isAppStandbyActive()) {
      setAppStandbyActive(false, 'manual');
    }
  }, []);

  return null;
};

