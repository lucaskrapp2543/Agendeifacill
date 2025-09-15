import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  const totalSteps = 8;
  const progress = (quizState.step / totalSteps) * 100;

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


  const images = ['/feedback.png', '/VS1.png', '/s1.png', '/s2.png'];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const nextDevice = () => {
    setCurrentDeviceIndex((prev) => (prev + 1) % 2); // 0 = celular, 1 = PC
  };

  const prevDevice = () => {
    setCurrentDeviceIndex((prev) => (prev - 1 + 2) % 2);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
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
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-gray-200 h-4">
        <div className="relative">
        <div 
            className="bg-blue-600 h-4 transition-all duration-500 ease-out relative"
          style={{ width: `${progress}%` }}
          >
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-bold">
              {Math.round(progress)}%
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

      {/* Mensagem de Parabéns - Apenas no final */}
      {showConfetti && quizState.step === 8 && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <span className="font-bold text-lg">Parabéns!</span>
            <span className="text-2xl">🎉</span>
          </div>
        </div>
      )}

       <div className="flex-1 flex items-center justify-center p-2 pt-4">
         <div className="max-w-2xl w-full">
           <div className="bg-white rounded-2xl shadow-xl p-4 text-center">
            
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                  Agendei Fácil seria para?
                </h1>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleBusinessTypeSelect('barbearia')}
                    className="w-full p-6 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-between border-2 border-gray-600 hover:border-gray-500"
                  >
                    <span className="flex-1 text-center">Barbearia</span>
                    <img src="/barbeiro.png" alt="Barbearia" className="w-10 h-10" />
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('salao')}
                    className="w-full p-6 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-between border-2 border-gray-600 hover:border-gray-500"
                  >
                    <span className="flex-1 text-center">Salão de Beleza</span>
                    <img src="/salao.png" alt="Salão" className="w-10 h-10" />
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('lavacar')}
                    className="w-full p-6 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-between border-2 border-gray-600 hover:border-gray-500"
                  >
                    <span className="flex-1 text-center">Lava-car</span>
                    <img src="/lavalava.png" alt="Lava-car" className="w-10 h-10" />
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
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                     Então você está no lugar certo!
                   </h1>
                   <p className="text-xs sm:text-base text-gray-600 leading-relaxed">
                     <span className="block sm:inline">Conheça em poucos cliques o Agendei Fácil,</span>
                     <span className="block sm:inline">o sistema de agendamentos mais completo do Brasil.</span>
                   </p>
                 </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4 mt-4">
                  <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-3">
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
                  className="text-gray-500 hover:text-gray-700 underline"
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
                       src="/fofoca.gif" 
                       alt="Gif fofoca" 
                         className="w-full h-full object-cover"
                     />
                     </div>
                   </div>
                   <p className="text-sm sm:text-base text-gray-500 mb-3 text-center">
                     Nos ajude a te entender melhor
                   </p>
                   <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 text-center leading-tight px-2 bg-yellow-100 p-4 rounded-lg border-l-4 border-yellow-500">
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
                           ? 'bg-blue-50 border-blue-400 text-blue-900'
                           : 'bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100'
                       }`}
                     >
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-blue-500 border-blue-500'
                           : 'border-gray-400'
                       }`}>
                         {quizState.selectedReasons.includes(reason) && (
                           <div className="w-3 h-3 bg-white rounded-full"></div>
                         )}
                       </div>
                       <span className="text-base sm:text-lg font-medium leading-relaxed">{reason}</span>
                     </button>
                   ))}
                 </div>

                 {quizState.selectedReasons.length > 0 && (
                   <button
                     onClick={handleReasonsSubmit}
                     className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                   >
                     Esses são os motivos
                   </button>
                 )}

                 <button
                   onClick={() => setQuizState(prev => ({ ...prev, step: 2 }))}
                   className="mt-4 text-gray-500 hover:text-gray-700 underline"
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
                       src="/dor.gif" 
                       alt="Gif dor" 
                         className="w-full h-full object-cover"
                     />
                     </div>
                   </div>
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                     Realmente isso dói
                   </h1>
                   <h2 className="text-lg sm:text-xl font-bold text-blue-600 mb-6">
                     Mas calma temos a solução
                   </h2>
                 </div>

                 <div className="space-y-4">
                   <button
                     onClick={handleConhecerAgendeiFacil}
                     className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                   >
                     Conhecer Agendei Fácil
                   </button>
                   
                   <button
                     onClick={() => setQuizState(prev => ({ ...prev, step: 2 }))}
                     className="w-full p-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                     Provavelmente esse é você
                   </h1>
                   <h2 className="text-lg sm:text-xl font-bold text-blue-600 mb-6">
                     Mas calma temos a solução
                   </h2>
                 </div>

                 <div className="space-y-4">
                   <button
                     onClick={handleConhecerAgendeiFacil}
                     className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                   >
                     Conhecer Agendei Fácil
                   </button>
                   
                   <button
                     onClick={() => setQuizState(prev => ({ ...prev, step: 2 }))}
                     className="w-full p-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
                       src="/baner.png" 
                       alt="Banner" 
                       className="w-[90vw] max-w-[500px] object-contain rounded-xl"
                     />
                   </div>
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                     Somos o sistema de agendamento e gestão mais completo de todos
                   </h1>
                   <p className="text-sm text-gray-600 mb-4">
                     Olha abaixo o que oferecemos
                   </p>
                 </div>

                 <div className="space-y-3 mb-6">
                   {[
                     'Página exclusiva e editável sua',
                     'Seu cliente agenda em poucos cliques',
                     'Seu cliente não precisa baixar app',
                     'Seu cliente recebe lembrete 30min antes',
                     'Seus clientes não veem sua concorrência',
                     'Você tem controle total financeiro',
                     'Controle total de agendamentos',
                     'Sistema de estoque completo',
                     'Controle total % colaboradores, se tiver',
                     'Controle total de taxas de maquininha',
                     'Sistema de assinaturas incluso',
                     'Temos app agendei fácil, se quiser',
                     'Você recebe notificações quando alguém agenda ou cancela com você',
                     'Você tem sistema totalmente intuitivo e fácil de usar'
                   ].map((feature) => (
                     <div key={feature} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                       <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                         <span className="text-white text-xs font-bold">✓</span>
                       </div>
                       <span className="text-sm text-green-800 font-medium">{feature}</span>
                     </div>
                   ))}
                 </div>

                 <div className="mb-6">
                   <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
                     <p className="text-base sm:text-lg font-bold text-center text-gray-900 leading-relaxed">
                       <span className="text-green-600">Gostou?</span> Isso é só{' '}
                       <span className="text-red-600 font-extrabold">40%</span> do que oferecemos{' '}
                       <span className="text-green-600 font-extrabold">tem muito mais</span>.
                     </p>
                   </div>
                 </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleGostei}
                      className="w-full p-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
                    >
                      Opa, quero ver como é
                    </button>
                  </div>
               </>
             )}

             {/* Step 7: Novo quiz com imagens */}
             {quizState.step === 7 && (
               <>
                 <div className="mb-6">
                   {/* Texto destacado */}
                   <div className="text-center mb-4 px-4">
                     <p className="text-base sm:text-lg font-bold leading-relaxed text-gray-900">
                       O <span className="text-red-600 font-extrabold">Agendei Fácil</span> avisa você! Todos os agendamentos chegam direto no app,{' '}
                       <span className="text-red-600 font-extrabold">exemplo abaixo</span>.
                     </p>
                   </div>
                   {/* Imagem antesxdepois */}
                   <div className="flex justify-center mb-4">
                     <img
                       src="/antesxdepois.png"
                       alt="antesxdepois"
                       className="w-full max-w-lg h-auto rounded-lg"
                     />
                   </div>
                   
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                     Aplicativo Agendei Fácil totalmente intuitivo e fácil de usar
                   </h1>
                   
                   {/* Texto destacado */}
                   <div className="text-center mb-4 px-4">
                     <p className="text-base sm:text-lg font-bold leading-relaxed text-gray-900">
                       Use também no seu{' '}
                       <span className="text-red-600 font-extrabold">computador</span>, ou nos{' '}
                       <span className="text-red-600 font-extrabold">dois</span> ao mesmo tempo.
                     </p>
                   </div>
                   
                   {/* Carrossel de dispositivos */}
                   <div className="relative mb-4">
                     <div 
                       className="relative overflow-hidden rounded-lg cursor-grab active:cursor-grabbing"
                       onTouchStart={(e) => {
                         const startX = e.touches[0].clientX;
                         const handleTouchMove = (e: TouchEvent) => {
                           const currentX = e.touches[0].clientX;
                           const diffX = startX - currentX;
                           
                           if (Math.abs(diffX) > 50) { // Threshold para swipe
                             if (diffX > 0) {
                               nextDevice(); // Swipe left = next
                             } else {
                               prevDevice(); // Swipe right = previous
                             }
                             document.removeEventListener('touchmove', handleTouchMove);
                             document.removeEventListener('touchend', handleTouchEnd);
                           }
                         };
                         
                         const handleTouchEnd = () => {
                           document.removeEventListener('touchmove', handleTouchMove);
                           document.removeEventListener('touchend', handleTouchEnd);
                         };
                         
                         document.addEventListener('touchmove', handleTouchMove);
                         document.addEventListener('touchend', handleTouchEnd);
                       }}
                       onMouseDown={(e) => {
                         const startX = e.clientX;
                         const handleMouseMove = (e: MouseEvent) => {
                           const currentX = e.clientX;
                           const diffX = startX - currentX;
                           
                           if (Math.abs(diffX) > 50) { // Threshold para swipe
                             if (diffX > 0) {
                               nextDevice(); // Drag left = next
                             } else {
                               prevDevice(); // Drag right = previous
                             }
                             document.removeEventListener('mousemove', handleMouseMove);
                             document.removeEventListener('mouseup', handleMouseUp);
                           }
                         };
                         
                         const handleMouseUp = () => {
                           document.removeEventListener('mousemove', handleMouseMove);
                           document.removeEventListener('mouseup', handleMouseUp);
                         };
                         
                         document.addEventListener('mousemove', handleMouseMove);
                         document.addEventListener('mouseup', handleMouseUp);
                       }}
                     >
                       {/* Imagem celular */}
                       <div className={`transition-transform duration-500 ease-in-out ${currentDeviceIndex === 0 ? 'translate-x-0' : '-translate-x-full'}`}>
                         <img
                           src="/celular.png"
                           alt="celular"
                           className="w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] object-contain rounded-lg"
                         />
                       </div>
                       
                       {/* Imagem PC */}
                       <div className={`absolute top-0 left-full transition-transform duration-500 ease-in-out ${currentDeviceIndex === 1 ? '-translate-x-full' : 'translate-x-0'}`}>
                         <img
                           src="/pc.png"
                           alt="pc"
                           className="w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] object-contain rounded-lg"
                         />
                       </div>
                       
                       {/* Botão anterior */}
                       <button
                         onClick={prevDevice}
                         className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                       >
                         ←
                       </button>
                       
                       {/* Botão próximo */}
                       <button
                         onClick={nextDevice}
                         className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                       >
                         →
                       </button>
                     </div>
                     
                     {/* Indicadores de dispositivo */}
                     <div className="flex justify-center mt-3 space-x-2">
                       <button
                         onClick={() => setCurrentDeviceIndex(0)}
                         className={`w-3 h-3 rounded-full transition-colors ${
                           currentDeviceIndex === 0 ? 'bg-blue-500' : 'bg-gray-300'
                         }`}
                       />
                       <button
                         onClick={() => setCurrentDeviceIndex(1)}
                         className={`w-3 h-3 rounded-full transition-colors ${
                           currentDeviceIndex === 1 ? 'bg-blue-500' : 'bg-gray-300'
                         }`}
                       />
                     </div>
                   </div>
                   
                   {/* Texto destacado */}
                   <div className="text-center mb-4 px-4">
                     <p className="text-sm text-gray-600 mt-2">
                       👆 <span className="font-semibold">Arraste para o lado</span> para ver ambos
                     </p>
                   </div>
                   
                   {/* Imagem 10quiz - movida para o final */}
                   <div className="flex justify-center mb-4">
                     <img
                       src="/10quiz.png"
                       alt="10quiz"
                       className="w-full max-w-lg h-auto rounded-lg"
                     />
                   </div>
                 </div>

                  <div className="space-y-3">
                    <button
                      onClick={handlePresente}
                     className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                     Gostei, Qual valor?
                    </button>
                    
                    <button
                     onClick={() => setQuizState(prev => ({ ...prev, step: 5 }))}
                     className="w-full p-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                     ← Voltar
                    </button>
                  </div>
               </>
             )}

             {/* Step 8: Presente */}
             {quizState.step === 8 && (
               <>
                 <div className="mb-4">
                   <div className="mb-1 flex justify-center items-center">
                     <div className="w-[85vw] h-[85vw] max-w-[500px] max-h-[500px] rounded-2xl overflow-hidden">
                     <img 
                       src="/leonardo.gif" 
                       alt="Gif Leonardo" 
                         className="w-full h-full object-cover"
                     />
                     </div>
                   </div>
                   
                   <h1 className="text-lg sm:text-xl font-bold text-black mb-2 text-center px-4">
                     Você não achou que eu iria deixar você chegar até aqui sem um <span className="text-red-600">presente</span> né?
                   </h1>
                   
                   {/* Imagem bonus */}
                   <div className="flex justify-center mb-2">
                     <img
                       src="/bonus.png"
                       alt="Bonus"
                       className="w-full max-w-lg h-auto rounded-lg"
                     />
                   </div>
                   
                   <div className="flex justify-center mb-2">
                     <img
                       src="/presente.png"
                       alt="Presente"
                       className="w-full max-w-xl h-auto rounded-lg"
                     />
                   </div>
                   
                   <div className="bg-green-600 border-l-4 border-green-700 p-4 rounded-lg mb-4">
                     <p className="text-sm font-bold text-white text-center">
                       Não se preocupe, esse valor <span className="text-green-200 text-lg">R$ 39,90</span> não aumenta nunca, é sempre esse valor para você. Caso queira pagar anual, ganha 2 meses grátis.
                     </p>
                   </div>
                   
                   <p className="text-xs text-gray-500 mb-3 text-center">
                     Se liga em alguns dos milhares de feedbacks de quem já tá com a gente 🚀
                   </p>
                   
                   {/* Carrossel de imagens */}
                   <div className="relative mb-4">
                     <div className="relative overflow-hidden rounded-lg">
                       <img
                         src={images[currentImageIndex]}
                         alt={`Slide ${currentImageIndex + 1}`}
                         className="w-full h-auto rounded-lg transition-opacity duration-300"
                       />
                       
                       {/* Botão anterior */}
                       <button
                         onClick={prevImage}
                         className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                       >
                         ←
                       </button>
                       
                       {/* Botão próximo */}
                       <button
                         onClick={nextImage}
                         className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                       >
                         →
                       </button>
                     </div>
                     
                     {/* Indicadores de slide */}
                     <div className="flex justify-center mt-3 space-x-2">
                       {images.map((_, index) => (
                         <button
                           key={index}
                           onClick={() => setCurrentImageIndex(index)}
                           className={`w-2 h-2 rounded-full transition-colors ${
                             index === currentImageIndex ? 'bg-blue-500' : 'bg-gray-300'
                           }`}
                         />
                       ))}
                     </div>
                   </div>
                   
                   <h2 className="text-sm sm:text-base font-bold text-black text-center px-2 mb-3">
                     COMO FUNCIONA AGENDEI FÁCIL
                   </h2>
                   
                   <div className="w-full max-w-4xl mx-auto mb-4">
                     <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                       <iframe
                         src="https://www.youtube.com/embed/tQMWQLLLDPo"
                         title="Vídeo do Agendei Fácil"
                         className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                         frameBorder="0"
                         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                         allowFullScreen
                       />
                     </div>
                   </div>
                 </div>

                 <div className="space-y-3">
                   <button
                     onClick={() => window.open('https://pay.cakto.com.br/o798qm9_509159?affiliate=jK2AXbTW', '_blank')}
                     className="w-full p-4 sm:p-5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl"
                     style={{
                       animation: 'scalePulse 1.5s ease-in-out infinite'
                     }}
                   >
                     Quero aproveitar AGORA!
                   </button>
                   
                   <p className="text-sm text-gray-600 mb-3 text-center">
                     Ficou alguma dúvida? Clique abaixo
                   </p>
                   
                   <button
                     onClick={() => window.open('https://wa.me/554891265320?text=Quero%20mais%20informações%20do%20Agendei%20Fácil,%20vim%20pelo%20Quiz!', '_blank')}
                     className="w-full p-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold text-sm sm:text-base"
                   >
                     Falar com alguém no WhatsApp
                   </button>
                 </div>
               </>
             )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Conhecer;