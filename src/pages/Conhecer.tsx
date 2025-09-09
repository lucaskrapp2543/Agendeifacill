import React, { useState } from 'react';
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

  const totalSteps = 5;
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
        step: 4
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
      step: 5
    }));
  };

  const resetQuiz = () => {
    setQuizState({
      step: 1,
      businessType: null,
      hasSystem: null,
      selectedReasons: []
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Barra de Progresso */}
      <div className="w-full bg-gray-200 h-2">
        <div 
          className="bg-blue-600 h-2 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

       <div className="flex-1 flex items-center justify-center p-2">
         <div className="max-w-2xl w-full">
           <div className="bg-white rounded-2xl shadow-xl p-4 text-center">
            
            {/* Step 1: Seleção do tipo de negócio */}
            {quizState.step === 1 && (
              <>
                 <div className="mb-6 flex justify-center items-center">
                   <img 
                     src="/pensativo.gif" 
                     alt="Gif pensativo" 
                     className="w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] object-contain rounded-xl"
                   />
                 </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                  Você quer Agendei Fácil para?
                </h1>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleBusinessTypeSelect('barbearia')}
                    className="w-full p-6 bg-gray-100 border-2 border-black text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-lg"
                  >
                    Barbearia
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('salao')}
                    className="w-full p-6 bg-gray-100 border-2 border-black text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-lg"
                  >
                    Salão de Beleza
                  </button>
                  
                  <button
                    onClick={() => handleBusinessTypeSelect('lavacar')}
                    className="w-full p-6 bg-gray-100 border-2 border-black text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-lg"
                  >
                    Lava-car
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
                       <img 
                         src="/barbeiro.gif" 
                         alt="Gif barbeiro" 
                         className="w-[85vw] h-[85vw] max-w-[500px] max-h-[500px] object-contain rounded-xl"
                       />
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
                   <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                     Em poucos cliques você vai ter o sistema de agendamentos mais completo do Brasil.
                   </p>
                 </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4 mt-4">
                  <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-3">
                    Atualmente você tem algum sistema de agendamentos?
                  </h2>
                  
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => handleSystemResponse(true)}
                      className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => handleSystemResponse(false)}
                      className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                    >
                      Não
                    </button>
                  </div>
                </div>

                <button
                  onClick={resetQuiz}
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
                   <div className="mb-4 flex justify-center items-center">
                     <img 
                       src="/fofoca.gif" 
                       alt="Gif fofoca" 
                       className="w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] object-contain rounded-xl"
                     />
                   </div>
                   <p className="text-sm text-gray-500 mb-4">
                     Nos ajude a te entender melhor
                   </p>
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                     Qual desses motivos, você quer mudar para AgendeiFácil?
                   </h1>
                   <p className="text-sm text-gray-500 mb-4">
                     O que a concorrência tá incomodando
                   </p>
                 </div>

                 <div className="space-y-2 mb-4">
                   {[
                     'Valor alto',
                     'Não entrega o que preciso',
                     'Paga por profissional',
                     'Não tem uma página completa',
                     'Não tem club assinantes',
                     'Não tem controle total de tudo',
                     'Nenhum desses',
                     'Quero apenas mudar'
                   ].map((reason, index) => (
                     <button
                       key={reason}
                       onClick={() => handleReasonToggle(reason)}
                       className={`w-full p-3 text-left rounded-lg border transition-colors flex items-center gap-3 ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-blue-50 border-blue-400 text-blue-900'
                           : 'bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100'
                       }`}
                     >
                       <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                         quizState.selectedReasons.includes(reason)
                           ? 'bg-blue-500 border-blue-500'
                           : 'border-gray-400'
                       }`}>
                         {quizState.selectedReasons.includes(reason) && (
                           <div className="w-2 h-2 bg-white rounded-full"></div>
                         )}
                       </div>
                       <span className="text-sm font-medium">{reason}</span>
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
                   onClick={resetQuiz}
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
                     <img 
                       src="/dor.gif" 
                       alt="Gif dor" 
                       className="w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] object-contain rounded-xl"
                     />
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
                     onClick={resetQuiz}
                     className="w-full p-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                   >
                     Refazer Quiz
                   </button>
                 </div>
               </>
             )}

             {/* Step 5: Somos o sistema mais completo */}
             {quizState.step === 5 && (
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
                     'Seu cliente recebe um lembrete 30 min antes',
                     'Você tem controle total financeiro',
                     'Controle total % colaboradores, se tiver',
                     'Controle total de taxas de maquininha',
                     'Sistema de assinaturas incluso',
                     'Temos app agendei fácil, se quiser',
                     'Você recebe notificações quando alguém agenda ou cancela com você',
                     'Você tem sistema totalmente intuitivo e fácil de usar'
                   ].map((feature, index) => (
                     <div key={feature} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                       <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                         <span className="text-white text-xs font-bold">✓</span>
                       </div>
                       <span className="text-sm text-green-800 font-medium">{feature}</span>
                     </div>
                   ))}
                 </div>

                 <div className="mb-6">
                   <p className="text-sm text-gray-600 text-center mb-4">
                     Gostou? Isso é só 40% do que oferecemos tem muito mais.
                   </p>
                   {/* Imagem 10quiz */}
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
                     onClick={() => navigate('/')}
                     className="w-full p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                   >
                     Gostei
                   </button>
                   
                   <button
                     onClick={() => navigate('/')}
                     className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                   >
                     Quero saber quanto é
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