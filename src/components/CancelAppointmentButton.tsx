import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { checkWhatsAppSubscriber } from "../lib/supabase";

export function CancelAppointmentButton({ appointmentId, onCancelled, appointment }) {
  const [showFirstConfirmation, setShowFirstConfirmation] = useState(false);
  const [showSecondConfirmation, setShowSecondConfirmation] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [establishment, setEstablishment] = useState(null);

  // Verificar se é assinante e buscar dados do estabelecimento
  React.useEffect(() => {
    const checkSubscriberStatus = async () => {
      if (appointment?.client_whatsapp && appointment?.establishment_id) {
        try {
          const { data: subscriber } = await checkWhatsAppSubscriber(
            appointment.client_whatsapp, 
            appointment.establishment_id
          );
          setIsSubscriber(!!subscriber);
        } catch (error) {
          console.error('Erro ao verificar status de assinante:', error);
        }
      }
    };

    const fetchEstablishment = async () => {
      if (appointment?.establishment_id) {
        try {
          const { data: establishmentData, error } = await supabase
            .from('establishments')
            .select('*')
            .eq('id', appointment.establishment_id)
            .single();

          if (error) throw error;
          setEstablishment(establishmentData);
        } catch (error) {
          console.error('Erro ao buscar dados do estabelecimento:', error);
        }
      }
    };

    checkSubscriberStatus();
    fetchEstablishment();
  }, [appointment]);

  const handleCancelClick = () => {
    // Se o estabelecimento exige solicitação de cancelamento via WhatsApp
    if (establishment?.require_cancellation_request) {
      handleRequestCancellation();
    } else {
      setShowFirstConfirmation(true);
    }
  };

  const handleRequestCancellation = () => {
    if (establishment?.whatsapp) {
      const phoneNumber = establishment.whatsapp.replace(/\D/g, '');
      const message = `Olá, queria cancelar agendamento... motivo é `;
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      toast.success('Redirecionando para WhatsApp...');
    } else {
      toast.error('WhatsApp do estabelecimento não encontrado');
    }
  };

  const handleFirstConfirmation = (confirmed) => {
    setShowFirstConfirmation(false);
    if (confirmed) {
      if (isSubscriber) {
        setShowSecondConfirmation(true);
      } else {
        // Se não é assinante, cancela diretamente
        performCancel();
      }
    }
  };

  const handleSecondConfirmation = (confirmed) => {
    setShowSecondConfirmation(false);
    if (confirmed) {
      performCancel();
    }
  };

  const performCancel = async () => {
    setIsLoading(true);
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
        {isLoading ? 'Cancelando...' : 
         establishment?.require_cancellation_request ? 'Pedir Cancelamento' : 'Cancelar Agendamento'}
      </button>

      {/* Primeira confirmação */}
      {showFirstConfirmation && (
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
                onClick={() => handleFirstConfirmation(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Não
              </button>
              <button
                onClick={() => handleFirstConfirmation(true)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segunda confirmação (apenas para assinantes) */}
      {showSecondConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-orange-600 mb-4">
              ⚠️ Aviso para Assinante
            </h3>
            <p className="text-gray-600 mb-6">
              Você está cancelando como assinante, não irá conseguir remarcar para o mesmo dia, deseja continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleSecondConfirmation(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Não
              </button>
              <button
                onClick={() => handleSecondConfirmation(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
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