import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

interface CancellationWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancellation: () => void;
  appointmentData?: {
    serviceName: string;
    establishmentName: string;
    appointmentDate: string;
    appointmentTime: string;
    professionalName?: string;
  };
}

export const CancellationWhatsAppModal: React.FC<CancellationWhatsAppModalProps> = ({
  isOpen,
  onClose,
  onConfirmCancellation,
  appointmentData
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-auto">
        <div className="p-6">
          {/* Ícone */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* Título */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Confirmar Cancelamento
          </h2>

          {/* Mensagem principal */}
          <p className="text-gray-600 text-center mb-6">
            Você está cancelando o serviço. Para confirmar de fato, clique em cancelar e irá enviar a notificação para seu profissional.
          </p>

          {/* Dados do agendamento */}
          {appointmentData && (
            <div className="bg-red-50 rounded-lg p-4 mb-6">
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
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>

            <button
              onClick={onConfirmCancellation}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
