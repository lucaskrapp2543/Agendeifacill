import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, UserPlus, LogIn } from 'lucide-react';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentName: string;
}

export function LoginRequiredModal({ isOpen, onClose, establishmentName }: LoginRequiredModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCreateAccount = () => {
    navigate('/register');
    onClose();
  };

  const handleLogin = () => {
    navigate('/login');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded-2xl max-w-xs sm:max-w-md w-full mx-1 sm:mx-4 shadow-2xl transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-3 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <h2 className="text-base sm:text-xl font-bold text-gray-900">Acesso Necessário</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6">
          <div className="text-center mb-3 sm:mb-6">
            <p className="text-gray-700 text-sm sm:text-lg leading-relaxed mb-2">
              Opa! Para agendar com
            </p>
            <p className="text-gray-700 text-sm sm:text-lg leading-relaxed mb-2">
              <span className="font-semibold text-blue-600">{establishmentName}</span>
            </p>
            <p className="text-gray-700 text-sm sm:text-lg leading-relaxed mb-3">
              você precisa criar uma conta ou fazer login.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
              <p className="text-blue-800 text-xs sm:text-sm leading-relaxed font-medium">
                ⚡ <strong>Não se preocupe:</strong> o cadastro é super rápido, leva apenas alguns cliques e você já volta para cá para concluir seu agendamento! 😉
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-2 sm:space-y-3">
            <button
              onClick={handleCreateAccount}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 px-3 sm:px-6 rounded-lg sm:rounded-xl transition-colors duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              Criar Conta
            </button>
            
            <button
              onClick={handleLogin}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 sm:py-3 px-3 sm:px-6 rounded-lg sm:rounded-xl transition-colors duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              Fazer Login
            </button>
          </div>

          {/* Footer */}
          <div className="mt-3 sm:mt-6 text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>Seus dados estão seguros conosco</span>
              <span className="text-orange-500">🔒</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
