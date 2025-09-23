import React from 'react';

interface GoalProgressBarProps {
  goalAmount: number;
  completedServices: number;
  professionalName: string;
  isCompact?: boolean; // Para exibição compacta na tela de agendamento
}

export function GoalProgressBar({ 
  goalAmount, 
  completedServices, 
  professionalName,
  isCompact = false 
}: GoalProgressBarProps) {
  const progressPercentage = goalAmount > 0 ? (completedServices / goalAmount) * 100 : 0;
  const remainingServices = Math.max(goalAmount - completedServices, 0);
  
  // Determinar cor da barra baseada no progresso
  const getBarColor = () => {
    if (progressPercentage >= 100) return 'bg-green-500';
    if (progressPercentage >= 75) return 'bg-blue-500';
    if (progressPercentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Determinar cor do texto baseada no progresso
  const getTextColor = () => {
    if (progressPercentage >= 100) return 'text-green-700';
    if (progressPercentage >= 75) return 'text-blue-700';
    if (progressPercentage >= 50) return 'text-yellow-700';
    return 'text-red-700';
  };

  if (isCompact) {
    // Versão compacta para a tela de agendamento
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Meta</span>
          <span className={`text-sm font-bold ${getTextColor()}`}>
            {completedServices}/{goalAmount}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {remainingServices > 0 ? `${remainingServices} restantes` : 'Meta atingida!'}
          </span>
          <span className={`text-xs font-medium ${getTextColor()}`}>
            {progressPercentage.toFixed(0)}%
          </span>
        </div>
      </div>
    );
  }

  // Versão completa para o dashboard
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Meta Mensal</h3>
        <span className={`text-lg font-bold ${getTextColor()}`}>
          {completedServices}/{goalAmount}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
        <div 
          className={`h-3 rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${Math.min(progressPercentage, 100)}%` }}
        />
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <div className="flex flex-col">
          <span className="text-gray-600">Profissional:</span>
          <span className="font-medium text-gray-800">{professionalName}</span>
        </div>
        
        <div className="text-right">
          <div className={`font-bold text-lg ${getTextColor()}`}>
            {progressPercentage.toFixed(1)}%
          </div>
          <div className="text-gray-600">
            {remainingServices > 0 ? (
              <span className="text-orange-600">
                {remainingServices} serviços restantes
              </span>
            ) : (
              <span className="text-green-600 font-medium">
                🎉 Meta atingida!
              </span>
            )}
          </div>
        </div>
      </div>
      
      {progressPercentage >= 100 && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-600">🎉</span>
            <span className="text-green-700 text-sm font-medium">
              Parabéns! Você atingiu sua meta mensal!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
