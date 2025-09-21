import React from 'react';
import { CheckCircle, MessageCircle } from 'lucide-react';

const RegistrationSuccess: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {/* Ícone de sucesso */}
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Parabéns!
          </h1>

          {/* Mensagem principal */}
          <p className="text-xl text-gray-700 mb-6 leading-relaxed">
            Agora você tem acesso ao sistema mais completo do Brasil.
          </p>


          {/* Botões de ação */}
          <div className="space-y-4">
            {/* Botão Ativar Conta */}
            <a
              href="https://wa.me/5548991265320?text=Quero%20ativar%20agora%20minha%20conta%20Agendei%20Fácil!"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-green-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <MessageCircle className="w-5 h-5" />
              Ativar minha conta
            </a>
          </div>

          {/* Informações adicionais */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">
              Tem alguma dúvida?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 text-sm">
              <a
                href="mailto:suporte@agendeifacil.com"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                suporte@agendeifacil.com
              </a>
              <span className="hidden sm:inline text-gray-400">•</span>
              <a
                href="tel:+5548991265320"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                (48) 9 91265320
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2024 Agendei Fácil. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationSuccess;
