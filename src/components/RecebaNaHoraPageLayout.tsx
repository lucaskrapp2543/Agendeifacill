import React from 'react';

type RecebaNaHoraPageLayoutProps = {
  children: React.ReactNode;
  onScrollToConnect?: () => void;
};

const flowSteps = [
  { emoji: '✂️', label: 'Cliente agenda' },
  { emoji: '💳', label: 'Escolhe pagar online OU no local' },
  { emoji: '⚡', label: 'Se pagar online: você recebe na hora' },
  { emoji: '📈', label: 'Menos faltas no salão' },
];

export const RecebaNaHoraPageLayout: React.FC<RecebaNaHoraPageLayoutProps> = ({
  children,
  onScrollToConnect,
}) => {
  const scrollToConnect = () => {
    if (onScrollToConnect) {
      onScrollToConnect();
      return;
    }
    document.getElementById('receba-na-hora-conectar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
        <span className="text-xs font-bold text-white/90 tracking-wide">💰 Receba na Hora</span>
        <div className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 via-blue-600/10 to-[#0f172a] p-5 sm:p-7 shadow-lg shadow-sky-500/10">
          <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">💰 Receba na Hora</h1>
              <p className="mt-2 text-base sm:text-lg font-bold text-sky-100">
                Seu cliente escolhe: <span className="text-white">pagar online OU no local.</span>
              </p>
            </div>

            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-extrabold text-amber-100">🔥 Quando paga antes:</p>
              <ul className="mt-2 space-y-1.5 text-sm text-amber-50/95">
                <li>✅ Menos faltas nos agendamentos</li>
                <li>✅ Dinheiro cai na hora na sua conta</li>
                <li>✅ Mais comprometimento do cliente</li>
                <li>✅ Mais chances do cliente comparecer</li>
              </ul>
            </div>

            <p className="text-sm text-white/80 font-semibold">Você escolhe se quer ativar ou não.</p>

            <button
              type="button"
              onClick={scrollToConnect}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-extrabold text-base shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 transition-all"
            >
              🚀 Conectar Mercado Pago
            </button>
          </div>
        </section>

        {/* Tranquilização */}
        <section className="rounded-2xl border-2 border-emerald-400/35 bg-gradient-to-br from-emerald-500/15 to-emerald-950/30 p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <span aria-hidden="true">⚠️</span> Importante
          </h2>
          <p className="mt-3 text-base sm:text-lg font-extrabold text-emerald-100">
            Seu cliente <span className="text-white underline decoration-emerald-300/60">NÃO</span> é obrigado a pagar
            online.
          </p>
          <p className="mt-3 text-sm text-emerald-50/90 font-semibold">Você escolhe:</p>
          <ul className="mt-2 space-y-2 text-sm sm:text-base text-white/90">
            <li className="flex items-start gap-2">
              <span className="text-emerald-300 font-bold">☑️</span>
              <span>Permitir pagar no local</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-300 font-bold">☑️</span>
              <span>Permitir pagar online</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-300 font-bold">☑️</span>
              <span>Ou as duas opções juntas</span>
            </li>
          </ul>
        </section>

        {/* Como funciona */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-white mb-4">Como funciona</h2>
          <div className="space-y-0">
            {flowSteps.map((step, index) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-3 rounded-xl bg-[#0f172a]/80 border border-white/10 px-4 py-3">
                  <span className="text-2xl shrink-0" aria-hidden="true">
                    {step.emoji}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white/95">{step.label}</span>
                </div>
                {index < flowSteps.length - 1 && (
                  <div className="flex justify-center py-1 text-sky-300/80 text-lg font-bold" aria-hidden="true">
                    ↓
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Mercado Pago + AFCoins (filho) */}
        <div id="receba-na-hora-conectar">{children}</div>
      </div>
    </div>
  );
};
