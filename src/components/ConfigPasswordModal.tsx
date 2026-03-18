import React, { useEffect, useState } from 'react';
import { Lock, X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfigPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  onSuccess?: () => void;
  title: string;
  description: string;
  rememberKey?: string;
}

export function ConfigPasswordModal({
  isOpen,
  onClose,
  onVerify,
  onSuccess,
  title,
  description,
  rememberKey
}: ConfigPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [autoTriedRememberedPassword, setAutoTriedRememberedPassword] = useState(false);

  const persistRememberedPassword = (nextPassword: string, shouldRemember: boolean) => {
    if (!rememberKey) return;
    try {
      if (shouldRemember) {
        localStorage.setItem(rememberKey, nextPassword);
      } else {
        localStorage.removeItem(rememberKey);
      }
    } catch {
      // silencioso: não bloquear fluxo por storage
    }
  };

  const handleVerify = async (passwordToCheck?: string, isAutoAttempt = false) => {
    const candidate = String(passwordToCheck ?? password ?? '').trim();
    if (candidate.length !== 4) {
      if (!isAutoAttempt) {
        toast.error('A senha deve ter 4 dígitos');
      }
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await onVerify(candidate);
      if (isValid) {
        const shouldRemember = isAutoAttempt ? true : rememberPassword;
        persistRememberedPassword(candidate, shouldRemember);
        toast.success('Senha verificada com sucesso!');
        onSuccess?.(); // Chama callback de sucesso
        onClose();
        setPassword('');
      } else {
        if (isAutoAttempt) {
          // senha salva ficou inválida (ex.: dono alterou) -> limpar
          persistRememberedPassword('', false);
          setRememberPassword(false);
        }
        toast.error('Senha incorreta');
        setPassword('');
      }
    } catch (error) {
      toast.error('Erro ao verificar senha');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (!isVerifying) {
      onClose();
      setPassword('');
      setAutoTriedRememberedPassword(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!rememberKey) return;
    if (autoTriedRememberedPassword) return;

    try {
      const saved = String(localStorage.getItem(rememberKey) || '').trim();
      if (saved.length === 4) {
        setRememberPassword(true);
        setPassword(saved);
        setAutoTriedRememberedPassword(true);
        // Auto verificação para não ficar digitando toda hora.
        void handleVerify(saved, true);
      } else {
        setAutoTriedRememberedPassword(true);
      }
    } catch {
      setAutoTriedRememberedPassword(true);
    }
  }, [isOpen, rememberKey, autoTriedRememberedPassword]);

  useEffect(() => {
    if (!isOpen) {
      setAutoTriedRememberedPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="text-sm text-gray-600">
                  {description}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isVerifying}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha de 4 dígitos
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-center text-2xl tracking-widest bg-white text-gray-900"
                placeholder="••••"
                maxLength={4}
                disabled={isVerifying}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isVerifying}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Digite a senha de 4 dígitos das configurações
            </p>
            {rememberKey ? (
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setRememberPassword(next);
                    if (!next) {
                      persistRememberedPassword('', false);
                    }
                  }}
                  disabled={isVerifying}
                />
                Lembrar senha neste aparelho
              </label>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isVerifying}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void handleVerify();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isVerifying || password.length !== 4}
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verificando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Verificar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
