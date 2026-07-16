import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Planos from './Planos';

interface QuizState {
  step: number;
  businessType: string | null;
  hasSystem: boolean | null;
  selectedReasons: string[];
}

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
    <div className="min-h-screen bg-black flex flex-col">
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
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-gray-800 h-4">
        <div className="relative">
        <div 
            className="bg-blue-600 h-4 transition-all duration-500 ease-out relative"
          style={{ width: `${adjustedProgress}%` }}
          >
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-bold">
              {quizState.step === 1 ? '12.9%' : `${Math.round(progress)}%`}
            </div>
          </div>
        </div>
      </div>

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


      {/* Step 8: página /planos completa (mesmo componente — sempre idêntica à original) */}
      {quizState.step === 8 && <Planos />}

      {quizState.step !== 8 && (
       <div className="flex-1 flex items-center justify-center p-2 pt-4">
         <div className="max-w-2xl w-full">
           <div className="bg-black rounded-2xl p-4 text-center">
            
            {/* Step 1: Seleção do tipo de negócio */}
            {quizState.step === 1 && (
              <>
                 {/* Imagem BRASIL no topo */}
                 <div className="mb-4 flex justify-center items-center">
                   <img 
                     src="/BRASIL.png" 
                     alt="Brasil" 
                     className="w-full max-w-48 h-auto rounded-lg"
                   />
                 </div>
                 
                 <div className="mb-4 flex justify-center items-center">
                   <div className="w-[90vw] h-[90vw] max-w-[500px] max-h-[500px] rounded-2xl overflow-hidden">
                   <img 
                     src="/pensativo.gif" 
                     alt="Gif pensativo" 
                       className="w-full h-full object-cover"
                   />
                   </div>
                 </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  Agendei Fácil seria para?
                </h1>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleBusinessTypeSelect('barbearia')}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-lg flex items-center gap-4 transition-colors border border-white/10"
                  >
                    <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <img src="/barbeiro.png" alt="Barbearia" className="w-7 h-7" />
                    </span>
                    <span className="flex-1 text-left">Barbearia</span>
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('salao')}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-lg flex items-center gap-4 transition-colors border border-white/10"
                  >
                    <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <img src="/salao.png" alt="Salão" className="w-7 h-7" />
                    </span>
                    <span className="flex-1 text-left">Salão de Beleza</span>
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('lavacar')}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-lg flex items-center gap-4 transition-colors border border-white/10"
                  >
                    <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <img src="/lavalava.png" alt="Lava-car" className="w-7 h-7" />
                    </span>
                    <span className="flex-1 text-left">Lava-car</span>
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
                       <div className="text-3xl">💄</div>
                     )}
                     {quizState.businessType === 'lavacar' && (
                       <div className="text-3xl">🚗</div>
                     )}
                   </div>
                   <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                     Então você está no lugar certo!
                   </h1>
                   <p className="text-xs sm:text-base text-gray-300 leading-relaxed">
                     <span className="block sm:inline">Conheça em poucos cliques o Agendei Fácil,</span>
                     <span className="block sm:inline">o sistema de agendamentos mais completo do Brasil.</span>
                   </p>
                 </div>

                <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-lg mb-4 mt-4">
                  <h2 className="text-lg sm:text-xl font-bold text-blue-200 mb-3">
                    Atualmente você tem algum sistema de agendamentos?
                  </h2>
                  
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => handleSystemResponse(true)}
                      className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
                    >
                      <span>👍</span>
                      <span>Sim</span>
                    </button>
                    <button
                      onClick={() => handleSystemResponse(false)}
                      className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold flex items-center gap-2"
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
                     <div className="w-[80vw] h-[80vw] max-w-[450px] max-h-[450px] rounded-2xl overflow-hidden">
                     <img 
                       src="/barbeirosurpreso2.gif"
                       alt="Barbeiros fofocando"
                         className="w-full h-full object-cover"
                     />
                     </div>
                   </div>
                   <p className="text-sm sm:text-base text-gray-400 mb-3 text-center">
                     Nos ajude a te entender melhor
                   </p>
                   <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 text-center leading-tight px-2 bg-yellow-500/10 p-4 rounded-lg border-l-4 border-yellow-500">
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
                       className={`w-full p-4 sm:p-5 text-left rounded-lg border transition-colors flex items-center gap-4 ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-green-500/20 border-green-400 text-green-100'
                           : 'bg-white/5 border-white/15 text-gray-100 hover:bg-white/10'
                       }`}
                     >
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-green-500 border-green-500'
                           : 'border-gray-400'
                       }`}>
                         {quizState.selectedReasons.includes(reason) && (
                           <span className="text-white text-xs font-bold">✓</span>
                         )}
                       </div>
                       <span className="text-base sm:text-lg font-medium leading-relaxed">{reason}</span>
                     </button>
                   ))}
                 </div>

                 {quizState.selectedReasons.length > 0 && (
                   <button
                     onClick={handleReasonsSubmit}
                     className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
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

             {/* Step 4: Realmente isso dói */}
             {quizState.step === 4 && (
               <>
                 <div className="mb-6">
                   <div className="mb-4 flex justify-center items-center">
                     <div className="w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] rounded-2xl overflow-hidden">
                     <img 
                       src="/barbeirochorando.gif"
                       alt="Barbeiro chorando"
                         className="w-full h-full object-cover"
                     />
                     </div>
                   </div>
                   {quizState.selectedReasons.length > 0 && (
                     <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                       <p className="text-sm font-semibold text-gray-400 mb-2">Você marcou:</p>
                       <div className="space-y-1.5">
                         {quizState.selectedReasons.map((reason) => (
                           <div key={reason} className="flex items-center gap-2">
                             <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                               <span className="text-white text-xs font-bold">✓</span>
                             </span>
                             <span className="text-sm font-medium text-gray-100">{reason}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                   <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
                     Isso dói no bolso, né? 😮‍💨
                   </h1>
                   <h2 className="text-lg sm:text-xl font-bold text-white mb-6">
                     Mas calma — o Agendei Fácil <span className="text-green-400">resolve TODOS esses</span> 👇
                   </h2>
                 </div>

                 <div className="space-y-4">
                   <button
                     onClick={handleConhecerAgendeiFacil}
                     className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
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
             )}

             {/* Step 5: Realmente isso dói (sem gif) */}
             {quizState.step === 5 && (
               <>
                 <div className="mb-6">
                   <div className="mb-4 flex justify-center items-center">
                     <img 
                       src="/VS.png" 
                       alt="VS" 
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
                     Olha abaixo o que oferecemos
                   </p>
                 </div>

                 <div className="space-y-5 mb-6">
                   {[
                     {
                       title: '💰 Pro seu bolso',
                       items: [
                         { text: 'Cliente paga adiantado (opcional) → dinheiro na SUA conta na hora', highlight: true },
                         { text: 'Lembrete automático no WhatsApp → menos faltas', highlight: true },
                         { text: 'Você sabe exatamente quanto lucra', highlight: true },
                         { text: 'Comissão de cada profissional na régua', highlight: false },
                         { text: 'Controle das taxas da maquininha', highlight: false },
                         { text: 'Assinaturas = renda todo mês', highlight: false },
                       ],
                     },
                     {
                       title: '🙌 Pros seus clientes',
                       items: [
                         { text: 'Página sua, exclusiva e editável', highlight: false },
                         { text: 'Agenda em poucos cliques, sem baixar app', highlight: false },
                         { text: 'Seus clientes não veem a concorrência', highlight: true },
                       ],
                     },
                     {
                       title: '⚙️ Pro seu dia a dia',
                       items: [
                         { text: 'Controle completo da agenda', highlight: true },
                         { text: 'Notificação quando agendam ou cancelam', highlight: false },
                         { text: 'Sistema de estoque completo', highlight: false },
                         { text: 'App próprio (Android e iPhone)', highlight: false },
                         { text: 'Simples de usar no celular e no PC', highlight: false },
                       ],
                     },
                   ].map((group) => (
                     <div key={group.title}>
                       <p className="text-sm font-extrabold text-gray-200 uppercase tracking-wide mb-2 text-center">{group.title}</p>
                       <div className="space-y-2">
                         {group.items.map((item) => (
                           <div
                             key={item.text}
                             className="flex items-center gap-3 p-3 rounded-lg border bg-green-500/10 border-green-500/30"
                           >
                             <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                               <span className="text-white text-xs font-bold">✓</span>
                             </div>
                             <span className="text-sm text-green-300 text-left font-medium">{item.text}</span>
                           </div>
                         ))}
                       </div>
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
                       src="/umbrind.webp"
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