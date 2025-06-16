import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/ui/Toaster';
import { signIn } from '../lib/supabase';
import { Calendar, ArrowLeft } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
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
        if (userRole) {
          toast('Login realizado com sucesso!', 'success');
          
          // Verificar se há uma página anterior para redirecionar
          const from = (location.state as any)?.from?.pathname || `/dashboard/${userRole}`;
          navigate(from, { replace: true });
        } else {
          toast('Erro: tipo de conta não identificado.', 'error');
        }
      }
    } catch (error: any) {
      toast(error.message || 'Erro ao fazer login', 'error');
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
        
        <div className="flex justify-center mb-6">
          <Calendar className="h-10 w-10 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-8">Login</h1>
        
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
