import { RefreshCw, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  applyUpdate,
  getCurrentVersion,
  markV30UpdateCompleted,
  setStoredVersion,
  shouldShowV30UpdatePrompt,
} from '../utils/versionManager';

export const AgendeiFacil30UpdateModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setVisible(shouldShowV30UpdatePrompt());
  }, []);

  const handleUpdate = async () => {
    if (isUpdating) return;

    setIsUpdating(true);

    try {
      markV30UpdateCompleted();
      setStoredVersion(getCurrentVersion());
      await new Promise((resolve) => setTimeout(resolve, 200));
      await applyUpdate();
    } catch (error) {
      console.error('Erro ao atualizar para 3.0:', error);
      markV30UpdateCompleted();
      setStoredVersion(getCurrentVersion());
      window.location.replace(`${window.location.href.split('?')[0]}?v=${Date.now()}`);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#0a1628] shadow-2xl shadow-black/60">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/30">
            <Sparkles className="h-8 w-8 text-white" />
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-300/90 mb-2">
            Nova versão
          </p>

          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-1">
            Agendei Fácil
          </h2>
          <p className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">
            3.0
          </p>

          <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-6">
            Toque em <strong className="text-white">Atualizar agora</strong> para baixar a versão mais recente do sistema.
            É rápido — como dar um Ctrl+F5 no computador.
          </p>

          <button
            type="button"
            onClick={() => void handleUpdate()}
            disabled={isUpdating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5" />
                Atualizar agora
              </>
            )}
          </button>

          <p className="mt-4 text-[11px] text-gray-500">
            Este aviso aparece apenas uma vez.
          </p>
        </div>
      </div>
    </div>
  );
};
