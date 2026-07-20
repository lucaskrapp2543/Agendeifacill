import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import PlanosCards from '../components/PlanosCards';
import { readPartnerReferralCupomFromSearch } from '../lib/partnerReferralCode';

export default function Planos({ gateWithVideo = false }: { gateWithVideo?: boolean }) {
  const location = useLocation();
  const referralCupom = readPartnerReferralCupomFromSearch(location.search);
  const whatsappNumber = '5548991484275';
  const waLink = (mensagem: string) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`;

  // ✅ Play customizado (o iframe pesado do YouTube só carrega ao clicar) + trava MACIA
  // do quiz (gateWithVideo): planos aparecem após ~6s de vídeo, OU no link "pular",
  // OU sozinhos após 12s sem interação — nunca prende ninguém (conexão lenta etc.).
  const [videoStarted, setVideoStarted] = useState(false);
  const [plansRevealed, setPlansRevealed] = useState(!gateWithVideo);
  const revealTimerRef = useRef<number | null>(null);

  const revealPlans = () => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setPlansRevealed(true);
  };

  const handleVideoPlay = () => {
    setVideoStarted(true);
    if (gateWithVideo && !plansRevealed && revealTimerRef.current === null) {
      revealTimerRef.current = window.setTimeout(() => setPlansRevealed(true), 6000);
    }
  };

  // Válvula de segurança: 12s sem interação → revela sozinho
  useEffect(() => {
    if (!gateWithVideo || plansRevealed) return;
    const idleId = window.setTimeout(() => setPlansRevealed(true), 12000);
    return () => window.clearTimeout(idleId);
  }, [gateWithVideo, plansRevealed]);

  useEffect(() => () => {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
  }, []);

  const gateHiddenCls = gateWithVideo && !plansRevealed ? 'hidden' : '';
  const gateRevealStyle: React.CSSProperties | undefined =
    gateWithVideo && plansRevealed ? { animation: 'planosRevealIn 0.5s ease both' } : undefined;

  // 🛡️ Escudo sobre o player: bloqueia título/logo do YouTube (que levariam a pessoa
  // pra FORA do funil). Tocar no vídeo dá pausa/play NOSSO via comando à API do iframe.
  const [videoPaused, setVideoPaused] = useState(false);
  const videoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const toggleVideoPause = () => {
    const win = videoIframeRef.current?.contentWindow;
    if (!win) return;
    const func = videoPaused ? 'playVideo' : 'pauseVideo';
    win.postMessage(JSON.stringify({ event: 'command', func, args: '' }), '*');
    setVideoPaused((prev) => !prev);
  };

  // ✅ Popups (somente na página /planos) — sem menção a plano: aqui só existe UM acesso
  const [socialProof, setSocialProof] = useState<{ name: string; business: string } | null>(null);
  const [socialProofVisible, setSocialProofVisible] = useState(false);
  const socialProofStartedRef = useRef(false);

  // ✅ FAQ (mesmo da página inicial)
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqs = [
    {
      q: 'Meu cliente precisa baixar algum aplicativo?',
      a: 'Não. Tudo funciona direto no navegador do celular ou computador. Zero downloads, zero atrito.',
    },
    {
      q: 'O cliente precisa criar uma conta para agendar?',
      a: 'Não. Basta informar nome e telefone. O agendamento é feito em poucos cliques, sem cadastro.',
    },
    {
      q: 'Posso usar no celular?',
      a: 'Sim. O sistema é 100% responsivo e funciona perfeitamente no celular, tablet e computador.',
    },
    {
      q: 'O pagamento online é obrigatório?',
      a: 'Não. É opcional. O cliente escolhe se prefere pagar online na hora do agendamento ou pagar no local.',
    },
    {
      q: 'Posso cancelar quando quiser?',
      a: 'Sim. Sem multa, sem fidelidade, sem burocracia. Cancele quando quiser.',
    },
    {
      q: 'Funciona para barbearia e salão de beleza?',
      a: 'Sim. O sistema funciona para qualquer estabelecimento de beleza e bem-estar — barbearia, salão, estética, nail design e mais.',
    },
  ];

  useEffect(() => {
    // Evita duplicar timers em dev/StrictMode
    if (socialProofStartedRef.current) return;
    socialProofStartedRef.current = true;

    const names = [
      'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Fernanda', 'Rafael', 'Camila',
      'Guilherme', 'Juliana', 'Bruno', 'Beatriz', 'Matheus', 'Larissa', 'Felipe',
      'Mariana', 'Diego', 'Letícia', 'Thiago', 'Carolina', 'André', 'Vanessa',
      'Gabriel', 'Amanda', 'Rodrigo', 'Patrícia', 'Eduardo', 'Aline', 'Marcelo',
      'Renata', 'Gustavo', 'Tatiane', 'Leandro', 'Priscila', 'Fábio', 'Daniela',
      'Vitor', 'Simone', 'Alexandre', 'Kelly', 'Márcio', 'Cristiane', 'Jonathan',
      'Elaine', 'Wesley', 'Adriana', 'Caio', 'Bianca'
    ];
    // Barbearia e salão aparecem mais (público principal)
    const businesses = [
      'barbearia', 'salão de beleza', 'barbearia', 'lava-car',
      'salão de beleza', 'clínica odonto', 'barbearia', 'clínica de estética'
    ];

    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = <T,>(arr: T[]) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    // Fila embaralhada: cada nome aparece UMA única vez até a fila esgotar (48 nomes ≈ 8min).
    // Só re-embaralha quando acaba — nada de "Vanessa assinou" duas vezes seguidas.
    const buildQueue = () =>
      shuffle(names).map((name) => ({ name, business: pick(businesses) }));
    let queue = buildQueue();
    let queueIndex = 0;
    const nextProof = () => {
      if (queueIndex >= queue.length) {
        queue = buildQueue();
        queueIndex = 0;
      }
      return queue[queueIndex++];
    };

    let timeoutId: number | undefined;

    const cycle = () => {
      timeoutId = window.setTimeout(() => {
        setSocialProof(nextProof());
        setSocialProofVisible(true);

        // Dura 3s na tela
        timeoutId = window.setTimeout(() => {
          setSocialProofVisible(false);
          // Após sumir, espera 7s e aparece outro
          timeoutId = window.setTimeout(() => {
            cycle();
          }, 7000);
        }, 3000);
      }, 7000);
    };

    cycle();

    return () => {
      socialProofStartedRef.current = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Imagem de topo — mesma da landing (novaim), apenas mobile, full-width */}
      <img
        src="/novaim.webp"
        alt="Agendei Fácil"
        className="sm:hidden w-full h-auto block"
      />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="text-center mb-8 sm:mb-10">
          {/* Vídeo (formato reels) — acima do título PLANOS */}
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              VEJA O SISTEMA <span className="text-pink-500">POR DENTRO</span> 👀
            </h2>
            <p className="text-white/60 text-sm mt-1 mb-5">Um tour rápido de como tudo funciona 👇</p>
            <style>{`@keyframes planosRevealIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div className="flex justify-center px-2">
              <div className="w-full max-w-[300px]">
                <div
                  className="relative rounded-2xl overflow-hidden border-2 border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.35)] bg-black"
                  style={{ aspectRatio: '9/16' }}
                >
                  {videoStarted ? (
                    <>
                      <iframe
                        ref={videoIframeRef}
                        src="https://www.youtube.com/embed/DibbRkvtbgI?rel=0&autoplay=1&playsinline=1&enablejsapi=1&controls=0&iv_load_policy=3"
                        title="Veja o sistema por dentro"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                        style={{ border: 'none' }}
                      />
                      {/* Escudo: cobre o player inteiro — título/logo do YouTube inclicáveis.
                          Tocar = pausa/continua pelo NOSSO controle (postMessage à API). */}
                      <button
                        type="button"
                        onClick={toggleVideoPause}
                        aria-label={videoPaused ? 'Continuar vídeo' : 'Pausar vídeo'}
                        className="absolute inset-0 z-10 w-full h-full"
                      >
                        {videoPaused && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 shadow-lg shadow-pink-500/40">
                              <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1" aria-hidden="true">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </span>
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleVideoPlay}
                      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-gray-900 via-black to-gray-900"
                    >
                      <span className="relative flex h-20 w-20 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-50 animate-ping" />
                        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 shadow-lg shadow-pink-500/40">
                          <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9 ml-1" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </span>
                      <span className="text-white font-extrabold text-base">Aperte o play 👀</span>
                      <span className="text-white/60 text-xs">30 segundos que valem seu dinheiro</span>
                    </button>
                  )}
                </div>
                {gateWithVideo && !plansRevealed && (
                  <button
                    type="button"
                    onClick={revealPlans}
                    className="mt-3 text-xs text-white/50 underline hover:text-white/80 transition-colors"
                  >
                    pular e ver os planos →
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={gateHiddenCls} style={gateRevealStyle}>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">QUANTO CUSTA? 👀</div>
            <p className="mt-2 text-sm font-semibold text-emerald-300">
              💈 UM atendimento pago já cobre o mês — o resto é lucro.
            </p>
            {referralCupom && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100">
                <span>Cupom de indicação:</span>
                <span className="font-black tracking-wider text-white">{referralCupom}</span>
                <span className="text-emerald-200/90">— plano Diamante com desconto</span>
              </div>
            )}
          </div>
        </div>

        <div className={gateHiddenCls} style={gateRevealStyle}>
        {/* Imagem pizza — âncora visual direto abaixo do título/ROI */}
        <div className="max-w-2xl mx-auto mb-8">
          <img
            src="/pizza.png"
            alt="Agendei Fácil"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>

        <div className="text-center mb-6 text-lg sm:text-xl font-semibold text-white/90">
          <span className="block">Tudo que você viu até aqui,</span>
          <span className="block">num preço único. 👇</span>
        </div>
        <PlanosCards whatsappNumber="5548991484275" hidePrata diamanteOnly referralCupom={referralCupom || null} />

        {/* Reversão de risco na boca do botão: mata o medo exatamente onde ele mora */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {['Cancela quando quiser', 'Sem fidelidade', 'Sem multa'].map((selo) => (
            <span
              key={selo}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200"
            >
              <span>✅</span>
              {selo}
            </span>
          ))}
        </div>

        {/* ✅ Botão abaixo do plano Diamante */}
        <div className="max-w-2xl mx-auto mt-8">
          <a
            href={waLink('Tenho dúvidas sobre os planos')}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-5 py-4 text-center transition-colors"
          >
            💬 Tenho dúvidas — conversar com a equipe comercial
          </a>
        </div>
        </div>

      </div>

      {/* ── FAQ (mesmo da página inicial) ── */}
      <section id="faq" className={`py-16 bg-black ${gateHiddenCls}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Imagem acima do FAQ (mesma usada no quiz — repetida de propósito) */}
          <div className="mb-8 flex justify-center">
            <img
              src="/A233.webp"
              alt="Sistema de agendamentos mais completo do Brasil"
              className="w-full max-w-lg h-auto rounded-2xl"
            />
          </div>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Perguntas frequentes
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Tire suas dúvidas antes de começar.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#1a1b1c] border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
                >
                  <span className="text-white font-semibold text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* (link para a página inicial removido de propósito — nenhuma saída do funil) */}
        </div>
      </section>

      {/* ✅ Popups de prova social (somente nesta página) */}
      <div
        className={`fixed left-3 right-3 sm:left-auto sm:right-6 top-4 sm:top-6 z-[70] pointer-events-none transition-all duration-300 ${socialProofVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
      >
        {socialProof && (
          <div className="pointer-events-auto max-w-md sm:w-[360px] mx-auto sm:mx-0">
            <div className="rounded-2xl bg-black/90 border border-emerald-400/25 ring-1 ring-emerald-400/15 shadow-2xl backdrop-blur px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_14px_rgba(16,185,129,0.25)]">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white leading-tight">
                    {socialProof.name} acabou de colocar sua {socialProof.business} no{' '}
                    <span className="text-emerald-300">Agendei Fácil</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[11px] font-bold text-emerald-200">agora mesmo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

