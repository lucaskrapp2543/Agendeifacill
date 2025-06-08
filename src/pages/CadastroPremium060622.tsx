import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/Toaster';
import { signUp } from '../lib/supabase';
import { Star, ArrowLeft } from 'lucide-react';

const CadastroPremium060622 = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast('As senhas não correspondem', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signUp(email, password, 'premium', {
        full_name: fullName
      });
      
      if (error) {
        throw error;
      }

      toast('Conta Premium criada com sucesso! Você já pode fazer login.', 'success');
      navigate('/login');
    } catch (error: any) {
      toast(error.message || 'Erro ao criar conta', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101112] flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <Link to="/suporte060622" className="inline-flex items-center text-gray-400 hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para o suporte
        </Link>
        
        <div className="flex justify-center mb-6">
          <div className="bg-accent/10 p-3 rounded-full">
            <Star className="h-10 w-10 text-accent" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-8 text-white">Criar Conta Premium</h1>
        
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
              className="w-full bg-accent text-white py-2 px-4 rounded-md hover:bg-accent/90 transition-all duration-200 font-medium flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <>
                  <Star className="h-5 w-5" />
                  <span>Criar Conta Premium</span>
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

export default CadastroPremium060622; 