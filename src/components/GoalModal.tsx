import React, { useState } from 'react';
import { X, Target } from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goalAmount: number) => Promise<void>;
  professionalName: string;
  currentGoal?: number;
  isLoading?: boolean;
}

export function GoalModal({ 
  isOpen, 
  onClose, 
  onSave, 
  professionalName,
  currentGoal = 0,
  isLoading = false 
}: GoalModalProps) {
  const [goalAmount, setGoalAmount] = useState<string>(currentGoal.toString());

  const handleSave = async () => {
    const amount = parseInt(goalAmount);
    
    if (isNaN(amount) || amount < 1) {
      alert('Por favor, digite um número válido maior que 0');
      return;
    }
    
    if (amount > 999) {
      alert('A meta não pode ser maior que 999 serviços');
      return;
    }
    
    await onSave(amount);
  };

  const handleClose = () => {
    setGoalAmount(currentGoal.toString());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Definir Meta Mensal
                </h3>
                <p className="text-sm text-gray-600 font-medium">
                  {professionalName}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">
                    Como funciona a meta?
                  </h4>
                  <p className="text-sm text-blue-700">
                    Defina quantos serviços o profissional deve realizar no mês. 
                    O sistema acompanhará automaticamente o progresso baseado nos agendamentos completados.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta de serviços por mês
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  min="1"
                  max="999"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center text-gray-900 bg-white"
                  placeholder="Ex: 10, 20, 50"
                  disabled={isLoading}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                  serviços
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Digite um número entre 1 e 999
              </p>
            </div>

            {/* Sugestões de metas */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Sugestões rápidas:
              </p>
              <div className="flex gap-2 flex-wrap">
                {[10, 20, 30, 50, 80, 100].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setGoalAmount(suggestion.toString())}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      goalAmount === suggestion.toString()
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    disabled={isLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !goalAmount.trim() || parseInt(goalAmount) < 1}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </div>
              ) : (
                'Salvar Meta'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
