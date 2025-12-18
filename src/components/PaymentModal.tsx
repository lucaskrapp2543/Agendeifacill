import { CreditCard, Loader2, QrCode, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from './ui/Toaster';
// Import removido - agora usa API Routes
import { supabase } from '../lib/supabase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  amount: number; // Valor em reais
  establishmentId: string;
  recipientId: string; // ID do recebedor na Pagar.me
  onPaymentSuccess: (clientPhone?: string) => void;
  onPaymentFailure: () => void;
  customerData: {
    name: string;
    email?: string;
    phone?: string;
    document?: string;
  };
}

type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | null;

export const PaymentModal = ({
  isOpen,
  onClose,
  appointmentId,
  amount,
  establishmentId,
  recipientId,
  onPaymentSuccess,
  onPaymentFailure,
  customerData
}: PaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string>('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>('');
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [cpfCliente, setCpfCliente] = useState<string>(customerData.document || '');
  const { toast } = useToast();

  // Valor em centavos
  const amountInCents = Math.round(amount * 100);
  // O split é montado no BACKEND (Express) para não expor/configurar recipient da plataforma no frontend.

  const handlePayment = async (method: PaymentMethod) => {
    if (!method) return;

    // ⚠️ Cartão (crédito/débito) exige captura segura de dados do cartão (tokenização/checkout).
    // Hoje o sistema ainda não possui UI + fluxo seguro para cartão, então evitamos travar o usuário.
    if (method === 'credit_card' || method === 'debit_card') {
      toast('Cartão (crédito/débito) ainda não está disponível. Use PIX para concluir o pagamento.', 'warning');
      return;
    }

    // PIX costuma exigir CPF do cliente na Pagar.me
    if (method === 'pix') {
      const cpfDigits = String(cpfCliente || '').replace(/\D/g, '');
      if (cpfDigits.length !== 11) {
        toast('Informe um CPF válido (11 dígitos) para gerar o PIX.', 'error');
        return;
      }
    }

    // ✅ IMPORTANTE: sem isso o modal não muda de tela (fica preso na seleção)
    setSelectedMethod(method);
    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');

    try {
      // Timeout no frontend para não ficar preso se o servidor travar
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);

      // Criar pagamento na Pagar.me via API Route
      const paymentResponse = await fetch('/api/pagarme/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: amountInCents, // Valor já em centavos
          payment_method: method,
          customer: {
            name: customerData.name,
            email: customerData.email,
            document: String(cpfCliente || customerData.document || '').replace(/\D/g, ''),
            phone: customerData.phone,
          },
          split_rules: [
            {
              recipient_id: recipientId,
              amount: amountInCents, // Backend aplica split (R$ 1,00 plataforma + resto estabelecimento)
              type: 'flat',
              liable: true,
              charge_processing_fee: false
            }
          ],
          metadata: {
            appointment_id: appointmentId,
            establishment_id: establishmentId
          }
        }),
      });

      window.clearTimeout(timeoutId);

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        const msg =
          errorData.userMessage ||
          errorData.error ||
          `Erro ${paymentResponse.status}`;
        throw new Error(msg);
      }

      const paymentResult = await paymentResponse.json();

      // Se for PIX, mostrar QR Code
      if (method === 'pix' && paymentResult.pix?.qr_code) {
        setPixQrCode(paymentResult.pix.qr_code);
        setPixQrCodeUrl(paymentResult.pix.qr_code_url || '');

        // Iniciar verificação de pagamento
        setIsCheckingPayment(true);
        checkPaymentStatusPeriodically(paymentResult.id);
        setIsProcessing(false);
      } else if (paymentResult.status === 'paid' || paymentResult.status === 'authorized') {
        // Pagamento aprovado imediatamente (cartão)
        await confirmAppointment(paymentResult.id);
      } else {
        toast('Pagamento processado. Aguardando confirmação...', 'warning');
        // Verificar status periodicamente
        setIsCheckingPayment(true);
        checkPaymentStatusPeriodically(paymentResult.id);
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar pagamento:', error);
      const isAbort = error?.name === 'AbortError';
      toast(
        isAbort
          ? 'O servidor de pagamentos demorou demais para responder. Tente novamente.'
          : `Erro ao processar pagamento: ${error.message}`,
        'error'
      );
      setIsProcessing(false);
      setIsCheckingPayment(false);
      setSelectedMethod(null);
      onPaymentFailure();
    }
  };

  const checkPaymentStatusPeriodically = async (transactionId: string) => {
    const maxAttempts = 60; // 5 minutos (60 tentativas × 5 segundos)
    let attempts = 0;

    const checkInterval = setInterval(async () => {
      attempts++;

      try {
        // Chamar API Route para verificar status
        const statusResponse = await fetch(`/api/pagarme/check-status?orderId=${transactionId}`);

        if (!statusResponse.ok) {
          throw new Error('Erro ao verificar status');
        }

        const { status } = await statusResponse.json();

        const normalized = String(status || '').toLowerCase();
        if (normalized === 'paid' || normalized === 'authorized') {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          await confirmAppointment(transactionId);
        } else if (
          normalized === 'refused' ||
          normalized === 'pending_refund' ||
          normalized === 'failed' ||
          normalized === 'canceled' ||
          normalized === 'cancelled' ||
          normalized === 'voided'
        ) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          toast('Pagamento recusado ou cancelado', 'error');
          await cancelAppointment();
          onPaymentFailure();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          toast('Tempo limite de pagamento excedido', 'error');
          await cancelAppointment();
          onPaymentFailure();
        }
      } catch (error: any) {
        console.error('❌ Erro ao verificar status do pagamento:', error);
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          await cancelAppointment();
          onPaymentFailure();
        }
      }
    }, 5000); // Verificar a cada 5 segundos
  };

  const confirmAppointment = async (transactionId: string) => {
    try {
      // Atualizar agendamento como confirmado
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_transaction_id: transactionId,
          payment_method: selectedMethod
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao confirmar agendamento:', error);
        toast('Erro ao confirmar agendamento', 'error');
        return;
      }

      toast('Pagamento confirmado! Agendamento realizado com sucesso.', 'success');
      setIsProcessing(false);

      // Buscar telefone do agendamento para redirecionamento
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('client_whatsapp')
        .eq('id', appointmentId)
        .single();

      // Passar telefone para o callback de sucesso
      onPaymentSuccess(appointmentData?.client_whatsapp || '');
      onClose();
    } catch (error: any) {
      console.error('❌ Erro ao confirmar agendamento:', error);
      toast('Erro ao confirmar agendamento', 'error');
    }
  };

  const cancelAppointment = async () => {
    try {
      // Cancelar agendamento
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          payment_status: 'failed'
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao cancelar agendamento:', error);
      }
    } catch (error: any) {
      console.error('❌ Erro ao cancelar agendamento:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Pagamento Antecipado
          </h2>
          {!isProcessing && !isCheckingPayment && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {!selectedMethod ? (
          <div className="space-y-4">
            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                💳 Para confirmar seu agendamento, é necessário realizar o pagamento antecipado de <strong>R$ {amount.toFixed(2)}</strong>.
              </p>
            </div>

            <div className="bg-[#2a2b2c] border border-gray-700 rounded-lg p-4">
              <label className="block text-sm text-gray-300 mb-2">CPF do pagador (obrigatório para PIX)</label>
              <input
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                placeholder="Somente números (11 dígitos)"
                className="w-full px-3 py-2 rounded-md bg-[#1a1b1c] border border-gray-600 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-400 mt-2">
                A Pagar.me costuma exigir CPF para gerar o QR Code do PIX.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handlePayment('pix')}
                className="w-full p-4 bg-[#2a2b2c] border border-gray-600 rounded-lg hover:border-blue-500 transition-colors flex items-center gap-3"
              >
                <QrCode className="h-6 w-6 text-blue-400" />
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">PIX</div>
                  <div className="text-sm text-gray-400">Aprovação imediata</div>
                </div>
              </button>

              <button
                onClick={() => handlePayment('credit_card')}
                disabled
                className="w-full p-4 bg-[#2a2b2c] border border-gray-700 rounded-lg opacity-60 cursor-not-allowed flex items-center gap-3"
              >
                <CreditCard className="h-6 w-6 text-green-400" />
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">Cartão de Crédito</div>
                  <div className="text-sm text-gray-400">Em breve</div>
                </div>
              </button>

              <button
                onClick={() => handlePayment('debit_card')}
                disabled
                className="w-full p-4 bg-[#2a2b2c] border border-gray-700 rounded-lg opacity-60 cursor-not-allowed flex items-center gap-3"
              >
                <Wallet className="h-6 w-6 text-purple-400" />
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">Cartão de Débito</div>
                  <div className="text-sm text-gray-400">Em breve</div>
                </div>
              </button>
            </div>
          </div>
        ) : pixQrCode ? (
          <div className="space-y-4">
            <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-300 text-center">
                Escaneie o QR Code abaixo para pagar via PIX
              </p>
            </div>

            <div className="flex justify-center mb-4">
              {pixQrCodeUrl ? (
                <div className="bg-white p-4 rounded-lg">
                  <img src={pixQrCodeUrl} alt="QR Code PIX" className="w-64 h-64" />
                </div>
              ) : null}
            </div>

            {/* PIX Copia e Cola (sempre que existir qr_code) */}
            <div className="w-full">
              <p className="text-sm text-gray-300 mb-2 text-center">PIX Copia e Cola</p>
              <textarea
                value={pixQrCode}
                readOnly
                className="w-full h-28 px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-gray-200 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pixQrCode);
                    toast('Código PIX copiado!', 'success');
                  } catch {
                    toast('Não foi possível copiar. Selecione e copie manualmente.', 'warning');
                  }
                }}
                className="w-full mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                COPIAR CÓDIGO PIX
              </button>
            </div>

            {isCheckingPayment && (
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Aguardando confirmação do pagamento...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-300 text-center">
              Processando pagamento via {selectedMethod === 'credit_card' ? 'Cartão de Crédito' : 'Cartão de Débito'}...
            </p>
            {(isProcessing || isCheckingPayment) && (
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isCheckingPayment ? 'Aguardando confirmação do pagamento...' : 'Processando...'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

