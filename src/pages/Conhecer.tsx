import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Planos from './Planos';

interface QuizState {
  step: number;
  businessType: string | null;
  hasSystem: boolean | null;
  selectedReasons: string[];
}

// Contra-golpe personalizado para cada "vacilo do outro sistema" marcado no step 3.
// Cada seleção vira um card ❌ (dor riscada) → ✅ (resposta do Agendei Fácil).
const PAIN_COUNTERS: Record<string, string> = {
  'Valor alto': 'Aqui a mensalidade é fixa e camarada — tudo incluso e muito mais barato.',
  'Não entrega o que preciso': 'Agenda, financeiro, assinantes, WhatsApp, fidelidade... aqui não falta peça.',
  'Paga por profissional': 'Profissionais ILIMITADOS. Cresce a equipe, o valor não muda.',
  'Não tem uma página completa': 'Página completa com fotos, avaliações e pagamento online — link só seu.',
  'Não tem club assinantes': 'Clube de assinantes PRONTO, cobrança automática todo mês. Renda fixa caindo.',
  'Não tem controle total de tudo': 'Financeiro por profissional, comissões, produtos, metas... controle até DEMAIS.',
  'Quero apenas mudar': 'Melhor motivo que existe. Migrar pra cá leva minutos.',
};
const MONEY_PAINS = new Set(['Valor alto', 'Paga por profissional']);

// Emojis de EXIBIÇÃO das opções do step 3 — apenas visual; as strings-chave
// continuam idênticas (alimentam PAIN_COUNTERS/resolvePainScreen sem mudança).
const REASON_EMOJIS: Record<string, string> = {
  'Valor alto': '💸',
  'Não entrega o que preciso': '🧩',
  'Paga por profissional': '👥',
  'Não tem uma página completa': '🔗',
  'Não tem club assinantes': '👑',
  'Não tem controle total de tudo': '🎛️',
  'Nenhum desses': '🤷',
  'Quero apenas mudar': '🔄',
};

// Headline e sublinha dinâmicas conforme o que foi marcado ("Nenhum desses" nunca gera card).
const resolvePainScreen = (selectedReasons: string[]) => {
  const selectedWithCounter = selectedReasons.filter(
    (reason) => reason !== 'Nenhum desses' && PAIN_COUNTERS[reason]
  );
  // "Quero apenas mudar" fecha a lista quando misturado com dores reais (é o arremate)
  const cards = [
    ...selectedWithCounter.filter((reason) => reason !== 'Quero apenas mudar'),
    ...selectedWithCounter.filter((reason) => reason === 'Quero apenas mudar'),
  ];
  const realPains = cards.filter((reason) => reason !== 'Quero apenas mudar');
  const onlyWantsToSwitch = cards.length > 0 && realPains.length === 0;
  const hasMoneyPain = cards.some((reason) => MONEY_PAINS.has(reason));

  let headline = 'Isso dói no bolso, né? 😮‍💨';
  if (cards.length === 0) headline = 'Beleza — deixa eu te mostrar o que você ainda não viu 👀';
  else if (onlyWantsToSwitch) headline = 'Então veio ao lugar certo 😏';
  else if (!hasMoneyPain) headline = 'Trabalhar com sistema pela metade cansa, né? 😮‍💨';

  const subline =
    cards.length === 0
      ? { prefix: 'O Agendei Fácil é o ', highlight: 'sistema mais completo do Brasil', suffix: ' 👇' }
      : onlyWantsToSwitch
        ? { prefix: 'E o Agendei Fácil é o ', highlight: 'upgrade que você procura', suffix: ' 👇' }
        : cards.length === 1
          ? { prefix: 'Mas calma — o Agendei Fácil ', highlight: 'resolve exatamente esse', suffix: ' 👇' }
          : { prefix: 'Mas calma — o Agendei Fácil ', highlight: 'resolve TODOS esses', suffix: ' 👇' };

  return { cards, headline, subline, showSwitchCaption: onlyWantsToSwitch };
};

