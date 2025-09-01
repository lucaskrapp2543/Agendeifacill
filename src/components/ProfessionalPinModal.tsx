import React, { useState, useEffect } from 'react';
import { useToast } from './ui/Toaster';
import { X } from 'lucide-react';

interface ProfessionalPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (pin: string) => void;
  professionalName: string;
}

const ProfessionalPinModal = ({ isOpen, onClose, onValidate, professionalName }: ProfessionalPinModalProps) => {
  const [pin, setPin] = useState('');
  const { toast } = useToast();

  // Limpa a senha quando o modal é fechado
  useEffect(() => {
    if (!isOpen) {
      setPin('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      onValidate(pin);
    } else {
      toast.error('A senha deve ter 4 dígitos');
    }
  };

  // Função para entrar sem senha (senha padrão 0000)
  const handleEnterWithoutPassword = () => {
    onValidate('0000');
  };

  const handleClose = () => {
    setPin('');
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">
          {professionalName === 'all' ? 'Senha das Configurações' : `Senha do Profissional: ${professionalName}`}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              SENHA PADRÃO 0000
            </label>
            <input
              type="password"
              value={pin}
              onChange={handlePinChange}
              maxLength={4}
              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="****"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            {/* Botão para entrar sem senha */}
            <button
              type="button"
              onClick={handleEnterWithoutPassword}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🚀 Entrar sem Senha (Padrão: 0000)
            </button>
            
            {/* Botões de ação */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
                disabled={pin.length !== 4}
              >
                Confirmar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfessionalPinModal; 