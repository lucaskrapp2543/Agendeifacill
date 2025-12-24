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
          
          // Lista de códigos de países com validação de tamanho mínimo
          const countryCodes = [
            { code: '351', minLength: 12 }, // Portugal: 351 + 9 dígitos
            { code: '244', minLength: 12 }, // Angola: 244 + 9 dígitos  
            { code: '54', minLength: 12 },  // Argentina: 54 + 10 dígitos
            { code: '56', minLength: 11 },  // Chile: 56 + 9 dígitos
            { code: '55', minLength: 12 },  // Brasil: 55 + 2 DDD + 9 dígitos
            { code: '34', minLength: 11 },  // Espanha: 34 + 9 dígitos
            { code: '1', minLength: 11 }    // EUA/Canadá: 1 + 10 dígitos
          ];
          
          for (const { code, minLength } of countryCodes) {
            if (cleanWhatsapp.startsWith(code) && cleanWhatsapp.length >= minLength) {
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-md mx-auto overflow-hidden"
        style={{
          background: '#1A1A1A',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Phone className="w-5 h-5" style={{ color: '#E6C78B' }} />
            </div>
            <h2 className="text-xl font-extrabold" style={{ color: '#E6C78B' }}>Ver Meus Agendamentos</h2>
          </div>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: '#A1A1A1' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="rounded-2xl p-4" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-extrabold" style={{ color: '#E6C78B' }}>Acesso Rápido</p>
            <p className="text-xs mt-1" style={{ color: '#A1A1A1' }}>
              Informe apenas seu telefone para ver seus agendamentos
            </p>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
              Telefone com DDD *
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder={getPlaceholder()}
              className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E6C78B]/25"
              style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}
              required
              maxLength={countryCode === '351' ? 18 : 15}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLogin();
                }
              }}
            />
          </div>

          <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(230,199,139,0.06)', border: '1px solid rgba(230,199,139,0.16)' }}>
            <p className="text-xs" style={{ color: '#A1A1A1' }}>💡 O mesmo telefone usado no agendamento</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl transition-colors font-semibold hover:bg-white/5"
            style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)', color: '#A1A1A1' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleLogin}
            className="flex-1 px-4 py-3 rounded-xl transition-colors font-extrabold active:scale-[0.99]"
            style={{ background: '#E6C78B', color: '#0B0B0B' }}
          >
            Ver Agendamentos
          </button>
        </div>
      </div>
    </div>
  );
};
