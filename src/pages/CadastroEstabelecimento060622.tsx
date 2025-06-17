import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signUp, signIn } from '../lib/supabase';
import { Scissors, ArrowLeft } from 'lucide-react';

const CadastroEstabelecimento060622 = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não correspondem');
      return;
    }

    setIsLoading(true);

    try {
      // Criar a conta
      const { data: signUpData, error: signUpError } = await signUp(email, password, 'establishment', {
        full_name: fullName
      });
      
      if (signUpError) {
        throw signUpError;
      }

      // Fazer login automaticamente
      const { data: signInData, error: signInError } = await signIn(email, password);
      
      if (signInError) {
        throw signInError;
      }

      if (signInData && signInData.user) {
        toast.success('Conta criada com sucesso!');
        navigate('/dashboard/establishment', { replace: true });
      } else {
        throw new Error('Erro ao fazer login automático');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container-custom py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-white hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
          <span>Voltar</span>
        </Link>

        <div className="max-w-md mx-auto mt-8 p-6 bg-[#101112] rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Scissors className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-white">Cadastro de Estabelecimento</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1">
                Nome do Estabelecimento
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input-field"
                placeholder="Nome do seu estabelecimento"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirmar Senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-field"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex justify-center items-center"
            >
              {isLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                'Criar Conta'
              )}
            </button>

            <div className="text-center text-gray-400">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Faça login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CadastroEstabelecimento060622; 