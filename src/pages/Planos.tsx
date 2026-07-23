import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import PlanosCards from '../components/PlanosCards';
import {
  buildCadastroAgLink,
  normalizePartnerReferralCodeInput,
  readPartnerReferralCupomFromSearch,
} from '../lib/partnerReferralCode';

export default function Planos({
  gateWithVideo = false,
  whatsappFirst = false,
}: {
  gateWithVideo?: boolean;
  /** Quiz /conhecer: CTA principal do card vira WhatsApp; /planos direto continua igual. */
  whatsappFirst?: boolean;
}) {
  const location = useLocation();
  const referralCupom = readPartnerReferralCupomFromSearch(location.search);
  // Mesmo destino do botão do card Diamante — usado no CTA repetido do fim da página
  const cadastroDiamanteLink = buildCadastroAgLink({
    plan: 'diamante',
    cupom: normalizePartnerReferralCodeInput(String(referralCupom || '')) || null,
  });
  const whatsappNumber = '5548991484275';
  const waLink = (mensagem: string) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`;

  // ✅ Vídeo entra RODANDO sozinho (mudo — permitido em qualquer webview); o som a pessoa
  // ativa nos controles do próprio YouTube. Trava MACIA do quiz (gateWithVideo): planos
  // aparecem sozinhos após ~7s (ou na hora, pelo link "pular") — nunca prende ninguém.
  const [plansRevealed, setPlansRevealed] = useState(!gateWithVideo);

  const revealPlans = () => {
    setPlansRevealed(true);
  };

  useEffect(() => {
    if (!gateWithVideo || plansRevealed) return;
    const revealId = window.setTimeout(() => setPlansRevealed(true), 7000);
    return () => window.clearTimeout(revealId);
  }, [gateWithVideo, plansRevealed]);

  const gateHiddenCls = gateWithVideo && !plansRevealed ? 'hidden' : '';
  const gateRevealStyle: React.CSSProperties | undefined =
    gateWithVideo && plansRevealed ? { animation: 'planosRevealIn 0.5s ease both' } : undefined;

  // ✅ Popups (somente na página /planos) — sem menção a plano: aqui só existe UM acesso
  const [socialProof, setSocialProof] = useState<{ name: string; business: string } | null>(null);
  const [socialProofVisible, setSocialProofVisible] = useState(false);
  const socialProofStartedRef = useRef(false);

  // 🖼️ Carrossel de feedbacks (mesmo do quiz /conhecer) — usado no acesso direto,
  // no lugar da imagem A233: quem vem do WhatsApp ainda não viu os depoimentos
  const feedbackImages = ['/feedback.png', '/VS1.png', '/s1.png', '/s2.png', '/feedbacknv11.png', '/feedbacknv22.png'];
  const [feedbackIndex, setFeedbackIndex] = useState(0);
  const [feedbackPreviewUrl, setFeedbackPreviewUrl] = useState<string | null>(null);
  const nextFeedback = () => setFeedbackIndex((prev) => (prev + 1) % feedbackImages.length);
  const prevFeedback = () => setFeedbackIndex((prev) => (prev - 1 + feedbackImages.length) % feedbackImages.length);

  // 🎧 Player do áudio do barbeiro (mesmo do quiz) — bloco de prova social do acesso direto
  const planosAudioRef = useRef<HTMLAudioElement | null>(null);
  const [planosAudioPlaying, setPlanosAudioPlaying] = useState(false);
  const [planosAudioProgress, setPlanosAudioProgress] = useState(0);
  const [planosAudioTime, setPlanosAudioTime] = useState('0:00');
  const [planosAudioRate, setPlanosAudioRate] = useState(1);

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

  // 👀 Contador "pessoas vendo agora": sobe/desce orgânico — passos pequenos (às vezes
  // nenhum), intervalos irregulares de 3,5–9s, teto 30 e piso 11. Nunca estaciona
  // num padrão manjado nem encosta no teto com frequência.
  const [viewersCount, setViewersCount] = useState(() => 14 + Math.floor(Math.random() * 10));
  const [viewersPulse, setViewersPulse] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let viewersTimeoutId: number | undefined;
    const tick = () => {
      viewersTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setViewersCount((current) => {
          const roll = Math.random();
          let delta = 0;
          if (roll < 0.42) delta = 1;
          else if (roll < 0.72) delta = -1;
          else if (roll < 0.82) delta = 2;
          else if (roll < 0.9) delta = -2;
          let next = current + delta;
          if (next > 30) next = 30 - (1 + Math.floor(Math.random() * 2));
          if (next < 11) next = 11 + Math.floor(Math.random() * 3);
          if (next !== current) setViewersPulse((n) => n + 1);
          return next;
        });
        tick();
      }, 3500 + Math.random() * 5500);
    };
    tick();
    return () => {
      cancelled = true;
      if (viewersTimeoutId) window.clearTimeout(viewersTimeoutId);
    };
  }, []);

  return (
    <div className={`relative isolate min-h-screen text-white overflow-x-hidden ${gateWithVideo ? '' : 'bg-[#07080e]'}`}>
      {/* 🌌 Mesmo fundo do /conhecer (glows da marca + vinheta) — só no acesso direto:
          dentro do quiz o fundo já vem do próprio Conhecer (duplicar dobraria o brilho) */}
      {!gateWithVideo && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[560px] rounded-full bg-blue-600/25 blur-[140px]" />
          <div className="absolute top-1/3 -left-32 h-[440px] w-[440px] rounded-full bg-violet-600/15 blur-[150px]" />
          <div className="absolute bottom-[-6rem] -right-28 h-[500px] w-[500px] rounded-full bg-cyan-500/12 blur-[150px]" />
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{ backgroundImage: 'radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.6) 100%)' }}
          />
        </div>
      )}
      {/* (imagem de topo removida a pedido — o passo final abre direto no vídeo) */}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="text-center mb-8 sm:mb-10">
          {/* Vídeo (formato reels) — SÓ dentro do quiz (gateWithVideo). No /planos
              acessado direto NÃO tem vídeo: quem chega ali veio do WhatsApp e a
              apresentação já foi feita na conversa — a página abre direto no preço. */}
          <div className="mb-10">
            <style>{`@keyframes planosRevealIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } @keyframes planosViewerPop { 0% { transform: scale(1.45); opacity: 0.35; } 100% { transform: scale(1); opacity: 1; } }`}</style>
            {gateWithVideo && (
              <>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              VEJA O SISTEMA <span className="text-pink-500">POR DENTRO</span> 👀
            </h2>
            <p className="text-white/60 text-sm mt-1 mb-5">Um tour rápido de como tudo funciona 👇</p>
            <div className="flex justify-center px-2">
              <div className="w-full max-w-[300px]">
                <div
                  className="relative rounded-2xl overflow-hidden border-2 border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.35)] bg-black"
                  style={{ aspectRatio: '9/16' }}
                >
                  {/* YouTube puro clássico: miniatura + play vermelho do PRÓPRIO YouTube.
                      Um toque = vídeo COM SOM desde o início (o toque é dentro do player
                      deles, gesto válido em qualquer webview — Instagram incluso).
                      Autoplay com som não existe em navegador nenhum; esta é a combinação
                      que entrega som no primeiro toque. */}
                  <iframe
                    src="https://www.youtube.com/embed/DibbRkvtbgI?rel=0&playsinline=1"
                    title="Veja o sistema por dentro"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 'none' }}
                  />
                </div>
                {!plansRevealed && (
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
              </>
            )}

            {/* 🖼️ Acesso direto (sem vídeo): mesma imagem de topo do quiz — logo +
                sistema por dentro, recortada sem fundo, casa com a atmosfera */}
            {!gateWithVideo && (
              <div className="mb-4 flex justify-center items-center">
                <img
                  src="/inicioquiz.webp"
                  alt="Agendei Fácil — sistema de agendamentos"
                  className="w-full max-w-md h-auto rounded-xl"
                />
              </div>
            )}

            {/* 👀 Contador ao vivo ABAIXO do vídeo — longe dos popups do topo e coladinho
                no "QUANTO CUSTA?": pressão social exatamente na hora da decisão de preço */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/25 bg-black/60 px-4 py-2 ring-1 ring-emerald-400/15 shadow-[0_0_18px_rgba(16,185,129,0.18)] backdrop-blur">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-sm font-semibold text-white/85">
                  <span
                    key={`viewers-${viewersPulse}`}
                    className="inline-block font-black text-emerald-300 text-base"
                    style={{ animation: 'planosViewerPop 0.45s ease both' }}
                  >
                    {viewersCount}
                  </span>{' '}
                  pessoas vendo essa página agora
                </span>
                <span className="text-base" aria-hidden>👀</span>
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
        <PlanosCards whatsappNumber="5548991484275" hidePrata diamanteOnly referralCupom={referralCupom || null} whatsappFirst={whatsappFirst} />

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

        {/* ✅ Botão abaixo do plano Diamante — escondido no quiz (whatsappFirst):
            lá o CTA principal do card já é o WhatsApp, dois botões iguais confundem */}
        {!whatsappFirst && (
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
        )}
        </div>

      </div>

      {/* ── FAQ (mesmo da página inicial) ── */}
      {/* fundo transparente sempre: deixa a atmosfera (glows) aparecer também no acesso direto */}
      <section id="faq" className={`py-16 ${gateHiddenCls}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Acima do FAQ — quiz: imagem A233 (a pessoa acabou de ver o carrossel no
              passo anterior); acesso direto: carrossel de depoimentos (mesmo do quiz) */}
          {gateWithVideo ? (
            <div className="mb-8 flex justify-center">
              <img
                src="/A233.webp"
                alt="Sistema de agendamentos mais completo do Brasil"
                className="w-full max-w-lg h-auto rounded-2xl"
              />
            </div>
          ) : (
            <div className="mb-8 max-w-lg mx-auto">
              <h2 className="text-base sm:text-lg font-bold text-white mb-1 text-center">
                E olha o que falam da gente 🚀
              </h2>
              <p className="text-xs text-gray-400 mb-3 text-center">🔍 Toque na imagem para ampliar</p>
              <div className="relative mb-4">
                <div className="relative overflow-hidden rounded-lg">
                  <img
                    src={feedbackImages[feedbackIndex]}
                    alt={`Feedback ${feedbackIndex + 1}`}
                    className="w-full h-auto rounded-lg transition-opacity duration-300 cursor-zoom-in"
                    onClick={() => setFeedbackPreviewUrl(feedbackImages[feedbackIndex])}
                  />
                  <button
                    onClick={prevFeedback}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                  >
                    ←
                  </button>
                  <button
                    onClick={nextFeedback}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                  >
                    →
                  </button>
                </div>
                <div className="flex justify-center mt-3 space-x-2">
                  {feedbackImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setFeedbackIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === feedbackIndex ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* 🎧 Prova social do quiz (áudio + print + vídeo) — o /planos é enviado
                  no WhatsApp: mata as objeções antes mesmo da conversa continuar */}
              <div className="mt-10 text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Não confie em mim 😅
                </h2>
                <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-5">
                  Confia em quem usa todo dia 👇
                </h3>

                {/* Áudio de um barbeiro parceiro — player estilo WhatsApp */}
                <audio
                  ref={planosAudioRef}
                  preload="metadata"
                  onPlay={() => {
                    setPlanosAudioPlaying(true);
                    if (planosAudioRef.current) planosAudioRef.current.playbackRate = planosAudioRate;
                  }}
                  onPause={() => setPlanosAudioPlaying(false)}
                  onEnded={() => { setPlanosAudioPlaying(false); setPlanosAudioProgress(0); setPlanosAudioTime('0:00'); }}
                  onTimeUpdate={(e) => {
                    const audio = e.currentTarget;
                    if (audio.duration > 0) {
                      setPlanosAudioProgress((audio.currentTime / audio.duration) * 100);
                      const m = Math.floor(audio.currentTime / 60);
                      const s = Math.floor(audio.currentTime % 60);
                      setPlanosAudioTime(`${m}:${String(s).padStart(2, '0')}`);
                    }
                  }}
                >
                  {/* ogg (leve) para Android/Chrome; mp3 como reserva para iPhone */}
                  <source src="/audioapresentacao.ogg" type="audio/ogg" />
                  <source src="/audiobarbeiro.mp3" type="audio/mpeg" />
                </audio>
                <div className="bg-[#111b12] border border-green-500/30 rounded-2xl p-3 mb-2 flex items-center gap-3">
                  <img
                    src="/fotoronaldo.webp"
                    alt="Ronaldo, barbeiro parceiro"
                    className="w-12 h-12 rounded-full object-cover border-2 border-green-500/60 flex-shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const audio = planosAudioRef.current;
                      if (!audio) return;
                      if (audio.paused) { void audio.play(); } else { audio.pause(); }
                    }}
                    className="w-11 h-11 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center flex-shrink-0 text-black text-base font-black transition-colors"
                    aria-label={planosAudioPlaying ? 'Pausar áudio' : 'Ouvir áudio'}
                  >
                    {planosAudioPlaying ? '❚❚' : '▶'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${planosAudioProgress}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] font-semibold text-green-200/90">Barbeiro parceiro 🎧</span>
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = planosAudioRate === 1 ? 1.5 : planosAudioRate === 1.5 ? 2 : 1;
                            setPlanosAudioRate(next);
                            if (planosAudioRef.current) planosAudioRef.current.playbackRate = next;
                          }}
                          className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-bold text-white leading-none transition-colors"
                          aria-label="Mudar velocidade do áudio"
                        >
                          {planosAudioRate}x
                        </button>
                        <span className="text-[11px] text-green-200/70">{planosAudioTime}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3">Áudio real de um cliente do Agendei Fácil</p>

                {/* Financeiro real do cliente do áudio (autorizado por ele) */}
                <p className="text-sm font-bold text-white mb-2">
                  📈 Olha o print que ele nos mandou do crescimento 👇
                </p>
                <img
                  src="/clientefinanceiro.webp"
                  alt="Financeiro do cliente do áudio: crescimento entre os meses"
                  className="w-full h-auto rounded-xl cursor-zoom-in mb-1"
                  onClick={() => setFeedbackPreviewUrl('/clientefinanceiro.webp')}
                />
                <p className="text-xs text-gray-400 mb-6">🔍 Toque para ampliar</p>

                {/* 🎥 Depoimento em vídeo (formato reels) */}
                <h2 className="text-base sm:text-lg font-bold text-white mb-1">
                  🎥 Olha o que um cliente falou 👇
                </h2>
                <p className="text-xs text-gray-400 mb-3">
                  Depoimento real de quem é atendido numa barbearia que usa o Agendei Fácil
                </p>
                <div className="flex justify-center px-2">
                  <div className="w-full max-w-[300px]">
                    <div
                      className="relative rounded-2xl overflow-hidden border-2 border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.35)] bg-black"
                      style={{ aspectRatio: '9/16' }}
                    >
                      <iframe
                        src="https://www.youtube.com/embed/1qbZbbkuPEE?rel=0&playsinline=1"
                        title="Depoimento de cliente da barbearia"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                        style={{ border: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {/* CTA repetido no fim da página: quem rolou até aqui entra sem precisar
                    voltar lá em cima pro card de planos */}
                <Link
                  to={cadastroDiamanteLink}
                  className="block w-full mt-8 px-4 py-4 rounded-xl font-extrabold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-colors text-center shadow-lg text-base sm:text-lg"
                >
                  Quero meu acesso agora 🚀
                </Link>
              </div>
            </div>
          )}
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

      {/* Lightbox: feedback ampliado (fecha ao tocar em qualquer lugar) — mesmo do quiz */}
      {feedbackPreviewUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-3"
          onClick={() => setFeedbackPreviewUrl(null)}
        >
          <button
            type="button"
            onClick={() => setFeedbackPreviewUrl(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white text-xl font-bold flex items-center justify-center"
            aria-label="Fechar imagem"
          >
            ✕
          </button>
          <img
            src={feedbackPreviewUrl}
            alt="Feedback ampliado"
            className="max-h-[88vh] max-w-[96vw] rounded-xl object-contain"
          />
          <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-xs">Toque em qualquer lugar para fechar</p>
        </div>
      )}

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

