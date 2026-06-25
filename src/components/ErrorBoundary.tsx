import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRecovering: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Erro capturado pelo Error Boundary:', error);
    console.error('📋 Detalhes do erro:', errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log do erro para monitoramento (pode enviar para serviço de monitoramento)
    if (window.location.hostname !== 'localhost') {
      // Aqui você pode enviar para um serviço de monitoramento
      console.error('Erro em produção:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    }

    // 🔄 RECUPERAÇÃO AUTOMÁTICA: Detectar se é erro relacionado a cache/module loading
    // ⚠️ PROTEÇÃO: Desabilitar recuperação automática para evitar loops de reload
    // O usuário deve clicar manualmente para evitar reloads constantes
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStack = error.stack?.toLowerCase() || '';
    const isCacheRelated =
      errorMessage.includes('chunk') ||
      errorMessage.includes('loading') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('networkerror') ||
      errorMessage.includes('404') ||
      errorMessage.includes('module') ||
      errorMessage.includes('import') ||
      errorStack.includes('chunk') ||
      errorStack.includes('loading');

    // ⚠️ DESABILITADO: Recuperação automática pode causar loops de reload
    // Deixar o usuário clicar manualmente no botão
    // if (isCacheRelated && this.state.retryCount === 0) {
    //   console.log('🔄 Erro relacionado a cache detectado, mas recuperação automática desabilitada para evitar loops...');
    // }
  }

  handleRetry = () => {
    // Limpar estado de erro
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: this.state.retryCount + 1,
    });

    // Limpar cache se necessário
    if (this.state.retryCount >= 2) {
      console.log('🔄 Múltiplas tentativas, limpando cache...');
      this.clearCache();
    }

    // Forçar reload se muitas tentativas
    if (this.state.retryCount >= 3) {
      console.log('🔄 Muitas tentativas, recarregando página...');
      window.location.reload();
    }
  };

  clearCache = async () => {
    try {
      // Limpar caches (manter SW registrado para PWA)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Limpar sessionStorage
      sessionStorage.clear();

      console.log('✅ Cache limpo com sucesso');
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
    }
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    if (this.state.hasError) {
      // Se houver um fallback customizado, usar ele
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback padrão
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            {this.state.isRecovering ? (
              <>
                <div className="text-6xl mb-4 animate-spin">🔄</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Recuperando automaticamente...
                </h1>
                <p className="text-gray-600 mb-6">
                  Detectamos um problema de cache e estamos corrigindo automaticamente.
                  A página será recarregada em instantes.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">⚠️</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Ops! Algo deu errado
                </h1>
                <p className="text-gray-600 mb-6">
                  Ocorreu um erro ao carregar a página. Isso pode ser causado por:
                </p>
                <ul className="text-left text-sm text-gray-600 mb-6 space-y-2">
                  <li>• Cache desatualizado</li>
                  <li>• Problema de conexão</li>
                  <li>• Erro temporário do servidor</li>
                </ul>
              </>
            )}
            {!this.state.isRecovering && (
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => {
                    this.clearCache();
                    window.location.reload();
                  }}
                  className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Limpar Cache e Recarregar
                </button>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="w-full text-blue-600 py-2 px-4 hover:text-blue-700 font-medium"
                >
                  Voltar ao Início
                </button>
              </div>
            )}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

