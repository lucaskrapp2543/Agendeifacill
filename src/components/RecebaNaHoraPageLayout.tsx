import React from 'react';

type RecebaNaHoraPageLayoutProps = {
  children: React.ReactNode;
  isMpConnected?: boolean;
  onScrollToConnect?: () => void;
};

export const RecebaNaHoraPageLayout: React.FC<RecebaNaHoraPageLayoutProps> = ({
  children,
}) => {
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0b1220] to-[#070a12]">
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2.5 bg-[#0a1628]/95 backdrop-blur-sm border-b border-white/10 md:hidden">
        <button
          type="button"
          onClick={() => {
            const sidebar = document.querySelector('[data-sidebar-toggle]');
            if (sidebar) (sidebar as HTMLElement).click();
          }}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold"
        >
          ☰ Menu
        </button>
        <span className="text-xs font-bold text-white/90 tracking-wide">💰 Receba Antes</span>
        <div className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {children}
      </div>
    </div>
  );
};
