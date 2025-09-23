import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";

export function CancelAppointmentButton({ appointmentId, onCancelled, appointment }) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


  const handleCancelClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmation = (confirmed) => {
    setShowConfirmation(false);
    if (confirmed) {
      performCancel();
    }
  };

  const performCancel = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Cancelando agendamento:', appointmentId);
      
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao cancelar no banco:', error);
        throw error;
      }

      console.log('✅ Agendamento cancelado com sucesso');
      toast.success('Agendamento cancelado com sucesso!');
      
      if (onCancelled) {
        onCancelled();
      }
    } catch (error: any) {
      console.error('❌ Erro ao cancelar agendamento:', error);
      toast.error(error.message || 'Erro ao cancelar agendamento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleCancelClick}
        disabled={isLoading}
        className="bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        {isLoading ? 'Cancelando...' : 'Cancelar Agendamento'}
      </button>

      {/* Confirmação de cancelamento */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Cancelamento
            </h3>
            <p className="text-gray-600 mb-6">
              Você está cancelando esse agendamento, tem certeza?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleConfirmation(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Não
              </button>
              <button
                onClick={() => handleConfirmation(true)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}