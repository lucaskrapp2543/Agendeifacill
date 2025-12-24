import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (name: string, phone: string) => void;
  establishmentName: string;
  establishmentWhatsapp?: string; // WhatsApp do estabelecimento para detectar código de país
}

export const QuickBookingModal: React.FC<QuickBookingModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  establishmentName,
  establishmentWhatsapp
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Detectar código de país do estabelecimento e pré-preencher
  useEffect(() => {
    if (isOpen) {
      // Limpar campos quando modal abrir
      setName('');
      setPhone('');

      if (establishmentWhatsapp) {
        // Limpar e pegar apenas números
        const cleanWhatsapp = establishmentWhatsapp.replace(/\D/g, '');

        // Se for Brasil (começa com 55), não pré-preencher nada
        if (cleanWhatsapp.startsWith('55')) {
          // Deixa o usuário digitar normalmente
          return;
        }

        // Lista de códigos de países comuns (ordenado por tamanho, maior primeiro)
        // Códigos de 3 dígitos devem vir primeiro para evitar false positives
        const countryCodes = [
          { code: '351', minLength: 12 }, // Portugal: 351 + 9 dígitos
          { code: '244', minLength: 12 }, // Angola: 244 + 9 dígitos  
          { code: '54', minLength: 12 },  // Argentina: 54 + 10 dígitos
          { code: '56', minLength: 11 },  // Chile: 56 + 9 dígitos
          { code: '34', minLength: 11 },  // Espanha: 34 + 9 dígitos
          { code: '1', minLength: 11 }    // EUA/Canadá: 1 + 10 dígitos
        ];

        // Verificar se começa com algum código de país E tem tamanho apropriado
        for (const { code, minLength } of countryCodes) {
          if (cleanWhatsapp.startsWith(code) && cleanWhatsapp.length >= minLength) {
            // Encontrou o código de país válido, pré-preencher no campo
            const dialCode = `+${code} `;
            setPhone(dialCode);
            break;
          }
        }
      }
    }
  }, [isOpen, establishmentWhatsapp]);

  // Bloquear scroll quando modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      // Salvar o scroll atual
      const scrollY = window.scrollY;

      // Bloquear scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restaurar scroll quando modal fechar
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (!name.trim()) {
      toast.error('Por favor, informe seu nome');
      return;
    }

    if (!phone.trim()) {
      toast.error('Por favor, informe seu telefone');
      return;
    }

    // Validar formato de telefone (aceita código de país com +)
    const phoneRegex = /^[\+\d\s\(\)\-]+$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Por favor, informe um telefone válido');
      return;
    }

    // Fechar modal primeiro
    onContinue(name.trim(), phone.trim());

    // Scroll para a seção de agendamento após um pequeno delay
    setTimeout(() => {
      // Procurar por elementos que podem ser a seção de agendamento
      const appointmentSection = document.querySelector('[data-appointment-section]') ||
        document.querySelector('.appointment-form') ||
        document.querySelector('#appointment-form') ||
        document.querySelector('.booking-form');

      if (appointmentSection) {
        appointmentSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } else {
        // Se não encontrar seção específica, scroll para o final da página
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const formatPhone = (value: string) => {
    // Verificar se começa com código de país (ex: +351, +55)
    const countryCodeMatch = value.match(/^(\+\d{1,3})\s*(.*)$/);

    if (countryCodeMatch) {
      const countryCode = countryCodeMatch[1]; // +351 ou +55
      const restOfNumber = countryCodeMatch[2].replace(/\D/g, ''); // Apenas números depois do código

      // Formatar o resto do número baseado no código de país
      if (countryCode === '+55') {
        // Brasil: (+55) (11) 99999-9999
        if (restOfNumber.length <= 2) {
          return `${countryCode} (${restOfNumber}`;
        } else if (restOfNumber.length <= 7) {
          return `${countryCode} (${restOfNumber.slice(0, 2)}) ${restOfNumber.slice(2)}`;
        } else if (restOfNumber.length <= 11) {
          return `${countryCode} (${restOfNumber.slice(0, 2)}) ${restOfNumber.slice(2, 7)}-${restOfNumber.slice(7, 11)}`;
        } else {
          return `${countryCode} (${restOfNumber.slice(0, 2)}) ${restOfNumber.slice(2, 7)}-${restOfNumber.slice(7, 11)}`;
        }
      } else {
        // Outros países: (+351) 964 272 201
        if (restOfNumber.length === 0) {
          return `${countryCode} `;
        } else if (restOfNumber.length <= 3) {
          return `${countryCode} ${restOfNumber}`;
        } else if (restOfNumber.length <= 6) {
          return `${countryCode} ${restOfNumber.slice(0, 3)} ${restOfNumber.slice(3)}`;
        } else {
          return `${countryCode} ${restOfNumber.slice(0, 3)} ${restOfNumber.slice(3, 6)} ${restOfNumber.slice(6, 9)}`;
        }
      }
    }

    // Se não tiver código de país, formatar como antes (formato brasileiro)
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPhone(value);
    setPhone(formatted);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-md mx-auto max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          background: '#1A1A1A',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
        }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center p-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-lg font-extrabold" style={{ color: '#E6C78B' }}>
            Finalizar Agendamento
          </h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: '#A1A1A1' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollável */}
        <div className="overflow-y-auto flex-1">
          <div className="p-4 space-y-3">
            <div
              className="rounded-2xl p-4"
              style={{
                background: '#151515',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <p className="text-sm" style={{ color: '#A1A1A1' }}>
                <span className="font-semibold" style={{ color: '#E6C78B' }}>
                  Agendamento para:
                </span>{' '}
                <span className="text-white">{establishmentName}</span>
              </p>
              <p className="text-xs mt-2" style={{ color: '#A1A1A1' }}>
                Informe seus dados para prosseguir com o agendamento
              </p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-semibold mb-2" style={{ color: '#A1A1A1' }}>
                Nome Completo *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E6C78B]/25"
                style={{
                  background: '#151515',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
                required
              />
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
                placeholder={(() => {
                  if (!establishmentWhatsapp) return "(00) 00000-0000";
                  const cleanWhatsapp = establishmentWhatsapp.replace(/\D/g, '');
                  // Verificar qual país é baseado no código
                  if (cleanWhatsapp.startsWith('351')) return "Ex: +351 964 272 201";
                  if (cleanWhatsapp.startsWith('55')) return "Ex: (11) 99999-9999";
                  if (cleanWhatsapp.startsWith('34')) return "Ex: +34 612 345 678";
                  if (cleanWhatsapp.startsWith('1')) return "Ex: +1 (555) 123-4567";
                  return "(00) 00000-0000";
                })()}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E6C78B]/25"
                style={{
                  background: '#151515',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
                required
                maxLength={20}
                onFocus={(e) => {
                  // Scroll para o input quando ganhar foco
                  setTimeout(() => {
                    e.target.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'nearest'
                    });
                  }, 300);
                }}
              />
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(230,199,139,0.06)',
                border: '1px solid rgba(230,199,139,0.16)'
              }}
            >
              <p className="text-xs" style={{ color: '#A1A1A1' }}>
                💡 <span className="font-semibold" style={{ color: '#E6C78B' }}>Dica:</span> Você poderá ver seus agendamentos
                futuros apenas informando este telefone
              </p>
            </div>
          </div>
        </div>

        {/* Footer - Fixo na parte inferior */}
        <div
          className="flex gap-3 p-4 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl transition-colors font-semibold hover:bg-white/5"
            style={{
              color: '#A1A1A1',
              background: '#151515',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-4 py-3 rounded-xl transition-colors font-extrabold active:scale-[0.99]"
            style={{
              background: '#E6C78B',
              color: '#0B0B0B'
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
