import React, { useState, useEffect } from 'react';

interface PinPasswordModalProps {
  onClose: () => void;
  onSubmit: (pin: string) => void;
  title?: string;
}

const MASTER_PIN = '2543'; // Senha mestre que funciona em qualquer estabelecimento

const PinPasswordModal = ({ onClose, onSubmit, title = 'Digite sua senha' }: PinPasswordModalProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

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
      // Verifica se é a senha mestre ou a senha normal
      if (pin === MASTER_PIN) {
        onSubmit(pin); // A senha mestre sempre vai passar
      } else {
        onSubmit(pin); // Valida a senha normal do estabelecimento
      }
    } else {
      setError('A senha deve ter 4 dígitos');
    }
  };

  const handleClose = () => {
    setPin(''); // Limpa a senha
    setError(''); // Limpa o erro
    onClose(); // Fecha o modal
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