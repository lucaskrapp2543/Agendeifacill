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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-6">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#181c25] via-[#11151c] to-[#090b10] shadow-2xl">
        <div className="absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/15 text-2xl shadow-lg shadow-blue-950/30">
              🔐
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-200">
                Acesso seguro
              </div>
              <h2 className="text-xl font-extrabold leading-tight text-white">{title}</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-white/55">
                Informe o PIN de 4 dígitos para liberar as opções protegidas.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={handlePinChange}
                placeholder="Senha de 4 dígitos"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center text-3xl font-black tracking-[0.35em] text-white outline-none placeholder:text-base placeholder:font-semibold placeholder:tracking-wide placeholder:text-white/35 focus:border-blue-400 focus:bg-white/[0.09] focus:ring-4 focus:ring-blue-500/15"
                autoFocus
              />
              <div className="mt-2 flex justify-center gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`h-2 w-2 rounded-full transition-colors ${pin.length > index ? 'bg-blue-400' : 'bg-white/20'}`}
                  />
                ))}
              </div>
            </div>

          {error && (
            <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-sm font-semibold text-red-200">
              {error}
            </p>
          )}
          {showRememberOption && (
            <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.07]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium leading-relaxed text-white/70">
                Lembrar neste aparelho — deixar senha pré-preenchida (só clicar em Validar)
              </span>
            </label>
          )}
          <div className="flex flex-col gap-2.5">
            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-extrabold text-white shadow-lg shadow-blue-950/40 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99]"
            >
              Validar Senha
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-2xl border border-white/10 bg-white/10 py-3.5 font-extrabold text-white transition-colors hover:bg-white/15"
            >
              Voltar
            </button>
            {showRememberOption && clearPrefillStorageKey && onClearPrefill && (
              <button
                type="button"
                onClick={handleClearPrefill}
                className="w-full rounded-xl py-2 text-sm font-semibold text-white/55 transition-colors hover:bg-white/5 hover:text-white/80"
              >
                Zerar preenchimento
              </button>
            )}
            <a
              href="https://wa.link/p958kx"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl py-2 text-center font-semibold text-blue-300 transition-colors hover:bg-blue-500/10 hover:text-blue-200"
            >
              Esqueci minha senha
            </a>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default PinPasswordModal; 