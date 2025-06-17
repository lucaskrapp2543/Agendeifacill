import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signIn } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        throw error;
      }

      if (data && data.user) {
        const userRole = data.user.user_metadata?.role;
        console.log('🔑 Login bem sucedido:', {
          userId: data.user.id,
          userRole: userRole,
          metadata: data.user.user_metadata
        });
        
        // Redirecionar baseado no tipo de conta
        switch (userRole) {
          case 'establishment':
            toast.success('Login realizado com sucesso!');
            navigate('/dashboard/establishment', { replace: true });
            break;
          case 'premium':
            toast.success('Login realizado com sucesso!');
            navigate('/dashboard/premium', { replace: true });
            break;
          case 'client':
          default:
            toast.success('Login realizado com sucesso!');
            navigate('/dashboard/client', { replace: true });
            break;
        }
      } else {
        toast.error('Erro: usuário não encontrado');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101112] px-4">
      <div className="card max-w-md w-full">
        <Link to="/" className="inline-flex items-center text-gray-600 hover:text-primary mb-6">
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
            ENTRE OU CADASTRE-SE PARA AGENDAR COM SEU ESTABELECIMENTO
            <br />
            <span className="text-primary">Cadastro é super mega rápido</span>
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="********"
            />
          </div>

          <div className="text-center">
            <Link 
              to="/register?role=client" 
              state={{ from: location.state?.from }} 
              className="text-primary hover:underline font-medium"
            >
              Criar conta
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
