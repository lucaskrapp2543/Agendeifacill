import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const RecoveryPassword = () => {
  const [email, setEmail] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supportPhone = '5548991265320';
      const message =
        'Quero trocar a senha.\n' +
        `Nome do estabelecimento: ${establishmentName.trim()}\n` +
        `Email: ${email.trim()}`;

      const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      toast.success('Abrindo WhatsApp para solicitar troca de senha.');
      setEmail('');
      setEstablishmentName('');
    } catch (error: any) {
      console.error('❌ Erro geral:', error);
      toast.error(error.message || 'Erro ao abrir WhatsApp');
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
            Informe os dados abaixo para abrir uma solicitação no WhatsApp do suporte
          </p>
        </div>
        
        <form onSubmit={handleRecovery}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Nome do estabelecimento
            </label>
            <input
              type="text"
              value={establishmentName}
              onChange={(e) => setEstablishmentName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              placeholder="Nome da barbearia"
              required
            />
          </div>

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
            {isLoading ? 'Abrindo...' : 'Solicitar troca de senha no WhatsApp'}
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
