import { Bell, CheckCircle } from 'lucide-react';
import React from 'react';

interface SuccessBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateReminder: () => void;
  onDontActivate: () => void;
  onConfirmWhatsApp?: () => void; // Nova função para confirmar via WhatsApp
  step: 'initial' | 'confirmation';
  appointmentData?: {
    serviceName: string;
    establishmentName: string;
    appointmentDate: string;
    appointmentTime: string;
    location?: string;
    professionalName?: string; // Adicionar nome do profissional
  };
  enableWhatsAppNotifications?: boolean; // Nova prop para controlar a exibição
}

export const SuccessBookingModal: React.FC<SuccessBookingModalProps> = ({
  isOpen,
  onClose,
  onActivateReminder,
  onDontActivate,
  onConfirmWhatsApp,
  step,
  appointmentData,
  enableWhatsAppNotifications = false
}) => {
  if (!isOpen) return null;

  const isConfirmationStep = step === 'confirmation';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-auto">
        <div className="p-6">
          {/* Ícone */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Título */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            {isConfirmationStep ? 'Confirmação' :
              enableWhatsAppNotifications ? 'Está quase lá!' : 'Agendamento concluído com sucesso!'}
          </h2>

          {/* Mensagem principal */}
          <p className="text-gray-600 text-center mb-6">
            {isConfirmationStep
              ? 'Tem certeza que deseja não ativar o lembrete? Se não ativar, você pode esquecer de ir e prejudicar seu profissional.'
              : enableWhatsAppNotifications
                ? 'Para finalizar o agendamento, clique no botão Confirmar. Assim, enviaremos uma notificação para o seu barbeiro informando o serviço.'
                : 'Clique abaixo para ativar o lembrete.'
            }
          </p>

          {/* Dados do agendamento (apenas no passo inicial) */}
          {!isConfirmationStep && appointmentData && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Detalhes do agendamento:</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>Serviço:</strong> {appointmentData.serviceName}</p>
                <p><strong>Local:</strong> {appointmentData.establishmentName}</p>
                <p><strong>Data:</strong> {appointmentData.appointmentDate}</p>
                <p><strong>Horário:</strong> {appointmentData.appointmentTime}</p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3">
            {isConfirmationStep && (
              <button
                onClick={() => onClose()}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
            )}

            {/* Renderizar botões baseado na configuração */}
            {enableWhatsAppNotifications && !isConfirmationStep ? (
              // Nova interface para WhatsApp
              <button
                onClick={onConfirmWhatsApp}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar
              </button>
            ) : (
              // Interface original para lembretes
              <>
                <button
                  onClick={isConfirmationStep ? onActivateReminder : onDontActivate}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${isConfirmationStep
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {isConfirmationStep ? (
                    <>
                      <Bell className="w-4 h-4" />
                      Quero ativar notificação
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Não ativar
                    </>
                  )}
                </button>

                <button
                  onClick={isConfirmationStep ? onDontActivate : onActivateReminder}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${isConfirmationStep
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {isConfirmationStep ? (
                    <>
                      <Bell className="w-4 h-4" />
                      Não ativar
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Ativar
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
