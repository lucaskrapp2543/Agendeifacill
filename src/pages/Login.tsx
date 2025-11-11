import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(true);
  const [saveCredentials, setSaveCredentials] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  // Carregar credenciais salvas do localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    const savedPassword = localStorage.getItem('saved_password');
    const savedCredentialsFlag = localStorage.getItem('save_credentials') === 'true';

    if (savedEmail && savedPassword && savedCredentialsFlag) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setSaveCredentials(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { user } = await signIn(email, password);

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

      // Se houver uma returnUrl no state, redireciona para ela. Caso contrário, para o dashboard do usuário.
      const returnUrl = location.state?.returnUrl;
      if (returnUrl) {
        navigate(returnUrl);
      } else if (user?.email === 'suporteagendeifacil@gmail.com') {
        navigate('/dashboard/admin');
      } else if (user?.user_metadata?.role) {
        navigate(`/dashboard/${user.user_metadata.role}`);
      } else {
        navigate('/'); // Redireciona para a home page como fallback
      }
      toast.success('Login realizado com sucesso!');

    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      toast.error(error.message || 'Email ou senha incorretos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101112] px-4">
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Como deseja acessar?</h2>
            <p className="text-gray-600 mb-6">Selecione uma opção para continuar</p>
            <div className="space-y-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Sou profissional (estabelecimento)
              </button>
              <button
                onClick={() => navigate('/view-appointments')}
                className="w-full px-4 py-3 rounded-lg bg-gray-100 text-gray-800 font-medium hover:bg-gray-200 transition-colors"
              >
                Sou cliente (ver meus agendamentos)
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="card max-w-md w-full">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-primary mb-6">
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
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
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field pr-10"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
            <div className="bg-blue-900/30 border-2 border-blue-500/50 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="flex items-center justify-center gap-3">
                <input
                  id="saveCredentials"
                  type="checkbox"
                  checked={saveCredentials}
                  onChange={(e) => setSaveCredentials(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="saveCredentials" className="text-sm sm:text-base text-blue-200 font-medium cursor-pointer">
                  ✅ Salvar login para acesso rápido
                </label>
              </div>
            </div>

            <Link
              to="/recovery-password"
              className="text-blue-400 hover:text-blue-300 text-sm block"
            >
              Esqueci minha senha
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex justify-center items-center"
          >
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
