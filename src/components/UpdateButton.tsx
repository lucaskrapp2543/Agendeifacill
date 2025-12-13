import { CheckCircle, Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export const UpdateButton = () => {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'updating' | 'updated'>('idle');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  useEffect(() => {
    // NÃO verificar automaticamente ao entrar
    // Só verificar se já há uma atualização pendente
    checkForPendingUpdates();
  }, []);

  const checkForPendingUpdates = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;

        // Verificar se há service worker em espera (atualização já disponível)
        if (registration.waiting) {
          setHasUpdate(true);
          setUpdateStatus('available');
        }
      }
    } catch (error) {
      console.log('Erro ao verificar atualizações pendentes:', error);
    }
  };

  const handleUpdate = async () => {
    if (!hasUpdate) return;

    setUpdateStatus('updating');

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;

        if (registration.waiting) {
          // Enviar mensagem para o service worker em espera
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });

          // Aguardar um pouco e recarregar
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      setUpdateStatus('available');
    }
  };

  const handleCheckUpdates = async () => {
    console.log('🔄 Botão clicado! Verificando atualizações...');
    setUpdateStatus('checking');

    try {
      if ('serviceWorker' in navigator) {
        console.log('✅ Service Worker disponível');
        const registration = await navigator.serviceWorker.ready;
        console.log('📱 Service Worker registrado:', registration);

        // Forçar verificação de atualizações
        await registration.update();
        console.log('🔄 Verificação de atualizações concluída');

        // Aguardar um pouco para ver se há mudanças
        setTimeout(() => {
          checkForPendingUpdates();
          setUpdateStatus('idle');

          // 🔄 Recarregar a página após verificação (como F5)
          console.log('🔄 Recarregando página após verificação...');
          window.location.reload();
        }, 2000);
      } else {
        console.log('❌ Service Worker não disponível');
        setUpdateStatus('idle');

        // 🔄 Recarregar a página mesmo sem service worker (como F5)
        console.log('🔄 Recarregando página após verificação...');
        window.location.reload();
      }
    } catch (error) {
      console.error('❌ Erro ao verificar atualizações:', error);
      setUpdateStatus('idle');

      // 🔄 Recarregar a página mesmo em caso de erro (como F5)
      console.log('🔄 Recarregando página após verificação...');
      window.location.reload();
    }
  };

  // TEMPORARIAMENTE MOSTRAR EM DESENVOLVIMENTO PARA TESTE
  // if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  //   return null;
  // }

  return (
    <div className="fixed top-20 right-4 z-40">
      {updateStatus === 'idle' && (
        <button
          onClick={handleCheckUpdates}
          className="bg-black hover:bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors text-sm"
          title="Verificar Atualizações"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Verificar</span>
        </button>
      )}

      {updateStatus === 'checking' && (
        <button
          disabled
          className="bg-gray-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 cursor-not-allowed"
        >
          <RefreshCw className="w-4 h-4 animate-spin" />
          Verificando...
        </button>
      )}

      {updateStatus === 'available' && (
        <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Download className="w-4 h-4" />
          <span>Nova versão disponível!</span>
          <button
            onClick={handleUpdate}
            className="ml-2 bg-white text-green-600 px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors"
          >
            Atualizar
          </button>
        </div>
      )}

      {updateStatus === 'updating' && (
        <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Atualizando...
        </div>
      )}

      {updateStatus === 'updated' && (
        <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Atualizado com sucesso!
        </div>
      )}
    </div>
  );
};

export default UpdateButton;
