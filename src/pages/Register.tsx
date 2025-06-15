import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/ui/Toaster';
import { signUp } from '../lib/supabase';
import { Calendar, ArrowLeft, User, Scissors, Star } from 'lucide-react';

type UserRole = 'client' | 'premium' | 'establishment';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [isLoading, setIsLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [hideRoleSelector, setHideRoleSelector] = useState(false);

  useEffect(() => {
    // Get role from URL query parameter
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role') as UserRole;
    
    if (roleParam && ['client', 'premium', 'establishment'].includes(roleParam)) {
      setRole(roleParam);
      // Se vier como cliente ou da página de login, ocultar seletor
      if (roleParam === 'client' || location.state?.from?.pathname === '/login') {
        setHideRoleSelector(true);
      }
    }
  }, [location.search, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast('As senhas não correspondem', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signUp(email, password, role, {
        full_name: fullName
      });
      
      if (error) {
        throw error;
      }

      toast('Conta criada com sucesso! Você já pode fazer login.', 'success');
      navigate('/login', { state: location.state });
    } catch (error: any) {
      toast(error.message || 'Erro ao criar conta', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRoleIcon = (selectedRole: UserRole) => {
    switch (selectedRole) {
      case 'client':
        return <User className="h-5 w-5" />;
      case 'premium':
        return <Star className="h-5 w-5" />;
      case 'establishment':
        return <Scissors className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#101112] flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para a página inicial
        </Link>
        
        <div className="flex justify-center mb-6">
          <Calendar className="h-10 w-10 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-8 text-white">Criar nova conta</h1>
        
        {!hideRoleSelector && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`px-4 py-2 text-sm font-medium border rounded-l-md flex items-center gap-2 ${
                  role === 'client'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <User className="h-4 w-4" />
                Cliente
              </button>
              <button
                type="button"
                onClick={() => setRole('premium')}
                className={`px-4 py-2 text-sm font-medium border-t border-b flex items-center gap-2 ${
                  role === 'premium'
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Star className="h-4 w-4" />
                Premium
              </button>
              <button
                type="button"
                onClick={() => setRole('establishment')}
                className={`px-4 py-2 text-sm font-medium border rounded-r-md flex items-center gap-2 ${
                  role === 'establishment'
                    ? 'bg-secondary text-white border-secondary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Scissors className="h-4 w-4" />
                Estabelecimento
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-400 mb-1">
              Nome completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="input-field"
              placeholder="Seu nome completo"
            />
          </div>
          
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="********"
              minLength={6}
            />
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input-field"
              placeholder="********"
              minLength={6}
            />
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center items-center gap-2 ${
                role === 'client'
                  ? 'btn-primary'
                  : role === 'premium'
                  ? 'bg-accent text-white py-2 px-4 rounded-md hover:bg-accent/90 transition-all duration-200 font-medium'
                  : 'btn-secondary'
              }`}
            >
              {isLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <>
                  {renderRoleIcon(role)}
                  <span>
                    Criar conta
                    {role === 'client' && ' Cliente'}
                    {role === 'premium' && ' Premium'}
                    {role === 'establishment' && ' Estabelecimento'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;