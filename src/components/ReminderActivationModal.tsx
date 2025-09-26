import React from 'react';
import { Clock, Bell, BellOff, ArrowLeft } from 'lucide-react';

interface ReminderActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateReminder: () => void;
  onDontActivate: () => void;
  step: 'initial' | 'confirmation';
  appointmentData?: {
    serviceName: string;
    establishmentName: string;
    appointmentDate: string;
    appointmentTime: string;
    location?: string;
  };
}

export const ReminderActivationModal: React.FC<ReminderActivationModalProps> = ({
  isOpen,
  onClose,
  onActivateReminder,
  onDontActivate,
  step,
  appointmentData
}) => {
  if (!isOpen) return null;

  const isConfirmationStep = step === 'confirmation';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-auto">
        <div className="p-6">
          {/* Ícone */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          {/* Título */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            {isConfirmationStep ? 'Confirmação' : 'Agendamento concluído com sucesso!'}
          </h2>

          {/* Mensagem principal */}
          <p className="text-gray-600 text-center mb-6">
            {isConfirmationStep 
              ? 'Tem certeza que deseja não ativar o lembrete?\nSe não ativar, o seu barbeiro pode não ser notificado do seu agendamento.'
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
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
            
            <button
              onClick={isConfirmationStep ? onActivateReminder : onDontActivate}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isConfirmationStep 
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
                  <BellOff className="w-4 h-4" />
                  Não ativar
                </>
              )}
            </button>

            <button
              onClick={isConfirmationStep ? onDontActivate : onActivateReminder}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isConfirmationStep 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isConfirmationStep ? (
                <>
                  <BellOff className="w-4 h-4" />
                  Não ativar
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Ativar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
