import React, { useState, useEffect } from 'react';
import { X, Target } from 'lucide-react';

interface GoalModalSimpleProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goalAmount: number, selectedServices: string[]) => Promise<void>;
  professionalName: string;
  currentGoal?: number;
  isLoading?: boolean;
}

export function GoalModalSimple({ 
  isOpen, 
  onClose, 
  onSave, 
  professionalName,
  currentGoal = 0,
  isLoading = false
}: GoalModalSimpleProps) {
  const [goalAmount, setGoalAmount] = useState<string>(currentGoal.toString());

  useEffect(() => {
    if (isOpen) {
      setGoalAmount(currentGoal.toString());
    }
  }, [isOpen, currentGoal]);

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
    
    // Sistema simples: sem seleção de serviços específicos
    await onSave(amount, []);
  };

  const handleClose = () => {
    setGoalAmount(currentGoal.toString());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
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
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Explicação simples */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700">
                <span>✅</span>
                <span className="font-medium">Sistema Simples</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Todos os serviços marcados como "concluído" serão contabilizados para a meta.
              </p>
            </div>

            {/* Input da meta */}
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
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                  serviços
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar Meta</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