const Conhecer = () => {
  const navigate = useNavigate();
  const [quizState, setQuizState] = useState<QuizState>({
    step: 1,
    businessType: null,
    hasSystem: null,
    selectedReasons: []
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const totalSteps = 8;
  const progress = (quizState.step / totalSteps) * 100;
  const adjustedProgress = quizState.step === 1 ? 12.9 : progress;

  // 🎰 Escada de recompensa: micro-pulso na barra a cada etapa vencida (+ vibração no
  // celular), mini-confete no marco de 75%, e JACKPOT de tela cheia ao chegar nos planos.
  // Voltar etapa NÃO premia. Nada bloqueia o toque (jackpot é pointer-events-none).
  const [stepRewardPulse, setStepRewardPulse] = useState(0);
  const [showJackpot, setShowJackpot] = useState(false);
  const prevStepRef = useRef(1);

  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = quizState.step;
    if (quizState.step <= prev) return;
    try {
      (navigator as any).vibrate?.(quizState.step === 8 ? [30, 40, 60] : 15);
    } catch {
      // sem vibração — segue o jogo
    }
    setStepRewardPulse((n) => n + 1);
    if (quizState.step === 8) {
      setShowJackpot(true);
      const jackpotId = window.setTimeout(() => setShowJackpot(false), 2600);
      return () => window.clearTimeout(jackpotId);
    }
  }, [quizState.step]);

  const handleBusinessTypeSelect = (type: string) => {
    setQuizState(prev => ({
      ...prev,
      businessType: type,
      step: 2
    }));
  };

  const handleSystemResponse = (hasSystem: boolean) => {
    if (hasSystem) {
      setQuizState(prev => ({
        ...prev,
        hasSystem,
        step: 3
      }));
    } else {
      setQuizState(prev => ({
        ...prev,
        hasSystem,
        step: 5
      }));
    }
  };

  const handleReasonToggle = (reason: string) => {
    setQuizState(prev => ({
      ...prev,
      selectedReasons: prev.selectedReasons.includes(reason)
        ? prev.selectedReasons.filter(r => r !== reason)
        : [...prev.selectedReasons, reason]
    }));
  };

  const handleReasonsSubmit = () => {
    setQuizState(prev => ({
      ...prev,
      step: 4
    }));
  };

  const handleConhecerAgendeiFacil = () => {
    setQuizState(prev => ({
      ...prev,
      step: 6
    }));
  };

  const handleGostei = () => {
    setQuizState(prev => ({
      ...prev,
      step: 7
    }));
  };

  const handlePresente = () => {
    setQuizState(prev => ({
      ...prev,
      step: 8
    }));
    // Ativar efeito de confetes e parabéns apenas no final
    setShowConfetti(true);
    // Scroll para o topo da página
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const images = ['/feedback.png', '/VS1.png', '/s1.png', '/s2.png', '/feedbacknv11.png', '/feedbacknv22.png'];

  // Lightbox: clicar num feedback abre a imagem ampliada em tela cheia
  const [feedbackPreviewUrl, setFeedbackPreviewUrl] = useState<string | null>(null);

  // Áudio do barbeiro (step 7) — player estilo WhatsApp
  const quizAudioRef = useRef<HTMLAudioElement | null>(null);
  const [quizAudioPlaying, setQuizAudioPlaying] = useState(false);
  const [quizAudioProgress, setQuizAudioProgress] = useState(0);
  const [quizAudioTime, setQuizAudioTime] = useState('0:00');
  const [quizAudioRate, setQuizAudioRate] = useState(1);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

// Controlar duração do efeito de confetes
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 2000); // 2 segundos de confetes
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Scroll para o topo sempre que mudar de step
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [quizState.step]);

  return (
    <div className="relative isolate min-h-screen bg-[#07080e] flex flex-col overflow-x-hidden">
      {/* 🌌 Atmosfera de fundo: glows suaves da marca flutuando + vinheta.
          -z-10 + isolate no pai = SEMPRE atrás de tudo, nunca lava as imagens. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[560px] rounded-full bg-blue-600/25 blur-[140px]" />
        <div className="absolute top-1/3 -left-32 h-[440px] w-[440px] rounded-full bg-violet-600/15 blur-[150px]" />
        <div className="absolute bottom-[-6rem] -right-28 h-[500px] w-[500px] rounded-full bg-cyan-500/12 blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: 'radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.6) 100%)' }}
        />
      </div>
      {/* CSS para animação de pulsação */}
      <style>
        {`
          @keyframes scalePulse {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
            100% {
              transform: scale(1);
            }
          }
        `}
      </style>
      
      {/* Barra de Progresso - Fixa no topo */}
      <style>{`
        @keyframes conhecerBarPulse { 0% { opacity: 0.9; } 100% { opacity: 0; } }
        @keyframes conhecerCheckPop { 0% { transform: scale(0); opacity: 0; } 45% { transform: scale(1.5); opacity: 1; } 75% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes conhecerBurstFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(38vh) rotate(540deg); opacity: 0; } }
        @keyframes conhecerConfettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.85; } }
        @keyframes conhecerStampIn { 0% { transform: scale(3) rotate(-18deg); opacity: 0; } 55% { transform: scale(0.92) rotate(-7deg); opacity: 1; } 75% { transform: scale(1.07) rotate(-10deg); } 100% { transform: scale(1) rotate(-8deg); } }
        @keyframes conhecerPopIn { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes conhecerJackpotFade { 0%, 84% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-gray-800 h-4">
        <div className="relative">
        <div
            className="bg-blue-600 h-4 transition-all duration-500 ease-out relative"
          style={{ width: `${adjustedProgress}%` }}
          >
            {/* pulso verde: reanima a cada etapa vencida (key muda) */}
            {stepRewardPulse > 0 && (
              <div
                key={`pulse-${stepRewardPulse}`}
                className="absolute inset-0 bg-green-400"
                style={{ animation: 'conhecerBarPulse 0.7s ease both' }}
              />
            )}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-bold flex items-center gap-1">
              <span>{quizState.step === 1 ? '12.9%' : `${Math.round(progress)}%`}</span>
              {stepRewardPulse > 0 && (
                <span
                  key={`chk-${stepRewardPulse}`}
                  className="text-green-300"
                  style={{ animation: 'conhecerCheckPop 0.8s ease both' }}
                >
                  ✓
                </span>
              )}
            </div>
          </div>
          {/* mini estouro de confete no marco de 75% (chegou na grade de chips) */}
          {quizState.step === 6 && stepRewardPulse > 0 && (
            <div key={`burst-${stepRewardPulse}`} className="pointer-events-none absolute top-4 left-0 right-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute w-2 h-3 rounded-[2px]"
                  style={{
                    left: `${8 + ((i * 17) % 84)}%`,
                    backgroundColor: ['#22c55e', '#eab308', '#ec4899', '#3b82f6', '#f97316'][i % 5],
                    animation: `conhecerBurstFall ${0.9 + (i % 4) * 0.18}s ease-out ${(i % 5) * 0.05}s both`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 💥 JACKPOT final: tela cheia + carimbo "OFERTA DESBLOQUEADA" (some sozinho em
          ~2,6s e é pointer-events-none — nunca bloqueia o toque de ninguém) */}
      {showJackpot && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 pointer-events-none"
          style={{ animation: 'conhecerJackpotFade 2.6s ease both' }}
        >
          {Array.from({ length: 34 }).map((_, i) => (
            <span
              key={i}
              className="absolute -top-6 w-2.5 h-4 rounded-[2px]"
              style={{
                left: `${(i * 37) % 100}%`,
                backgroundColor: ['#22c55e', '#eab308', '#ec4899', '#3b82f6', '#f97316', '#a855f7'][i % 6],
                animation: `conhecerConfettiFall ${1.5 + (i % 5) * 0.25}s linear ${(i % 7) * 0.12}s both`,
              }}
            />
          ))}
          <div className="text-center px-6">
            <div className="text-5xl mb-3" style={{ animation: 'conhecerPopIn 0.5s ease both' }}>🎉</div>
            <div className="text-3xl sm:text-4xl font-black text-white mb-6" style={{ animation: 'conhecerPopIn 0.5s ease 0.15s both' }}>
              PARABÉNS!
            </div>
            <div
              className="inline-block rounded-xl border-4 border-emerald-400 px-6 py-3 text-xl sm:text-2xl font-black uppercase tracking-wider text-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.5)]"
              style={{ animation: 'conhecerStampIn 0.55s cubic-bezier(0.22, 1.4, 0.36, 1) 0.55s both' }}
            >
              🔓 OFERTA DESBLOQUEADA
            </div>
            <div className="mt-4 text-sm text-white/70" style={{ animation: 'conhecerPopIn 0.4s ease 1.1s both' }}>
              você completou o quiz 👏
            </div>
          </div>
        </div>
      )}

      {/* Efeito de Confetes */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '1s' }}></div>
          <div className="absolute top-0 left-1/2 w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.2s' }}></div>
          <div className="absolute top-0 left-3/4 w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.1s' }}></div>
          <div className="absolute top-0 left-1/3 w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.6s', animationDuration: '1.3s' }}></div>
          <div className="absolute top-0 left-2/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '1.4s' }}></div>
          <div className="absolute top-0 left-1/6 w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '1.5s' }}></div>
          <div className="absolute top-0 left-5/6 w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '1.2s', animationDuration: '1.6s' }}></div>
          <div className="absolute top-0 left-1/12 w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '1.4s', animationDuration: '1.7s' }}></div>
          <div className="absolute top-0 left-11/12 w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '1.6s', animationDuration: '1.8s' }}></div>
        </div>
      )}


      {/* Step 8: página /planos completa (mesmo componente — sempre idêntica à original).
          gateWithVideo = trava MACIA: planos aparecem após ~6s de vídeo, no "pular", ou
          sozinhos em 12s. Só no quiz — /planos acessado direto continua tudo visível. */}
      {quizState.step === 8 && (
        <div className="relative z-10">
          <Planos gateWithVideo whatsappFirst />
        </div>
      )}

      {quizState.step !== 8 && (
       <div className="relative z-10 flex-1 flex items-center justify-center p-2 pt-4">
         <div className="max-w-2xl w-full">
           <div className="bg-[#0b0c14]/70 border border-white/[0.06] shadow-2xl shadow-black/40 backdrop-blur-sm rounded-2xl p-4 text-center">
            
            {/* Step 1: Seleção do tipo de negócio */}
            {quizState.step === 1 && (
              <>
                 {/* Imagem de topo do quiz (logo + sistema por dentro) */}
                 <div className="mb-4 flex justify-center items-center">
                   <img
                     src="/inicioquiz.webp"
                     alt="Agendei Fácil — sistema de agendamentos"
                     className="w-full max-w-md h-auto rounded-xl"
                   />
                 </div>
                 
                <h1 className="text-xl sm:text-2xl font-bold text-blue-400 mt-2 mb-8">
                  Para qual negócio você deseja? 👇
                </h1>
                
                <div className="space-y-6">
                  <button
                    onClick={() => handleBusinessTypeSelect('barbearia')}
                    className="w-full rounded-2xl overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <img src="/barbeariaim.webp" alt="Barbearia" className="w-full h-auto block" />
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('salao')}
                    className="w-full rounded-2xl overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <img src="/salaoim.webp" alt="Salão de Beleza" className="w-full h-auto block" />
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('lavacar')}
                    className="w-full rounded-2xl overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <img src="/lavacarim.webp" alt="Lava-car" className="w-full h-auto block" />
                  </button>
                </div>
              </>
            )}

             {/* Step 2: Confirmação e pergunta sobre sistema */}
             {quizState.step === 2 && (
               <>
                 <div className="space-y-2">
                   <div className="flex justify-center items-center">
                     {quizState.businessType === 'barbearia' && (
                       <div className="w-[85vw] h-[85vw] max-w-[500px] max-h-[500px] rounded-2xl overflow-hidden">
                       <img 
                         src="/barbeiro.gif" 
                         alt="Gif barbeiro" 
                           className="w-full h-full object-cover"
                       />
                       </div>
                     )}
                     {quizState.businessType === 'salao' && (
                       <div className="w-[85vw] max-w-[500px] rounded-2xl overflow-hidden">
                         <img
                           src="/salaodebeleza1.webp"
                           alt="Gif salão de beleza"
                           className="w-full h-auto block"
                         />
                       </div>
                     )}
                     {quizState.businessType === 'lavacar' && (
                       <div className="text-3xl">🚗</div>
                     )}
                   </div>
                   <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                     Então você está no lugar certo!
                   </h1>
                 </div>

                {/* Card premium — mesma linguagem dos cards de entrada (escuro + brilho sutil) */}
                <div className="mt-4 mb-4 rounded-2xl border border-white/10 bg-gradient-to-b from-[#101a2c] to-[#0a0d14] p-5 ring-1 ring-blue-500/25 shadow-[0_0_28px_rgba(59,130,246,0.18)]">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white leading-snug mb-4">
                    Atualmente você tem algum sistema de agendamentos?
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSystemResponse(true)}
                      className="py-3.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-extrabold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-2"
                    >
                      <span>👍</span>
                      <span>Sim</span>
                    </button>
                    <button
                      onClick={() => handleSystemResponse(false)}
                      className="py-3.5 rounded-xl bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-extrabold shadow-lg shadow-red-500/25 transition-all hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-2"
                    >
                      <span>👎</span>
                      <span>Não</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setQuizState(prev => ({ ...prev, step: 1 }))}
                  className="text-gray-400 hover:text-gray-200 underline"
                >
                  ← Voltar
                </button>
              </>
             )}

             {/* Step 3: Motivos para mudar (quando tem sistema) */}
             {quizState.step === 3 && (
               <>
                 <div className="mb-4">
                   <div className="mb-3 flex justify-center items-center">
                     {quizState.businessType === 'salao' ? (
                       <div className="w-[80vw] max-w-[450px] rounded-2xl overflow-hidden">
                         <img
                           src="/contaai.webp"
                           alt="Conta aí"
                           className="w-full h-auto block"
                         />
                       </div>
                     ) : (
                       <div className="w-[80vw] h-[80vw] max-w-[450px] max-h-[450px] rounded-2xl overflow-hidden">
                       <img
                         src="/barbeirosurpreso2.gif"
                         alt="Barbeiros fofocando"
                           className="w-full h-full object-cover"
                       />
                       </div>
                     )}
                   </div>
                   <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 text-center leading-tight px-3 py-4 bg-gradient-to-b from-yellow-500/15 to-yellow-500/5 rounded-2xl border border-yellow-500/30 ring-1 ring-yellow-500/25 shadow-[0_0_24px_rgba(234,179,8,0.15)]">
                     Qual vacilo do outro sistema fez você chegar até aqui? 👀
                   </h1>
                   <p className="text-xs text-gray-400 mb-4 text-center">
                     Selecione uma ou mais opções
                   </p>
                 </div>

                 <div className="space-y-3 mb-4">
                   {[
                     'Valor alto',
                     'Não entrega o que preciso',
                     'Paga por profissional',
                     'Não tem uma página completa',
                     'Não tem club assinantes',
                     'Não tem controle total de tudo',
                     'Nenhum desses',
                     'Quero apenas mudar'
                   ].map((reason) => (
                     <button
                       key={reason}
                       onClick={() => handleReasonToggle(reason)}
                       className={`w-full p-4 sm:p-5 text-left rounded-xl border transition-all flex items-center gap-3.5 active:scale-[0.98] ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-green-500/15 border-green-400/80 text-green-100 ring-1 ring-green-400/40 shadow-[0_0_18px_rgba(34,197,94,0.2)] scale-[1.01]'
                           : 'bg-gradient-to-b from-white/[0.07] to-white/[0.03] border-white/10 text-gray-100 hover:border-white/25 hover:scale-[1.01]'
                       }`}
                     >
                       <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-green-500 border-green-500 scale-110'
                           : 'border-gray-500 bg-black/30'
                       }`}>
                         {quizState.selectedReasons.includes(reason) && (
                           <span className="text-white text-xs font-bold">✓</span>
                         )}
                       </div>
                       <span className="text-base sm:text-lg font-medium leading-snug">
                         <span className="mr-2">{REASON_EMOJIS[reason] || ''}</span>
                         {reason}
                       </span>
                     </button>
                   ))}
                 </div>

                 {quizState.selectedReasons.length > 0 && (
                   <button
                     onClick={handleReasonsSubmit}
                     className="w-full p-4 rounded-xl bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-extrabold shadow-lg shadow-green-500/25 transition-all hover:scale-[1.01] active:scale-[0.98]"
                   >
                     Esses são os motivos
                   </button>
                 )}

                 <button
                   onClick={() => setQuizState(prev => ({ ...prev, step: 2 }))}
                   className="mt-4 text-gray-400 hover:text-gray-200 underline"
                 >
                   ← Voltar
                 </button>
               </>
             )}

             {/* Step 4: resposta personalizada — cada dor marcada vira card ❌ (riscada) → ✅ (contra-golpe) */}
             {quizState.step === 4 && (() => {
               const painScreen = resolvePainScreen(quizState.selectedReasons);
               return (
               <>
                 <style>{`@keyframes conhecerCardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                 <div className="mb-6">
                   <div className="mb-4 flex justify-center items-center">
                     <div className="w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] rounded-2xl overflow-hidden">
                     <img
                       src={quizState.businessType === 'salao' ? '/chorando.webp' : '/barbeirochorando.gif'}
                       alt={quizState.businessType === 'salao' ? 'Chorando' : 'Barbeiro chorando'}
                         className="w-full h-full object-cover"
                     />
                     </div>
                   </div>
                   {painScreen.showSwitchCaption && (
                     <p className="text-xs text-gray-400 italic mb-3">o outro sistema vendo você ir embora 😂</p>
                   )}
                   <h1 className="text-xl sm:text-2xl font-bold text-white mb-4">
                     {painScreen.headline}
                   </h1>
                   {painScreen.cards.length > 0 && (
                     <div className="mb-5 space-y-3 text-left">
                       {painScreen.cards.map((reason, index) => (
                         <div
                           key={reason}
                           className="rounded-xl border border-white/10 ring-1 ring-white/5 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4"
                           style={{ animation: 'conhecerCardIn 0.45s ease both', animationDelay: `${index * 0.15}s` }}
                         >
                           {/* Etiquetas à prova de primeira visita: "VOCÊ MARCOU" (ação que ela
                               acabou de fazer) → "NO AGENDEI FÁCIL" (a entrega). Só a dor é riscada. */}
                           <div className="flex items-start gap-2 opacity-80">
                             <span className="text-xs flex-shrink-0 mt-0.5">❌</span>
                             <span className="text-xs font-medium">
                               <span className="font-extrabold tracking-wide text-red-200/90">VOCÊ MARCOU: </span>
                               <span className="text-red-300/80 line-through decoration-red-400/60">{reason}</span>
                             </span>
                           </div>
                           <div className="flex items-start gap-2.5 mt-2">
                             <span className="flex-shrink-0 h-6 w-6 rounded-md bg-green-500/15 ring-1 ring-green-400/40 shadow-[0_0_10px_rgba(34,197,94,0.25)] flex items-center justify-center text-sm">✅</span>
                             <span className="text-[15px] sm:text-base font-semibold text-green-100 leading-snug">
                               <span className="block text-[10px] font-extrabold tracking-wider text-green-400/90 uppercase mb-0.5">No Agendei Fácil:</span>
                               {PAIN_COUNTERS[reason]}
                             </span>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                   <h2 className="text-lg sm:text-xl font-bold text-white mb-6">
                     {painScreen.subline.prefix}<span className="text-green-400">{painScreen.subline.highlight}</span>{painScreen.subline.suffix}
                   </h2>
                 </div>

                 <div className="space-y-4">
                   <button
                     onClick={handleConhecerAgendeiFacil}
                     className="w-full p-4 rounded-xl bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-extrabold shadow-lg shadow-green-500/25 transition-all hover:scale-[1.01] active:scale-[0.98]"
                   >
                     Quero ver a solução 👀
                   </button>

                   <button
                     onClick={() => setQuizState(prev => ({ ...prev, step: 2 }))}
                     className="w-full p-4 bg-white/10 text-gray-200 rounded-lg hover:bg-white/20 transition-colors"
                   >
                     ← Voltar
                   </button>
                 </div>
               </>
               );
             })()}

             {/* Step 5: Realmente isso dói (sem gif) */}
             {quizState.step === 5 && (
               <>
                 <div className="mb-6">
                   <div className="mb-4 flex justify-center items-center">
                     <img
                       src={quizState.businessType === 'salao' ? '/cabeloehidratacao.webp' : '/VS.png'}
                       alt={quizState.businessType === 'salao' ? 'Cabelo e hidratação' : 'VS'}
                       className="w-full max-w-lg h-auto rounded-lg"
                     />
                   </div>
                   <h1 className="text-xl sm:text-2xl font-bold text-white mb-4">
                     Provavelmente esse é você
                   </h1>
                   <h2 className="text-lg sm:text-xl font-bold text-white mb-6">
                     Mas calma — <span className="text-green-400">temos a solução</span>
                   </h2>
                 </div>

                 <div className="space-y-4">
                   <button
                     onClick={handleConhecerAgendeiFacil}
                     className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
                   >
                     Conhecer Agendei Fácil
                   </button>
                   
                   <button
                     onClick={() => setQuizState(prev => ({ ...prev, step: 2 }))}
                     className="w-full p-4 bg-white/10 text-gray-200 rounded-lg hover:bg-white/20 transition-colors"
                   >
                     ← Voltar
                   </button>
                 </div>
               </>
             )}

             {/* Step 6: Somos o sistema mais completo */}
             {quizState.step === 6 && (
               <>
                 <div className="mb-6">
                   <div className="mb-4 flex justify-center items-center">
                     <img 
                       src="/A233.webp"
                       alt="Sistema de agendamentos mais completo do Brasil"
                       className="w-[90vw] max-w-[500px] object-contain rounded-xl"
                     />
                   </div>
                   <h1 className="text-xl sm:text-2xl font-bold text-white mb-4">
                     Somos o sistema de agendamento e gestão mais completo de todos
                   </h1>
                   <p className="text-sm text-gray-300 mb-4">
                     bate o olho 👇
                   </p>
                 </div>

                 {/* Grade de chips: completude que se VÊ em 3 segundos (sem muro de texto).
                     Entram em cascata — a grade "se monta" na frente da pessoa. */}
                 <style>{`@keyframes conhecerChipIn { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
                 <div className="grid grid-cols-2 gap-2.5 mb-6">
                   {[
                     '💸 Cliente paga adiantado',
                     '📲 Lembrete no WhatsApp',
                     '👑 Clube de assinantes',
                     '📊 Financeiro na régua',
                     '🔗 Página só sua',
                     '⚡ Agenda sem baixar app nem criar conta',
                     '📦 Estoque completo',
                     '📱 App próprio iOS, Android e PC',
                     '🤝 Comissão por profissional',
                     '➕ e muito mais...',
                   ].map((chip, index, all) => (
                     <div
                       key={chip}
                       className={`flex items-center justify-center text-center px-2.5 py-3.5 rounded-xl border text-[13px] font-semibold leading-snug ${
                         index === all.length - 1
                           ? 'border-dashed border-white/25 bg-white/5 text-gray-300'
                           : 'border-green-500/30 bg-green-500/10 text-green-100'
                       }`}
                       style={{ animation: 'conhecerChipIn 0.4s ease both', animationDelay: `${index * 0.08}s` }}
                     >
                       {chip}
                     </div>
                   ))}
                 </div>

                 <div className="mb-6">
                   <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
                     <p className="text-base sm:text-lg font-bold text-center text-white leading-relaxed">
                       <span className="text-green-600">Gostou?</span> Isso é só{' '}
                       <span className="text-red-600 font-extrabold">40%</span> do que oferecemos{' '}
                       <span className="text-green-600 font-extrabold">tem muito mais</span>.
                     </p>
                   </div>
                 </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleGostei}
                      className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
                    >
                      To gostando mostra mais 👀
                    </button>
                  </div>
               </>
             )}

             {/* Step 7: Novo quiz com imagens */}
             {quizState.step === 7 && (
               <>
                 <div className="mb-6">
                   {/* Imagem de topo */}
                   <div className="mb-4 flex justify-center">
                     <img
                       src="/umbrind2.webp"
                       alt="Agendei Fácil"
                       className="w-full max-w-lg h-auto rounded-2xl"
                     />
                   </div>
                   {/* Gancho de prova social */}
                   <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                     Não confie em mim 😅
                   </h1>
                   <h2 className="text-lg sm:text-xl font-bold text-green-400 mb-5">
                     Confia em quem usa todo dia 👇
                   </h2>

                   {/* Áudio de um barbeiro parceiro — player estilo WhatsApp */}
                   <audio
                     ref={quizAudioRef}
                     preload="metadata"
                     onPlay={() => {
                       setQuizAudioPlaying(true);
                       if (quizAudioRef.current) quizAudioRef.current.playbackRate = quizAudioRate;
                     }}
                     onPause={() => setQuizAudioPlaying(false)}
                     onEnded={() => { setQuizAudioPlaying(false); setQuizAudioProgress(0); setQuizAudioTime('0:00'); }}
                     onTimeUpdate={(e) => {
                       const audio = e.currentTarget;
                       if (audio.duration > 0) {
                         setQuizAudioProgress((audio.currentTime / audio.duration) * 100);
                         const m = Math.floor(audio.currentTime / 60);
                         const s = Math.floor(audio.currentTime % 60);
                         setQuizAudioTime(`${m}:${String(s).padStart(2, '0')}`);
                       }
                     }}
                   >
                     {/* ogg (leve, 112KB) para Android/Chrome; mp3 como reserva para iPhone */}
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
                         const audio = quizAudioRef.current;
                         if (!audio) return;
                         if (audio.paused) { void audio.play(); } else { audio.pause(); }
                       }}
                       className="w-11 h-11 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center flex-shrink-0 text-black text-base font-black transition-colors"
                       aria-label={quizAudioPlaying ? 'Pausar áudio' : 'Ouvir áudio'}
                     >
                       {quizAudioPlaying ? '❚❚' : '▶'}
                     </button>
                     <div className="flex-1 min-w-0">
                       <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                         <div className="h-full bg-green-400 rounded-full" style={{ width: `${quizAudioProgress}%` }} />
                       </div>
                       <div className="flex items-center justify-between mt-1.5">
                         <span className="text-[11px] font-semibold text-green-200/90">Barbeiro parceiro 🎧</span>
                         <span className="flex items-center gap-2">
                           <button
                             type="button"
                             onClick={() => {
                               const next = quizAudioRate === 1 ? 1.5 : quizAudioRate === 1.5 ? 2 : 1;
                               setQuizAudioRate(next);
                               if (quizAudioRef.current) quizAudioRef.current.playbackRate = next;
                             }}
                             className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-bold text-white leading-none transition-colors"
                             aria-label="Mudar velocidade do áudio"
                           >
                             {quizAudioRate}x
                           </button>
                           <span className="text-[11px] text-green-200/70">{quizAudioTime}</span>
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

                   {/* 🎥 Depoimento em vídeo — ABAIXO do print, SÓ no caminho da BARBEARIA (formato reels) */}
                   {quizState.businessType === 'barbearia' && (
                     <div className="mb-6">
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
                     </div>
                   )}

                   {/* Feedbacks de clientes */}
                   <h2 className="text-base sm:text-lg font-bold text-white mb-1">
                     E olha o que falam da gente 🚀
                   </h2>
                   <p className="text-xs text-gray-400 mb-3">🔍 Toque na imagem para ampliar</p>
                   <div className="relative mb-4">
                     <div className="relative overflow-hidden rounded-lg">
                       <img
                         src={images[currentImageIndex]}
                         alt={`Feedback ${currentImageIndex + 1}`}
                         className="w-full h-auto rounded-lg transition-opacity duration-300 cursor-zoom-in"
                         onClick={() => setFeedbackPreviewUrl(images[currentImageIndex])}
                       />
                       <button
                         onClick={prevImage}
                         className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                       >
                         ←
                       </button>
                       <button
                         onClick={nextImage}
                         className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                       >
                         →
                       </button>
                     </div>
                     <div className="flex justify-center mt-3 space-x-2">
                       {images.map((_, index) => (
                         <button
                           key={index}
                           onClick={() => setCurrentImageIndex(index)}
                           className={`w-2 h-2 rounded-full transition-colors ${
                             index === currentImageIndex ? 'bg-green-500' : 'bg-gray-600'
                           }`}
                         />
                       ))}
                     </div>
                   </div>
                   
                 </div>

                  <div className="space-y-3">
                    <button
                      onClick={handlePresente}
                     className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
                    >
                     Gostei, Qual valor?
                    </button>
                    
                    <button
                     onClick={() => setQuizState(prev => ({ ...prev, step: 5 }))}
                     className="w-full p-4 bg-white/10 text-gray-200 rounded-lg hover:bg-white/20 transition-colors"
                    >
                     ← Voltar
                    </button>
                  </div>
               </>
             )}


          </div>
        </div>
      </div>
      )}

      {/* Lightbox: feedback ampliado (fecha ao tocar em qualquer lugar) */}
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

    </div>
  );
};

export default Conhecer;