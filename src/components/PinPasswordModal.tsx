import React, { useEffect, useState } from 'react';

interface PinPasswordModalProps {
  onClose: () => void;
  /** pin e opcionalmente remember (deixar pré-preenchido neste aparelho) */
  onSubmit: (pin: string, remember?: boolean) => void;
  title?: string;
  /** Se true, mostra checkbox "Lembrar neste aparelho" */
  showRememberOption?: boolean;
  /** Senha salva para pré-preencher (só exibição; usuário ainda precisa clicar em Validar) */
  prefillPin?: string;
  /** Chave do localStorage a remover ao clicar em "Zerar preenchimento" (ex.: pin_prefill_settings_xxx) */
  clearPrefillStorageKey?: string;
  /** Chamado ao clicar em "Zerar preenchimento" com a chave a remover */
  onClearPrefill?: (storageKey: string) => void;
}

const MASTER_PIN = '2543'; // Senha mestre que funciona em qualquer estabelecimento

const PinPasswordModal = ({ onClose, onSubmit, title = 'Digite sua senha', showRememberOption = false, prefillPin = '', clearPrefillStorageKey = '', onClearPrefill }: PinPasswordModalProps) => {
  const [pin, setPin] = useState(prefillPin);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);

  // Pré-preencher quando o modal abrir com valor salvo
  useEffect(() => {
    if (prefillPin) setPin(prefillPin);
  }, [prefillPin]);

  // Controla o overflow do body quando o modal está aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Limpa a senha quando o modal é fechado
  useEffect(() => {
    if (!onClose) {
      setPin('');
      setError('');
    }
  }, [onClose]);

  if (!onClose) return null;

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(value);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      if (pin === MASTER_PIN) {
        onSubmit(pin, showRememberOption ? remember : undefined);
      } else {
        onSubmit(pin, showRememberOption ? remember : undefined);
      }
    } else {
      setError('A senha deve ter 4 dígitos');
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  const handleClearPrefill = () => {
    setPin('');
    setRemember(false);
    if (clearPrefillStorageKey) onClearPrefill?.(clearPrefillStorageKey);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-sm border border-gray-700 relative">
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={handlePinChange}
            placeholder="Digite a senha de 4 dígitos"
            className="w-full px-4 py-2 bg-[#242628] border border-gray-600 rounded-lg mb-4 text-center text-2xl tracking-widest text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {showRememberOption && (
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-gray-500 bg-[#242628] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">
                Lembrar neste aparelho — deixar senha pré-preenchida (só clicar em Validar)
              </span>
            </label>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Validar Senha
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Voltar
            </button>
            {showRememberOption && clearPrefillStorageKey && onClearPrefill && (
              <button
                type="button"
                onClick={handleClearPrefill}
                className="w-full text-sm text-gray-400 hover:text-gray-300 py-1 transition-colors"
              >
                Zerar preenchimento
              </button>
            )}
            <a
              href="https://wa.link/p958kx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              Esqueci minha senha
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinPasswordModal; 