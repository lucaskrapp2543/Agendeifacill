import React from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";

export function CancelAppointmentButton({ appointmentId, onCancelled }) {
  const handleCancel = async () => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Agendamento cancelado com sucesso!');
      if (onCancelled) onCancelled();
    } catch (error) {
      toast.error('Erro ao cancelar agendamento');
      console.error('Erro:', error);
    }
  };

  return (
    <button
      onClick={handleCancel}
      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
    >
      Cancelar Agendamento
    </button>
  );
}