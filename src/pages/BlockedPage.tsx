import { ArrowLeft, Lock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BlockedPage = () => {
  const navigate = useNavigate();

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent('Olá, quero deixar meu agendei fácil em dia.');
    const whatsappUrl = `https://wa.me/48991265320?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Ícone de bloqueio */}
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-red-600" />
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Sistema Bloqueado
        </h1>

        {/* Mensagem */}
        <p className="text-gray-600 mb-4 leading-relaxed">
          Seu sistema foi bloqueado por falta de pagamento.
          Para continuar utilizando nossos serviços, entre em contato conosco.
        </p>

        {/* Mensagem destacada */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <p className="text-green-800 font-semibold text-center">
            Não se preocupe, os clientes ainda conseguem agendar com você
          </p>
        </div>

        {/* Botão do WhatsApp */}
        <button
          onClick={handleWhatsAppClick}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3 mb-4"
        >
          <MessageCircle className="h-5 w-5" />
          <span>Clique aqui para atualizar seu pagamento</span>
        </button>

        {/* Botão voltar */}
        <button
          onClick={handleGoBack}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao início</span>
        </button>

        {/* Informações adicionais */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Em caso de dúvidas, entre em contato pelo WhatsApp: (48) 99126-5320
          </p>
        </div>
      </div>
    </div>
  );
};

export default BlockedPage;
