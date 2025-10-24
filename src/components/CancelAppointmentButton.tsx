import { useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { CancellationWhatsAppModal } from "./CancellationWhatsAppModal";

export function CancelAppointmentButton({ appointmentId, onCancelled, appointment }) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [establishmentWhatsAppConfig, setEstablishmentWhatsAppConfig] = useState(null);


  const handleCancelClick = async () => {
    // Verificar se a configuração de WhatsApp está ativa
    try {
      const { data: establishment, error } = await supabase
        .from('establishments')
        .select('enable_whatsapp_notifications, whatsapp')
        .eq('id', appointment.establishment_id)
        .single();

      if (error) {
        console.error('Erro ao carregar configuração do estabelecimento:', error);
        setShowConfirmation(true);
        return;
      }

      setEstablishmentWhatsAppConfig({
        enableWhatsAppNotifications: establishment?.enable_whatsapp_notifications || false,
        whatsapp: establishment?.whatsapp || ''
      });

      if (establishment?.enable_whatsapp_notifications && establishment?.whatsapp) {
        setShowWhatsAppModal(true);
      } else {
        setShowConfirmation(true);
      }
    } catch (error) {
      console.error('Erro ao verificar configuração:', error);
      setShowConfirmation(true);
    }
  };

  const handleConfirmation = (confirmed) => {
    setShowConfirmation(false);
    if (confirmed) {
      performCancel();
    }
  };

  const handleConfirmCancellationWhatsApp = () => {
    if (!establishmentWhatsAppConfig?.whatsapp || !appointment) {
      toast.error('Configuração de WhatsApp não encontrada');
      return;
    }

    // Limpar e formatar o número do WhatsApp
    let cleanWhatsapp = establishmentWhatsAppConfig.whatsapp.replace(/\D/g, '');

    console.log('🔍 DEBUG - WhatsApp original:', establishmentWhatsAppConfig.whatsapp);
    console.log('🔍 DEBUG - WhatsApp limpo:', cleanWhatsapp);

    // Garantir que tenha código do país (55 para Brasil)
    if (cleanWhatsapp.length === 11 && !cleanWhatsapp.startsWith('55')) {
      cleanWhatsapp = '55' + cleanWhatsapp;
    } else if (cleanWhatsapp.length === 10) {
      cleanWhatsapp = '55' + cleanWhatsapp;
    } else if (cleanWhatsapp.length === 13 && cleanWhatsapp.startsWith('55')) {
      // Já tem código do país, manter
      cleanWhatsapp = cleanWhatsapp;
    } else if (cleanWhatsapp.length < 10) {
      console.error('❌ Número de WhatsApp muito curto:', cleanWhatsapp);
      toast.error('Número de WhatsApp inválido');
      return;
    }

    console.log('🔍 DEBUG - WhatsApp final:', cleanWhatsapp);
    console.log('🔍 DEBUG - Dados do agendamento:', {
      service_name: appointment.service_name,
      service: appointment.service,
      professional_name: appointment.professional_name,
      professional: appointment.professional,
      payment_method: appointment.payment_method,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time
    });

    // Resolver nome do profissional se necessário
    let professionalName = appointment.professional_name || 'Não especificado';
    if (!appointment.professional_name && appointment.professional && appointment.professional.length > 10) {
      // Se professional é um ID, tentar buscar o nome
      try {
        if (appointment.establishments && appointment.establishments.professionals) {
          const professionals = appointment.establishments.professionals;
          if (Array.isArray(professionals)) {
            const professional = professionals.find((p: any) => p.id === appointment.professional);
            if (professional && professional.name) {
              professionalName = professional.name;
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Erro ao buscar nome do profissional:', error);
      }
    }

    const message = `Quero cancelar meu agendamento pelo Agendei Fácil:

*Data:* ${appointment.appointment_date}
*Horário:* ${appointment.appointment_time}
*Serviço:* ${appointment.service_name || appointment.service || 'Não especificado'}
*Profissional:* ${professionalName}
*Forma de Pagamento:* ${appointment.payment_method || 'Não especificada'}

Por favor, confirme o cancelamento. Obrigado!`;

    // Tentar codificação diferente para preservar emojis
    const encodedMessage = encodeURIComponent(message).replace(/%20/g, '%20');
    const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMessage}`;

    console.log('🔍 DEBUG - Mensagem original:', message);
    console.log('🔍 DEBUG - Mensagem codificada:', encodedMessage);
    console.log('🔍 DEBUG - URL final:', whatsappUrl);
    window.open(whatsappUrl, '_blank');

    // Fechar o modal após enviar
    setShowWhatsAppModal(false);
    setEstablishmentWhatsAppConfig(null);
  };

  const performCancel = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Cancelando agendamento:', appointmentId);
      console.log('🔍 DEBUG - appointment:', appointment);
      console.log('🔍 DEBUG - appointment.is_subscriber:', appointment?.is_subscriber);
      console.log('🔍 DEBUG - appointment keys:', Object.keys(appointment || {}));

      // 🔥 VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA PARA ASSINANTES
      if (appointment?.is_subscriber) {
        console.log('🔍 Verificando se é assinante e se pode cancelar...');

        // Verificar se o estabelecimento tem a configuração ativada
        const { data: establishment, error: establishmentError } = await supabase
          .from('establishments')
          .select('prevent_same_day_reschedule')
          .eq('id', appointment.establishment_id)
          .single();

        console.log('🔍 DEBUG - establishment:', establishment);
        console.log('🔍 DEBUG - establishmentError:', establishmentError);

        if (establishmentError) {
          console.error('Erro ao buscar configuração do estabelecimento:', establishmentError);
        } else if (establishment?.prevent_same_day_reschedule) {
          console.log('🔍 DEBUG - Configuração ativada, mostrando aviso...');
          // Mostrar aviso de confirmação
          const confirmCancel = window.confirm(
            '⚠️ Atenção: você é um assinante, o sistema não deixa desmarcar e agendar para o mesmo dia.\n\n' +
            'Tem certeza que deseja cancelar?'
          );

          if (!confirmCancel) {
            setIsLoading(false);
            return; // Usuário cancelou a ação
          }
        }
      }

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

      {/* Modal de cancelamento via WhatsApp */}
      <CancellationWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onConfirmCancellation={handleConfirmCancellationWhatsApp}
        appointmentData={{
          serviceName: appointment?.service_name || 'Serviço não especificado',
          establishmentName: appointment?.establishment_name || '',
          appointmentDate: appointment?.appointment_date || '',
          appointmentTime: appointment?.appointment_time || '',
          professionalName: appointment?.professional_name || 'Não especificado'
        }}
      />
    </>
  );
}