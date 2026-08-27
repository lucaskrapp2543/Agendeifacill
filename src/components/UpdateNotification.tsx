import { AlertTriangle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { UpdateInfo, applyUpdate, checkForUpdates, getCurrentVersion, setStoredVersion, shouldShowV30UpdatePrompt } from '../utils/versionManager';

interface UpdateNotificationProps {
  className?: string;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ className = '' }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Refs para evitar loops (não causam re-renders)
  const lastNotifiedVersionRef = useRef<string | null>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // Sincronizar ref com state
    isUpdatingRef.current = isUpdating;

    // Verificar atualizações ao carregar
    const checkUpdates = () => {
      const info = checkForUpdates();

      // ⚠️ PROTEÇÃO: Só mostrar se realmente há atualização E não foi notificado recentemente
      if (info.hasUpdate) {
        // Se já notificamos esta versão, não mostrar novamente (evita loop)
        if (lastNotifiedVersionRef.current === info.newVersion) {
          console.log('🔇 Atualização já foi notificada, ignorando...');
          return;
        }

        // Verificar se versões são realmente diferentes (proteção extra)
        if (info.currentVersion === info.newVersion) {
          console.warn('⚠️ Versões iguais detectadas como atualização, ignorando...');
          return;
        }

        lastNotifiedVersionRef.current = info.newVersion;
        setUpdateInfo(info);
        setIsVisible(true);

        // Se for atualização obrigatória, mostrar IMEDIATAMENTE
        if (info.forceUpdate) {
          setIsVisible(true);
        }
      } else {
        // Se não há atualização, limpar flag e ocultar
        if (lastNotifiedVersionRef.current) {
          console.log('✅ Sem atualizações, limpando notificação...');
          lastNotifiedVersionRef.current = null;
          setIsVisible(false);
        }
      }
    };

    // Verificar imediatamente apenas UMA vez
    checkUpdates();

    // Escutar eventos de atualização
    const handleUpdateAvailable = (event: CustomEvent) => {
      const info = event.detail as UpdateInfo;

      // Proteção: verificar se realmente há atualização
      if (!info.hasUpdate) {
        return;
      }

      // Proteção: evitar notificar a mesma versão novamente
      if (lastNotifiedVersionRef.current === info.newVersion) {
        console.log('🔇 Atualização já foi notificada via evento, ignorando...');
        return;
      }

      // Verificar se versões são realmente diferentes
      if (info.currentVersion === info.newVersion) {
        console.warn('⚠️ Versões iguais detectadas como atualização, ignorando...');
        return;
      }

      lastNotifiedVersionRef.current = info.newVersion;
      setUpdateInfo(info);
      setIsVisible(true);

      // Se for obrigatória, não permitir fechar
      if (info.forceUpdate) {
        setIsVisible(true);
      }
    };

    window.addEventListener('app-update-available', handleUpdateAvailable as EventListener);

    // ⚠️ CANAL QUE NINGUÉM ESCUTAVA (corrigido em 27/08/2026).
    // O Service Worker (serviceWorker.ts) e o CacheBuster disparam 'sw-update-available'
    // quando detectam build nova instalada — mas este componente só escutava
    // 'app-update-available'. Resultado: metade das detecções de versão nova morria no
    // caminho, e usuários seguiam presos em builds antigas mesmo depois de vários deploys.
    // Aqui o evento do Service Worker é traduzido para o mesmo fluxo do aviso.
    const handleSwUpdate = () => {
      // Pergunta ao versionManager qual é a versão nova (o evento do SW não traz isso).
      void checkUpdates();
    };
    window.addEventListener('sw-update-available', handleSwUpdate as EventListener);

    // Verificar periodicamente (a cada 5 MINUTOS) - reduzido de 10 segundos para evitar reloads constantes
    const interval = setInterval(() => {
      // Só verificar se não está atualizando
      if (!isUpdatingRef.current) {
        checkUpdates();
      }
    }, 5 * 60 * 1000); // 5 minutos em vez de 10 segundos

    // Verificar ao VOLTAR para a aba/app. O intervalo acima só roda com a página em
    // primeiro plano; PWA minimizado ou aba de fundo fica congelado pelo navegador.
    // Sem isto, quem deixa o app aberto em segundo plano por dias só descobre a versão
    // nova por acaso — foi assim que sobraram usuários presos em builds antigas.
    const handleVisibilidade = () => {
      if (document.visibilityState === 'visible' && !isUpdatingRef.current) {
        void checkUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilidade);

    return () => {
      window.removeEventListener('app-update-available', handleUpdateAvailable as EventListener);
      window.removeEventListener('sw-update-available', handleSwUpdate as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilidade);
      clearInterval(interval);
    };
  }, [isUpdating]); // Apenas isUpdating como dependência (sincroniza ref)

  const handleUpdate = async () => {
    // Prevenir múltiplos cliques
    if (isUpdating || isUpdatingRef.current) {
      return;
    }

    setIsUpdating(true);
    isUpdatingRef.current = true;

    // Limpar flag de notificação para permitir nova verificação após atualizar
    lastNotifiedVersionRef.current = null;

    try {
      console.log('🔄 Iniciando processo de atualização...');

      // Mostrar feedback visual
      const button = document.querySelector('button[disabled]');
      if (button) {
        button.textContent = 'Atualizando... Aguarde';
      }

      // ⚠️ IMPORTANTE: Salvar versão ANTES de aplicar atualização para evitar loop
      const currentVersion = getCurrentVersion();
      setStoredVersion(currentVersion);

      // Aguardar um pouco para garantir que foi salvo
      await new Promise(resolve => setTimeout(resolve, 500));

      // Aplicar atualização (já faz limpeza internamente com delays adequados)
      await applyUpdate();

      // ⚠️ PROTEÇÃO: Não fazer reload automático aqui - deixar applyUpdate fazer isso
      // Removido o setTimeout que poderia causar reload duplo
    } catch (error) {
      console.error('❌ Erro ao aplicar atualização:', error);

      // Em caso de erro, garantir que versão está salva antes de recarregar
      const currentVersion = getCurrentVersion();
      setStoredVersion(currentVersion);

      // Aguardar antes de recarregar
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Recarregar apenas uma vez
      window.location.href = window.location.href.split('?')[0];
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);

    // Se for atualização forçada, não permitir fechar
    if (updateInfo?.forceUpdate) {
      setTimeout(() => {
        setIsVisible(true);
      }, 100);
    }
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  // Nunca mostrar notificações de update em páginas públicas
  if (!window.location.pathname.startsWith('/dashboard')) {
    return null;
  }

  if (shouldShowV30UpdatePrompt()) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center shadow-xl">
        <div className="flex justify-center mb-4">
          {updateInfo.forceUpdate ? (
            <AlertTriangle className="text-orange-500" size={48} />
          ) : (
            <CheckCircle className="text-green-500" size={48} />
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {updateInfo.forceUpdate ? 'Atualização Obrigatória' : 'Nova Versão Disponível'}
        </h3>

        <p className="text-gray-600 mb-4">
          {updateInfo.forceUpdate
            ? 'Uma atualização importante está disponível e é necessária para o funcionamento correto da aplicação.'
            : 'Uma nova versão da aplicação está disponível com melhorias e correções.'
          }
        </p>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Versão atual:</span>
            <span className="font-mono text-gray-800">{updateInfo.currentVersion}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-600">Nova versão:</span>
            <span className="font-mono text-green-600 font-semibold">{updateInfo.newVersion}</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${updateInfo.forceUpdate
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-primary text-white hover:bg-primary/90'
              } disabled:opacity-50`}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Atualizando...
              </>
            ) : (
              <>
                <Download size={16} />
                {updateInfo.forceUpdate ? 'Atualizar Agora' : 'Atualizar'}
              </>
            )}
          </button>

          {!updateInfo.forceUpdate && (
            <button
              onClick={handleDismiss}
              className="w-full py-2 px-4 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Atualizar Depois
            </button>
          )}
        </div>

        {updateInfo.forceUpdate && (
          <p className="text-xs text-orange-600 mt-3">
            Esta atualização é obrigatória para continuar usando a aplicação.
          </p>
        )}
      </div>
    </div>
  );
};