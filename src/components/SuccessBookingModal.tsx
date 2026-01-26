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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-md mx-auto overflow-hidden"
        style={{
          background: '#1A1A1A',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
        }}
      >
        <div className="p-6">
          {/* Ícone */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}>
              <CheckCircle className="w-8 h-8" style={{ color: '#E6C78B' }} />
            </div>
          </div>

          {/* Título */}
          <h2 className="text-xl font-extrabold text-center mb-2" style={{ color: '#E6C78B' }}>
            {isConfirmationStep ? 'Confirmação' :
              enableWhatsAppNotifications ? 'Está quase lá!' : 'Agendamento concluído com sucesso!'}
          </h2>

          {/* Mensagem principal */}
          <p className="text-center mb-6" style={{ color: '#A1A1A1' }}>
            {isConfirmationStep
              ? 'Tem certeza que deseja não ativar o lembrete? Se não ativar, você pode esquecer de ir e prejudicar seu profissional.'
              : enableWhatsAppNotifications
                ? '⚠️ IMPORTANTE: para concluir, toque em "Confirmar" e avise seu barbeiro no WhatsApp.'
                : 'Clique abaixo para ativar o lembrete.'
            }
          </p>

          {/* Aviso extra (apenas no fluxo WhatsApp) */}
          {!isConfirmationStep && enableWhatsAppNotifications && (
            <div
              className="rounded-2xl p-4 mb-6 text-sm font-semibold"
              style={{
                background: 'rgba(230,199,139,0.10)',
                border: '1px solid rgba(230,199,139,0.30)',
                color: '#E6C78B'
              }}
            >
              Se você fechar esta tela sem confirmar, <span className="text-white font-extrabold">seu barbeiro pode não ser avisado</span> e seu horário pode ficar sem confirmação.
            </div>
          )}

          {/* Dados do agendamento (apenas no passo inicial) */}
          {!isConfirmationStep && appointmentData && (
            <div className="rounded-2xl p-4 mb-6" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-extrabold text-white mb-2">Detalhes do agendamento:</h3>
              <div className="space-y-1 text-sm" style={{ color: '#A1A1A1' }}>
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
                className="flex-1 px-4 py-3 rounded-xl transition-colors font-semibold hover:bg-white/5"
                style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)', color: '#A1A1A1' }}
              >
                Voltar
              </button>
            )}

            {/* Renderizar botões baseado na configuração */}
            {enableWhatsAppNotifications && !isConfirmationStep ? (
              // Nova interface para WhatsApp
              <button
                onClick={onConfirmWhatsApp}
                className="flex-1 px-4 py-3 rounded-xl transition-colors font-extrabold flex items-center justify-center gap-2 active:scale-[0.99]"
                style={{ background: '#E6C78B', color: '#0B0B0B' }}
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar
              </button>
            ) : (
              // Interface original para lembretes
              <>
                <button
                  onClick={isConfirmationStep ? onActivateReminder : onDontActivate}
                  className="flex-1 px-4 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-extrabold"
                  style={isConfirmationStep
                    ? { background: '#E6C78B', color: '#0B0B0B' }
                    : { background: '#151515', border: '1px solid rgba(255,255,255,0.06)', color: '#A1A1A1' }}
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
                  className="flex-1 px-4 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-extrabold"
                  style={isConfirmationStep
                    ? { background: '#151515', border: '1px solid rgba(255,255,255,0.06)', color: '#A1A1A1' }
                    : { background: '#E6C78B', color: '#0B0B0B' }}
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
