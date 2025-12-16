import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkForUpdates, forceCompleteCleanup, getCurrentVersion, setStoredVersion } from '../utils/versionManager';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [showUpdateButton, setShowUpdateButton] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, isLoading: authLoading } = useAuth();
  const [hasNavigated, setHasNavigated] = useState(false);

  // Função para ler cookies
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  // Verificar se usuário já está logado e redirecionar
  useEffect(() => {
    if (!authLoading && user && !hasNavigated) {
      const returnUrl = location.state?.returnUrl;
      if (returnUrl) {
        setHasNavigated(true);
        navigate(returnUrl, { replace: true });
        return;
      } else if (user?.email === 'suporteagendeifacil@gmail.com') {
        setHasNavigated(true);
        navigate('/dashboard/admin', { replace: true });
        return;
      } else if (user?.user_metadata?.role) {
        setHasNavigated(true);
        navigate(`/dashboard/${user.user_metadata.role}`, { replace: true });
        return;
      }
    }
  }, [user, authLoading, navigate, location.state, hasNavigated]);

  // Verificar versão e forçar limpeza se necessário
  useEffect(() => {
    const checkVersionAndCleanup = async () => {
      try {
        const updateInfo = checkForUpdates();

        // Se há atualização obrigatória, forçar limpeza completa
        if (updateInfo.hasUpdate && updateInfo.forceUpdate) {
          console.log('⚠️ Versão antiga detectada, forçando limpeza completa...');
          toast.loading('Atualizando sistema...', { id: 'update' });

          // Salvar versão atual ANTES de limpar
          const currentVersion = getCurrentVersion();
          setStoredVersion(currentVersion);

          // Aguardar um pouco para garantir que versão foi salva
          await new Promise(resolve => setTimeout(resolve, 500));

          // Forçar limpeza completa
          await forceCompleteCleanup();

          toast.success('Sistema atualizado! Recarregando...', { id: 'update' });

          // Recarregar página após limpeza
          setTimeout(() => {
            window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
          }, 1000);

          return;
        }
      } catch (error) {
        console.error('Erro ao verificar versão:', error);
      }
    };

    checkVersionAndCleanup();
  }, []);

  // Carregar credenciais salvas do localStorage
  useEffect(() => {
    // Só carregar se não estiver logado
    if (authLoading || user) return;

    const savedEmail = localStorage.getItem('saved_email');
    const savedPassword = localStorage.getItem('saved_password');
    const savedCredentialsFlag = localStorage.getItem('save_credentials') === 'true';

    if (savedEmail && savedPassword && savedCredentialsFlag) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setSaveCredentials(true);
    }

    // Verificar se o botão de atualizar sistema já foi usado (verifica cookie)
    const systemUpdated = getCookie('system_updated') || localStorage.getItem('system_updated');
    if (!systemUpdated) {
      setShowUpdateButton(true);
    }
  }, [authLoading, user]);

  const handleUpdateSystem = async () => {
    try {
      setIsLoading(true);
      toast.loading('Limpando cache e atualizando sistema...', { id: 'cleanup' });

      // Salvar versão atual ANTES de limpar
      const currentVersion = getCurrentVersion();
      setStoredVersion(currentVersion);

      // Aguardar para garantir que versão foi salva
      await new Promise(resolve => setTimeout(resolve, 500));

      // Usar função de limpeza completa
      await forceCompleteCleanup();

      // Marcar que o sistema foi atualizado (usando cookie que persiste)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 10); // Cookie válido por 10 anos
      document.cookie = `system_updated=true; expires=${expiryDate.toUTCString()}; path=/`;

      toast.success('Sistema atualizado! Recarregando...', { id: 'cleanup' });

      // Recarregar a página após um pequeno delay
      setTimeout(() => {
        window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
      }, 1000);
    } catch (error) {
      console.error('Erro ao atualizar sistema:', error);
      toast.error('Erro ao atualizar sistema', { id: 'cleanup' });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevenir múltiplos submits
    if (isLoading || hasNavigated) {
      return;
    }

    setIsLoading(true);

    try {
      const { user: loggedUser } = await signIn(email, password);

      if (!loggedUser) {
        throw new Error('Falha ao fazer login');
      }

      // Salvar credenciais se o checkbox estiver marcado
      if (saveCredentials) {
        localStorage.setItem('saved_email', email);
        localStorage.setItem('saved_password', password);
        localStorage.setItem('save_credentials', 'true');
      } else {
        // Limpar credenciais salvas se o checkbox não estiver marcado
        localStorage.removeItem('saved_email');
        localStorage.removeItem('saved_password');
        localStorage.removeItem('save_credentials');
      }

      // Marcar que já navegou para evitar navegação duplicada
      setHasNavigated(true);

      // Se houver uma returnUrl no state, redireciona para ela. Caso contrário, para o dashboard do usuário.
      const returnUrl = location.state?.returnUrl;
      if (returnUrl) {
        navigate(returnUrl, { replace: true });
      } else if (loggedUser?.email === 'suporteagendeifacil@gmail.com') {
        navigate('/dashboard/admin', { replace: true });
      } else if (loggedUser?.user_metadata?.role) {
        navigate(`/dashboard/${loggedUser.user_metadata.role}`, { replace: true });
      } else {
        navigate('/', { replace: true }); // Redireciona para a home page como fallback
      }

      toast.success('Login realizado com sucesso!');

    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      toast.error(error.message || 'Email ou senha incorretos');
      setIsLoading(false);
      setHasNavigated(false); // Permitir tentar novamente em caso de erro
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative">
      <div className="bg-black rounded-lg shadow-lg border border-gray-700 max-w-md w-full relative z-0 p-6">
        <Link
          to="/"
          className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para a página inicial
        </Link>

        <div className="mb-8 text-center">
          <img
            src="/logologin.png"
            alt="Logo"
            className="h-32 w-auto mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-white mb-2">Login</h1>
          <p className="text-gray-300 text-sm">
            Você está fazendo login como estabelecimento
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" onClick={(e) => e.stopPropagation()}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                e.stopPropagation();
                setEmail(e.target.value);
              }}
              onFocus={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              required
              disabled={isLoading}
              className="w-full px-4 py-2 bg-black border border-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 disabled:opacity-50"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  e.stopPropagation();
                  setPassword(e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                required
                disabled={isLoading}
                className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 pr-10 disabled:opacity-50"
                placeholder="********"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowPassword(!showPassword);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="text-center space-y-3">
            {/* Checkbox de salvar credenciais - Destacado */}
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="flex items-center justify-center gap-3">
                <input
                  id="saveCredentials"
                  type="checkbox"
                  checked={saveCredentials}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSaveCredentials(e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-600 rounded cursor-pointer"
                />
                <label
                  htmlFor="saveCredentials"
                  className="text-sm sm:text-base text-blue-200 font-medium cursor-pointer"
                >
                  ✅ Salvar login para acesso rápido
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              'Logar como Estabelecimento'
            )}
          </button>

          <div className="text-center mt-3">
            <Link
              to="/recovery-password"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Esqueci minha senha
            </Link>
          </div>
        </form>

        {/* Botão Sou Cliente */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <button
            type="button"
            onClick={() => navigate('/view-appointments')}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium flex justify-center items-center"
          >
            Sou Cliente
          </button>
        </div>

        <div className="text-center mt-4 space-y-3">
          {/* Botão de Emergência - Limpeza Completa */}
          <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
            <button
              type="button"
              onClick={handleUpdateSystem}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm flex justify-center items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isLoading ? 'Limpando...' : 'Limpar Cache e Atualizar'}
            </button>
          </div>
        </div>

        {/* Botão de Atualizar Sistema - Aparece apenas uma vez */}
        {showUpdateButton && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={handleUpdateSystem}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Atualizar Sistema
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
