import React, { useState } from 'react';
import { ArrowRightLeft, X, User, Clock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Professional {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  client_name: string;
  appointment_date: string;
  appointment_time: string;
  service: string;
  professional: string;
}

interface TransferAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (appointmentId: string, toProfessionalId: string) => Promise<void>;
  appointment: Appointment | null;
  professionals: Professional[];
  currentProfessionalName: string;
}

export function TransferAppointmentModal({
  isOpen,
  onClose,
  onTransfer,
  appointment,
  professionals,
  currentProfessionalName
}: TransferAppointmentModalProps) {
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const handleTransfer = async () => {
    if (!appointment || !selectedProfessionalId) {
      toast.error('Selecione um profissional para transferir');
      return;
    }

    setIsTransferring(true);
    try {
      await onTransfer(appointment.id, selectedProfessionalId);
      onClose();
      setSelectedProfessionalId('');
    } catch (error) {
      console.error('Erro ao transferir agendamento:', error);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleClose = () => {
    if (!isTransferring) {
      onClose();
      setSelectedProfessionalId('');
    }
  };

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Transferir Agendamento
                </h3>
                <p className="text-sm text-gray-600">
                  {appointment.client_name}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isTransferring}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Appointment Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-900 font-medium">
                {new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-900 font-medium">
                {appointment.appointment_time}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-900 font-medium">
                Atual: {currentProfessionalName}
              </span>
            </div>
            <div className="text-sm text-gray-900">
              <strong className="text-gray-900">Serviço:</strong> {appointment.service}
            </div>
          </div>

          {/* Professional Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Transferir para:
            </label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              disabled={isTransferring}
            >
              <option value="" className="text-gray-900 bg-white">Selecione um profissional</option>
              {professionals
                .filter(prof => prof.id !== appointment.professional)
                .map(professional => (
                  <option key={professional.id} value={professional.id} className="text-gray-900 bg-white">
                    {professional.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isTransferring}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isTransferring || !selectedProfessionalId}
            >
              {isTransferring ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Transferindo...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Transferir
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
