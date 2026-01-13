import { CreditCard, Loader2, QrCode, Wallet, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from './ui/Toaster';
// Import removido - agora usa API Routes
import { supabase } from '../lib/supabase';
import { criarTokenCartaoPagarme } from '../lib/pagarmeTokenize';

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
  // Se false: não cancela agendamento se o cliente não pagar (modo opcional)
  cancelAppointmentOnFailure?: boolean;
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
  customerData,
  cancelAppointmentOnFailure = true,
}: PaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string>('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>('');
  const [pixExpiresInSeconds, setPixExpiresInSeconds] = useState<number>(90);
  const [pixRemainingSeconds, setPixRemainingSeconds] = useState<number>(0);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [cpfCliente, setCpfCliente] = useState<string>(customerData.document || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [billingCep, setBillingCep] = useState('');
  const [billingRua, setBillingRua] = useState('');
  const [billingNumero, setBillingNumero] = useState('');
  const [billingBairro, setBillingBairro] = useState('');
  const [billingCidade, setBillingCidade] = useState('');
  const [billingUf, setBillingUf] = useState('');
  const [cardRefusedReason, setCardRefusedReason] = useState<string>('');
  const { toast } = useToast();
  const pixCountdownIntervalRef = useRef<number | null>(null);

  // Valor em centavos
  const amountInCents = Math.round(amount * 100);
  // O split é montado no BACKEND (Express) para não expor/configurar recipient da plataforma no frontend.

  const handlePayment = async (method: PaymentMethod) => {
    if (!method) return;

    // CPF/CNPJ costuma ser exigido na Pagar.me (PIX e cartão)
    const docDigits = String(cpfCliente || '').replace(/\D/g, '');
    if (!(docDigits.length === 11 || docDigits.length === 14)) {
      toast('Informe um CPF (11) ou CNPJ (14) válido para continuar.', 'error');
      return;
    }

    // ✅ IMPORTANTE: sem isso o modal não muda de tela (fica preso na seleção)
    setSelectedMethod(method);
    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');
    // limpar banner de fallback quando tentar pagar de novo
    setCardRefusedReason('');

    try {
      // Se for cartão, tokenizar no FRONTEND (pk_ via /tokens?appId=...)
      let cardToken: string | undefined = undefined;
      let billingAddress: any = undefined;
      if (method === 'credit_card' || method === 'debit_card') {
        const numberDigits = String(cardNumber || '').replace(/\D/g, '');
        const expMonthDigits = String(cardExpMonth || '').replace(/\D/g, '');
        const expYearDigits = String(cardExpYear || '').replace(/\D/g, '');
        const cvvDigits = String(cardCvv || '').replace(/\D/g, '');
        const holder = String(cardHolderName || '').trim();

        if (numberDigits.length < 13 || numberDigits.length > 19) {
          toast('Número do cartão inválido.', 'error');
          setIsProcessing(false);
          return;
        }
        const monthNum = Number(expMonthDigits);
        if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
          toast('Mês de validade inválido (1 a 12).', 'error');
          setIsProcessing(false);
          return;
        }
        if (!expYearDigits || expYearDigits.length < 2) {
          toast('Ano de validade inválido.', 'error');
          setIsProcessing(false);
          return;
        }
        if (cvvDigits.length < 3 || cvvDigits.length > 4) {
          toast('CVV inválido.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!holder) {
          toast('Informe o nome do titular do cartão.', 'error');
          setIsProcessing(false);
          return;
        }

        const cepDigits = String(billingCep || '').replace(/\D/g, '');
        const uf = String(billingUf || '').trim().toUpperCase();
        const cidade = String(billingCidade || '').trim();
        const rua = String(billingRua || '').trim();
        const numero = String(billingNumero || '').trim();
        const bairro = String(billingBairro || '').trim();

        if (cepDigits.length !== 8) {
          toast('Informe um CEP válido (8 dígitos) para o endereço de cobrança.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!rua || !numero) {
          toast('Informe rua e número do endereço de cobrança.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!cidade) {
          toast('Informe a cidade do endereço de cobrança.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!uf || uf.length !== 2) {
          toast('Informe a UF do endereço de cobrança (2 letras, ex: SC).', 'error');
          setIsProcessing(false);
          return;
        }

        billingAddress = {
          line_1: bairro ? `${rua}, ${numero} - ${bairro}` : `${rua}, ${numero}`,
          zip_code: cepDigits,
          city: cidade,
          state: uf,
          country: 'BR',
        };

        cardToken = await criarTokenCartaoPagarme({
          number: numberDigits,
          holder_name: holder,
          exp_month: String(monthNum).padStart(2, '0'),
          exp_year: expYearDigits,
          cvv: cvvDigits,
          holder_document: docDigits,
        });
      }

      // Timeout no frontend para não ficar preso se o servidor travar
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);

      // Criar pagamento na Pagar.me via API Route
      const createPaymentUrl = import.meta.env.PROD
        ? '/.netlify/functions/pagarme-create-payment'
        : '/api/pagarme/create-payment';

      const paymentResponse = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: amountInCents, // Valor já em centavos
          payment_method: method,
          ...(cardToken ? { card_token: cardToken } : {}),
          ...(billingAddress ? { billing_address: billingAddress } : {}),
          customer: {
            name: customerData.name,
            email: customerData.email,
            document: docDigits,
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

      // ✅ Importante: persistir o ID da transação no Supabase assim que o pagamento é criado.
      // Isso evita perder referência caso o usuário feche/recarregue a página antes da confirmação,
      // e permite reconciliação futura.
      try {
        if (paymentResult?.id) {
          const methodToStore =
            method === 'pix' ? 'pix' : method === 'credit_card' ? 'credito' : 'debito';
          await supabase
            .from('appointments')
            .update({
              payment_transaction_id: paymentResult.id,
              // Salvar método escolhido no agendamento para consistência
              payment_method: methodToStore,
              // se for PIX, deixar explícito que foi iniciado via Pagar.me
              ...(method === 'pix' ? { pix_payment_status: 'enviado' } : {}),
            })
            .eq('id', appointmentId);
        }
      } catch (e) {
        // Não bloquear o fluxo de pagamento por falha de log; apenas registrar.
        console.warn('⚠️ Não foi possível salvar payment_transaction_id no Supabase:', e);
      }

      // Se for PIX, mostrar QR Code
      if (method === 'pix' && paymentResult.pix?.qr_code) {
        setPixQrCode(paymentResult.pix.qr_code);
        setPixQrCodeUrl(paymentResult.pix.qr_code_url || '');
        const expiresIn = Number(paymentResult.pix?.expires_in || 90);
        const safeExpiresIn = Number.isFinite(expiresIn) && expiresIn > 0 ? Math.floor(expiresIn) : 90;
        setPixExpiresInSeconds(safeExpiresIn);
        setPixRemainingSeconds(safeExpiresIn);

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
      // Em erro genérico, manter comportamento atual
      onPaymentFailure();
    }
  };

  // Countdown do PIX (expira e encerra fluxo)
  useEffect(() => {
    // limpar interval anterior
    if (pixCountdownIntervalRef.current) {
      window.clearInterval(pixCountdownIntervalRef.current);
      pixCountdownIntervalRef.current = null;
    }

    if (!pixQrCode || !isCheckingPayment || pixRemainingSeconds <= 0) return;

    pixCountdownIntervalRef.current = window.setInterval(() => {
      setPixRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (pixCountdownIntervalRef.current) {
        window.clearInterval(pixCountdownIntervalRef.current);
        pixCountdownIntervalRef.current = null;
      }
    };
  }, [pixQrCode, isCheckingPayment, pixRemainingSeconds]);

  useEffect(() => {
    // Quando zerar, expirar
    if (!pixQrCode) return;
    if (!isCheckingPayment) return;
    if (pixRemainingSeconds > 0) return;

    const handleExpire = async () => {
      try {
        setIsCheckingPayment(false);
        toast('⏳ Tempo do PIX expirou. Gere novamente para pagar.', 'warning');
        if (cancelAppointmentOnFailure) {
          await cancelAppointment();
        } else {
          await markAppointmentPaymentUnpaid();
        }
      } finally {
        onPaymentFailure();
        onClose();
      }
    };

    handleExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixRemainingSeconds, pixQrCode, isCheckingPayment]);

  const formatMMSS = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const checkPaymentStatusPeriodically = async (transactionId: string) => {
    const maxAttempts = 60; // 5 minutos (60 tentativas × 5 segundos)
    let attempts = 0;

    const checkInterval = setInterval(async () => {
      attempts++;

      try {
        // Chamar API Route para verificar status
        const checkStatusUrl = import.meta.env.PROD
          ? `/.netlify/functions/pagarme-check-status?orderId=${transactionId}`
          : `/api/pagarme/check-status?orderId=${transactionId}`;

        const statusResponse = await fetch(checkStatusUrl);

        if (!statusResponse.ok) {
          throw new Error('Erro ao verificar status');
        }

        const { status, reason } = await statusResponse.json();

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
          const reasonStr = String(reason || '');

          // ✅ Qualquer recusa no cartão -> oferecer PIX sem zerar o atendimento
          if (selectedMethod === 'credit_card' || selectedMethod === 'debit_card') {
            setCardRefusedReason(reasonStr || 'Pagamento no cartão recusado');
            toast('Pagamento no cartão recusado. Você pode pagar via PIX sem refazer o agendamento.', 'warning');
            await markAppointmentPaymentUnpaid(); // nunca cancela aqui
            setIsProcessing(false);
            setSelectedMethod(null); // volta para seleção e mostra botão PIX
            return;
          }

          toast(
            reasonStr ? `Pagamento recusado/cancelado: ${reasonStr}` : 'Pagamento recusado ou cancelado',
            'error'
          );
          if (cancelAppointmentOnFailure) {
            await cancelAppointment();
          } else {
            await markAppointmentPaymentUnpaid();
          }
          onPaymentFailure();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          toast('Tempo limite de pagamento excedido', 'error');
          if (cancelAppointmentOnFailure) {
            await cancelAppointment();
          } else {
            await markAppointmentPaymentUnpaid();
          }
          onPaymentFailure();
        }
      } catch (error: any) {
        console.error('❌ Erro ao verificar status do pagamento:', error);
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          if (cancelAppointmentOnFailure) {
            await cancelAppointment();
          } else {
            await markAppointmentPaymentUnpaid();
          }
          onPaymentFailure();
        }
      }
    }, 5000); // Verificar a cada 5 segundos
  };

  const markAppointmentPaymentUnpaid = async () => {
    try {
      await supabase
        .from('appointments')
        .update({
          payment_status: 'unpaid',
        })
        .eq('id', appointmentId);
    } catch (error) {
      console.error('❌ Erro ao marcar pagamento como unpaid:', error);
    }
  };

  const confirmAppointment = async (transactionId: string) => {
    try {
      const methodToStore =
        selectedMethod === 'pix'
          ? 'pix'
          : selectedMethod === 'credit_card'
            ? 'credito'
            : selectedMethod === 'debit_card'
              ? 'debito'
              : 'pix';

      // Atualizar agendamento como confirmado
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_transaction_id: transactionId,
          payment_method: methodToStore,
          ...(methodToStore === 'pix' ? { pix_payment_status: 'confirmado' } : {}),
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
            {cardRefusedReason ? (
              <div className="bg-red-900/30 border border-red-700/60 rounded-lg p-4">
                <p className="text-sm text-red-200 font-semibold">
                  Pagamento no cartão recusado
                </p>
                <p className="text-xs text-red-200/90 mt-1">
                  {cardRefusedReason}
                </p>
                <button
                  onClick={() => handlePayment('pix')}
                  className="w-full mt-3 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors"
                >
                  Pagar com PIX agora (sem refazer)
                </button>
              </div>
            ) : null}

            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                💳 {cancelAppointmentOnFailure
                  ? <>Para confirmar seu agendamento, é necessário realizar o pagamento antecipado de <strong>R$ {amount.toFixed(2)}</strong>.</>
                  : <>Parabéns pelo agendamento! Quer pagar agora <strong>R$ {amount.toFixed(2)}</strong> e já <strong>deixar seu barbeiro feliz</strong>?</>
                }
              </p>
            </div>

            <div className="bg-[#2a2b2c] border border-gray-700 rounded-lg p-4">
              <label className="block text-sm text-gray-300 mb-2">CPF/CNPJ do pagador (obrigatório para PIX e cartão)</label>
              <input
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                placeholder="Somente números (CPF 11 / CNPJ 14)"
                className="w-full px-3 py-2 rounded-md bg-[#1a1b1c] border border-gray-600 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-400 mt-2">
                A Pagar.me costuma exigir CPF/CNPJ para pagamentos (principalmente PIX e cartão).
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
                onClick={() => setSelectedMethod('credit_card')}
                className="w-full p-4 bg-[#2a2b2c] border border-gray-600 rounded-lg hover:border-green-500 transition-colors flex items-center gap-3"
              >
                <Wallet className="h-6 w-6 text-green-400" />
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">Cartão de Crédito</div>
                  <div className="text-sm text-gray-400">Tokenização segura (Pagar.me)</div>
                </div>
              </button>
            </div>
          </div>
        ) : selectedMethod === 'credit_card' && !pixQrCode ? (
          <div className="space-y-4">
            <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-sm text-green-200">
                Preencha os dados do cartão. O sistema gera um <strong>token</strong> e não envia o número do cartão para o servidor.
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-[#2a2b2c] border border-gray-700 rounded-lg p-4">
                <label className="block text-sm text-gray-300 mb-2">CPF/CNPJ do pagador (obrigatório)</label>
                <input
                  value={cpfCliente}
                  onChange={(e) => setCpfCliente(e.target.value)}
                  placeholder="Somente números (CPF 11 / CNPJ 14)"
                  className="w-full px-3 py-2 rounded-md bg-[#1a1b1c] border border-gray-600 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Número do cartão</label>
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome do titular</label>
                <input
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Como está no cartão"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-sm text-gray-300 mb-1">Mês</label>
                  <input
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="MM"
                    inputMode="numeric"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm text-gray-300 mb-1">Ano</label>
                  <input
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="AA ou AAAA"
                    inputMode="numeric"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm text-gray-300 mb-1">CVV</label>
                  <input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="123"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="mt-2 border-t border-gray-800 pt-3 space-y-3">
                <p className="text-sm text-gray-200 font-semibold">Endereço de cobrança (obrigatório no cartão)</p>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">CEP</label>
                  <input
                    value={billingCep}
                    onChange={(e) => setBillingCep(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Somente números"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Rua</label>
                  <input
                    value={billingRua}
                    onChange={(e) => setBillingRua(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Rua/Avenida"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Número</label>
                    <input
                      value={billingNumero}
                      onChange={(e) => setBillingNumero(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Nº"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Bairro (opcional)</label>
                    <input
                      value={billingBairro}
                      onChange={(e) => setBillingBairro(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Cidade</label>
                    <input
                      value={billingCidade}
                      onChange={(e) => setBillingCidade(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Cidade"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Estado (UF)</label>
                    <input
                      value={billingUf}
                      onChange={(e) => setBillingUf(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Ex: SC / SP / RJ"
                      maxLength={2}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">UF = sigla do estado (2 letras).</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handlePayment('credit_card')}
                disabled={isProcessing || isCheckingPayment}
                className="w-full mt-1 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  `Pagar com Cartão (R$ ${amount.toFixed(2)})`
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod(null)}
                disabled={isProcessing || isCheckingPayment}
                className="w-full px-4 py-2 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-semibold transition-colors border border-gray-700 disabled:opacity-60"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : pixQrCode ? (
          <div className="space-y-4">
            <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-300 text-center">
                Escaneie o QR Code abaixo para pagar via PIX
              </p>
              <p className="text-xs text-green-200/90 text-center mt-2">
                ⏱️ Tempo para pagar: <span className="font-bold">{formatMMSS(pixRemainingSeconds || pixExpiresInSeconds)}</span>
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
              Processando pagamento...
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

