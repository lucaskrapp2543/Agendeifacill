import { Phone, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface PhoneLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (phone: string) => void;
  establishmentCode?: string; // Código do estabelecimento para detectar DDD
  establishmentId?: string; // ID do estabelecimento como fallback
}

export const PhoneLoginModal: React.FC<PhoneLoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  establishmentCode,
  establishmentId
}) => {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState<string>('55'); // Padrão Brasil

  // Detectar código do país do estabelecimento
  useEffect(() => {
    const detectCountryCode = async () => {
      if (!establishmentCode && !establishmentId) {
        // Se não tem código nem ID, usar padrão Brasil
        setCountryCode('55');
        return;
      }

      try {
        let establishment = null;

        // Buscar por código primeiro (mais confiável)
        if (establishmentCode) {
          const { data, error } = await supabase
            .from('establishments')
            .select('whatsapp')
            .eq('code', establishmentCode)
            .limit(1);

          if (!error && data && data.length > 0) {
            establishment = data[0];
          }
        }

        // Se não encontrou por código, tentar por ID
        if (!establishment && establishmentId) {
          const { data, error } = await supabase
            .from('establishments')
            .select('whatsapp')
            .eq('id', establishmentId)
            .limit(1);

          if (!error && data && data.length > 0) {
            establishment = data[0];
          }
        }

        if (establishment?.whatsapp) {
          const cleanWhatsapp = establishment.whatsapp.replace(/\D/g, '');
          const countryCodes = ['351', '244', '54', '56', '55', '34', '1'];
          
          for (const code of countryCodes) {
            if (cleanWhatsapp.startsWith(code)) {
              setCountryCode(code);
              console.log('✅ DDD detectado do estabelecimento:', code);
              return;
            }
          }
        }

        // Se não conseguiu detectar, manter padrão Brasil
        setCountryCode('55');
      } catch (error) {
        console.error('Erro ao detectar DDD do estabelecimento:', error);
        setCountryCode('55');
      }
    };

    if (isOpen) {
      detectCountryCode();
    }
  }, [isOpen, establishmentCode, establishmentId]);

  if (!isOpen) return null;

  const handleLogin = () => {
    if (!phone.trim()) {
      toast.error('Por favor, informe seu telefone');
      return;
    }

    // Validar formato de telefone (básico)
    const phoneRegex = /^[\d\s\(\)\+\-\ ]+$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Por favor, informe um telefone válido');
      return;
    }

    onLogin(phone.trim());
  };

  const formatPhone = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Se for Portugal (351), formatar diferente
    if (countryCode === '351') {
      // Formato Portugal: +351 XXX XXX XXX ou 351 XXX XXX XXX
      if (numbers.startsWith('351')) {
        const rest = numbers.slice(3);
        if (rest.length <= 3) {
          return `+351 ${rest}`;
        } else if (rest.length <= 6) {
          return `+351 ${rest.slice(0, 3)} ${rest.slice(3)}`;
        } else {
          return `+351 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 9)}`;
        }
      } else {
        // Sem código do país, formatar apenas o número
        if (numbers.length <= 3) {
          return numbers;
        } else if (numbers.length <= 6) {
          return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
        } else {
          return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 9)}`;
        }
      }
    } else {
      // Formato Brasil: (XX) XXXXX-XXXX
      if (numbers.length <= 2) {
        return numbers;
      } else if (numbers.length <= 7) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      } else {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPhone(value);
    setPhone(formatted);
  };

  // Placeholder baseado no país
  const getPlaceholder = () => {
    if (countryCode === '351') {
      return '+351 XXX XXX XXX';
    }
    return '(00) 00000-0000';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-auto shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Ver Meus Agendamentos</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Acesso Rápido</strong>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Informe apenas seu telefone para ver seus agendamentos
            </p>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefone com DDD *
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder={getPlaceholder()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              required
              maxLength={countryCode === '351' ? 18 : 15}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLogin();
                }
              }}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mt-4">
            <p className="text-xs text-gray-600">
              💡 O mesmo telefone usado no agendamento
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleLogin}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Ver Agendamentos
          </button>
        </div>
      </div>
    </div>
  );
};
