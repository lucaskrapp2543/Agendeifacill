import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const RecoveryPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const enviarWhatsappSuporte = (emailDigitado: string) => {
    const emailTrim = String(emailDigitado || '').trim();
    if (!emailTrim) return;

    const phone = '5548991265320'; // +55 48 99126-5320
    const message = `ola, esqueci minha senha desejo mudar, e o email é (${emailTrim})`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('🔄 Enviando email de recuperação para:', email);
      console.log('📍 URL de redirecionamento:', `${window.location.origin}/reset-password`);
      
      // Garantir que a URL seja absoluta e correta
      const redirectUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5173/reset-password'
        : 'https://agendeifacil.com/reset-password';
        
      console.log('🔗 URL de redirecionamento final:', redirectUrl);
      console.log('🌐 Hostname atual:', window.location.hostname);
      console.log('🔗 Origin atual:', window.location.origin);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }

      console.log('✅ Email enviado com sucesso!');
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');

      // Além do e-mail, enviar também uma mensagem para o suporte via WhatsApp
      enviarWhatsappSuporte(email);
      setEmail('');
    } catch (error: any) {
      console.error('❌ Erro geral:', error);
      toast.error(error.message || 'Erro ao enviar email de recuperação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="bg-gray-900 p-8 rounded-lg max-w-md w-full border border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
          <p className="text-gray-400 mt-2">
            Digite seu email e enviaremos um link para redefinir sua senha
          </p>
        </div>
        
        <form onSubmit={handleRecovery}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Email da sua conta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              placeholder="seu@email.com"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enviando...' : 'Enviar Email de Recuperação'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link 
            to="/login" 
            className="text-blue-400 hover:text-blue-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RecoveryPassword;
