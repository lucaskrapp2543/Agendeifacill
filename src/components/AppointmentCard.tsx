import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PixProofViewer } from './PixProofViewer';

interface AppointmentCardProps {
  appointment: {
    id: string;
    client_name: string;
    service: string;
    professional: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    payment_method?: string;
    pix_proof_url?: string;
    pix_payment_status?: string;
    price: number;
  };
  onCancel?: () => void;
  showCancelButton?: boolean;
}

export const AppointmentCard = ({ 
  appointment,
  onCancel,
  showCancelButton = true
}: AppointmentCardProps) => {
  const formattedDate = format(new Date(appointment.appointment_date), 'dd/MM/yyyy', { locale: ptBR });
  
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-200">{appointment.client_name}</h3>
          <p className="text-sm text-gray-400">{appointment.service}</p>
        </div>
        <div className={`px-2 py-1 rounded text-sm ${
          appointment.status === 'confirmed' ? 'bg-green-500/20 text-green-500' :
          appointment.status === 'cancelled' ? 'bg-red-500/20 text-red-500' :
          'bg-yellow-500/20 text-yellow-500'
        }`}>
          {appointment.status === 'confirmed' ? '✅ Confirmado' :
           appointment.status === 'cancelled' ? '❌ Cancelado' :
           '⏳ Pendente'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-400">Data</p>
          <p className="text-gray-200">{formattedDate}</p>
        </div>
        <div>
          <p className="text-gray-400">Horário</p>
          <p className="text-gray-200">{appointment.appointment_time}</p>
        </div>
        <div>
          <p className="text-gray-400">Profissional</p>
          <p className="text-gray-200">{appointment.professional}</p>
        </div>
        <div>
          <p className="text-gray-400">Valor</p>
          <p className="text-gray-200">R$ {appointment.price.toFixed(2).replace('.', ',')}</p>
        </div>
      </div>

      {appointment.payment_method === 'pix' && (
        <div className="border-t border-gray-700 pt-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">Pagamento</p>
              <p className="text-gray-200">PIX</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Status</p>
              <p className={`text-sm ${
                appointment.pix_payment_status === 'confirmado' ? 'text-green-500' :
                appointment.pix_payment_status === 'rejeitado' ? 'text-red-500' :
                'text-yellow-500'
              }`}>
                {appointment.pix_payment_status === 'confirmado' ? '✅ Confirmado' :
                 appointment.pix_payment_status === 'rejeitado' ? '❌ Rejeitado' :
                 '⏳ Em análise'}
              </p>
            </div>
          </div>

          {appointment.pix_proof_url && (
            <div className="mt-2">
              <PixProofViewer proofUrl={appointment.pix_proof_url} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {showCancelButton && appointment.status !== 'cancelled' && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-400 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}; 