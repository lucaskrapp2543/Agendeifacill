import { Copy, CreditCard, Loader2, QrCode, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CardPaymentBrick } from './CardPaymentBrick';

type BillingMethod = 'pix' | 'credit_card' | null;

interface EstablishmentBillingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  establishmentName: string;
  onPaid?: () => Promise<void> | void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');

export const EstablishmentBillingPaymentModal: React.FC<EstablishmentBillingPaymentModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  establishmentName,
  onPaid,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<BillingMethod>('pix');
  const [billingAmount, setBillingAmount] = useState<number>(0);
  const [isLoadingAmount, setIsLoadingAmount] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPayingCard, setIsPayingCard] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [pixCode, setPixCode] = useState('');
  const [pixQrBase64, setPixQrBase64] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [configError, setConfigError] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerDocument, setPayerDocument] = useState('');
  const [billingCep, setBillingCep] = useState('');
  const [billingRua, setBillingRua] = useState('');
  const [billingNumero, setBillingNumero] = useState('');
  const [billingBairro, setBillingBairro] = useState('');
  const [billingCidade, setBillingCidade] = useState('');
  const [billingUf, setBillingUf] = useState('');

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  const mpPublicKey = String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim();

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMethod('pix');
    setPixCode('');
    setPixQrBase64('');
    setPaymentId('');
    setStatusMessage('');
    setConfigError('');
    setBillingAmount(0);
    setPayerDocument('');
    setBillingCep('');
    setBillingRua('');
    setBillingNumero('');
    setBillingBairro('');
    setBillingCidade('');
    setBillingUf('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !establishmentId) return;

    const loadAuthEmail = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = String(data?.user?.email || '').trim().toLowerCase();
        if (email) setPayerEmail(email);
      } catch (error) {
        console.warn('Falha ao carregar e-mail autenticado:', error);
      }
    };

    const loadAmount = async () => {
      setIsLoadingAmount(true);
      try {
        const { data: est } = await supabase
          .from('establishments')
          .select('mercadopago_billing_amount')
          .eq('id', establishmentId)
          .maybeSingle();
        let v = Number((est as any)?.mercadopago_billing_amount ?? 0);
        if (!Number.isFinite(v) || v <= 0) {
          const { data: admin } = await supabase.from('admin_billing_links').select('mercadopago_billing_amount').eq('id', 'global').maybeSingle();
          v = Number((admin as any)?.mercadopago_billing_amount ?? 0);
        }
        if (Number.isFinite(v) && v > 0) setBillingAmount(v);
      } catch {
        /* RLS pode bloquear admin_billing_links — valor aparece após gerar PIX */
      } finally {
        setIsLoadingAmount(false);
      }
    };

    void loadAuthEmail();
    void loadAmount();
  }, [isOpen, establishmentId]);

  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.touchAction = originalBodyTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !paymentId) return;

    const interval = window.setInterval(async () => {
      setIsRefreshingStatus(true);
      try {
        const { data, error } = await (supabase as any)
          .from('establishment_billing_payments')
          .select('status, paid_at')
          .eq('payment_id', paymentId)
          .eq('establishment_id', establishmentId)
          .maybeSingle();

        if (error) throw error;

        const normalizedStatus = String((data as any)?.status || '').toLowerCase().trim();
        if (normalizedStatus === 'paid') {
          setStatusMessage('Pagamento confirmado! Seu sistema foi regularizado automaticamente.');
          if (onPaid) await onPaid();
          window.clearInterval(interval);
          return;
        }

        if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled' || normalizedStatus === 'refunded') {
          setStatusMessage('O pagamento foi recusado ou cancelado. Tente outro meio ou gere um novo pagamento.');
          window.clearInterval(interval);
          return;
        }
      } catch (error) {
        console.warn('Falha ao atualizar status da cobrança:', error);
      } finally {
        setIsRefreshingStatus(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isOpen, paymentId, establishmentId, onPaid]);

  const handleGeneratePix = async () => {
    setIsGenerating(true);
    setStatusMessage('');
    setConfigError('');
    try {
      const endpoint = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-establishment-billing'
        : '/api/mercadopago/create-establishment-billing';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          description: `Regularizacao Agendei Facil - ${establishmentName}`,
          payer: {
            email: `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = String(payload?.userMessage || payload?.error || `Erro ${response.status}`);
        setConfigError(message);
        throw new Error(message);
      }

      const trx = (payload as any)?.point_of_interaction?.transaction_data || {};
      const qrCode = String(trx?.qr_code || '').trim();
      const qrBase64Raw = String(trx?.qr_code_base64 || '').trim();
      if (!qrCode && !qrBase64Raw) {
        throw new Error('Nao foi possível gerar QR Code PIX.');
      }

      setPixCode(qrCode);
      setPixQrBase64(qrBase64Raw ? `data:image/png;base64,${qrBase64Raw}` : '');
      setPaymentId(String((payload as any)?.id || ''));
      const amountUsed = Number((payload as any)?.amount_brl_used ?? 0);
      if (Number.isFinite(amountUsed) && amountUsed > 0) {
        setBillingAmount(amountUsed);
      }
      setStatusMessage('PIX gerado! Após o pagamento, o sistema regulariza automaticamente.');
    } catch (error: any) {
      console.error('Erro ao gerar PIX de regularização:', error);
      setStatusMessage(String(error?.message || 'Erro ao gerar PIX.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPix = async () => {
    try {
      if (!pixCode) return;
      await navigator.clipboard.writeText(pixCode);
      setStatusMessage('Código PIX copiado.');
    } catch (error) {
      console.error('Erro ao copiar código PIX:', error);
      setStatusMessage('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  };

  const handleCardBrickSubmit = async (brickData: {
    token: string;
    payment_method_id: string;
    issuer_id: string;
    installments: number;
  }) => {
    if (!isValidEmail(payerEmail)) {
      setConfigError('Informe um e-mail válido.');
      return;
    }
    const docDigits = onlyDigits(payerDocument);
    if (docDigits.length !== 11 && docDigits.length !== 14) {
      setConfigError('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) do titular.');
      return;
    }
    const cepDigits = onlyDigits(billingCep);
    const rua = String(billingRua || '').trim();
    const numero = String(billingNumero || '').replace(/\D/g, '');
    const cidade = String(billingCidade || '').trim();
    const uf = String(billingUf || '').trim().toUpperCase();
    if (cepDigits.length !== 8 || !rua || !numero || !cidade || uf.length !== 2) {
      setConfigError('Preencha CEP, endereço, número, cidade e UF.');
      return;
    }

    const firstName = 'Cliente';
    const lastName = 'AgendeiFacil';

    setIsPayingCard(true);
    setConfigError('');
    setStatusMessage('');

    try {
      const endpoint = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-establishment-billing'
        : '/api/mercadopago/create-establishment-billing';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          description: `Regularizacao Agendei Facil - ${establishmentName}`,
          payment_method_id: brickData.payment_method_id,
          token: brickData.token,
          issuer_id: brickData.issuer_id,
          installments: brickData.installments,
          payer: {
            email: payerEmail,
            first_name: firstName,
            last_name: lastName,
            identification: {
              type: docDigits.length === 11 ? 'CPF' : 'CNPJ',
              number: docDigits,
            },
            address: {
              zip_code: cepDigits,
              street_name: rua,
              street_number: Number(numero) || 0,
              neighborhood: String(billingBairro || '').trim() || '—',
              city: cidade,
              federal_unit: uf,
            },
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String((payload as any)?.userMessage || (payload as any)?.error || `Erro ${response.status}`);
        setConfigError(message);
        throw new Error(message);
      }

      const pid = String((payload as any)?.id || '').trim();
      const st = String((payload as any)?.status || '').toLowerCase();
      const amountUsed = Number((payload as any)?.amount_brl_used ?? 0);
      if (Number.isFinite(amountUsed) && amountUsed > 0) setBillingAmount(amountUsed);

      if (!pid) throw new Error('Pagamento criado sem ID.');

      setPaymentId(pid);
      if (st === 'approved' || st === 'authorized') {
        setStatusMessage('Pagamento confirmado! Seu sistema foi regularizado automaticamente.');
        if (onPaid) await onPaid();
      } else {
        setStatusMessage('Pagamento em processamento. Aguarde a confirmação automática.');
      }
    } catch (e: any) {
      setStatusMessage(String(e?.message || 'Erro ao processar cartão.'));
    } finally {
      setIsPayingCard(false);
    }
  };

  if (!isOpen) return null;

  const amountBrl = Number(billingAmount || 0);
  const docOk = onlyDigits(payerDocument).length === 11 || onlyDigits(payerDocument).length === 14;
  const canShowBrick = amountBrl > 0 && mpPublicKey && isValidEmail(payerEmail) && docOk;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[12000] p-3 sm:p-4 overscroll-contain"
      onClick={onClose}
    >
      <div
        className={`bg-[#151618] border border-gray-700 rounded-xl w-full ${selectedMethod === 'credit_card' ? 'max-w-lg' : 'max-w-md'} text-white max-h-[88vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3 className="font-bold text-base sm:text-lg">Regularizar pagamento do sistema</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          <div className="rounded-lg border border-gray-700 bg-[#1c1d20] p-3">
            <p className="text-sm text-gray-300">
              Estabelecimento: <span className="text-white font-semibold">{establishmentName}</span>
            </p>
            <p className="text-sm text-gray-300 mt-1">
              Valor cobrança MP:{' '}
              <span className="text-emerald-300 font-bold">
                {billingAmount > 0 ? formatBRL(billingAmount) : isLoadingAmount ? '…' : 'Definido no Admin'}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Pagamento da <span className="text-gray-200 font-semibold">mensalidade do Agendei Fácil</span> pelo seu
              estabelecimento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('pix')}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedMethod === 'pix'
                ? 'border-emerald-400 bg-emerald-500/20'
                : 'border-gray-700 bg-[#1c1d20] hover:border-gray-500'
                }`}
            >
              <p className="font-semibold">PIX</p>
              <p className="text-xs text-gray-300 mt-1">Pague quando gerar o código</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('credit_card')}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedMethod === 'credit_card'
                ? 'border-blue-400 bg-blue-500/20'
                : 'border-gray-700 bg-[#1c1d20] hover:border-gray-500'
                }`}
            >
              <p className="font-semibold">Cartão de crédito</p>
              <p className="text-xs text-gray-300 mt-1">Pague aqui no sistema</p>
            </button>
          </div>

          {selectedMethod === 'pix' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGeneratePix}
                disabled={isGenerating || isLoadingAmount}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {isGenerating ? 'Gerando PIX...' : 'Gerar PIX'}
              </button>

              {pixQrBase64 ? (
                <div className="flex justify-center">
                  <img src={pixQrBase64} alt="QR Code PIX" className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg bg-white p-2" />
                </div>
              ) : null}

              {pixCode ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-300 text-center">PIX copia e cola</p>
                  <textarea
                    value={pixCode}
                    readOnly
                    rows={4}
                    className="w-full rounded-lg bg-[#0f1012] border border-gray-700 text-xs text-gray-100 p-3 resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="w-full border border-gray-600 hover:border-gray-400 rounded-lg py-2 font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar codigo PIX
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {selectedMethod === 'credit_card' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
                <div className="inline-flex items-start gap-2">
                  <CreditCard className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    O cartão é processado com segurança pelo <strong>Mercado Pago</strong>, sem sair desta tela. Você
                    paga a <strong>mensalidade atual</strong> do seu plano (mesmo valor exibido acima, quando
                    configurado).
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-[#1c1d20] p-2 space-y-2 text-xs text-gray-200">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(String(e.target.value || '').trim().toLowerCase())}
                    placeholder="email@exemplo.com"
                    className="w-full rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">CPF ou CNPJ do titular do cartão</label>
                  <input
                    value={payerDocument}
                    onChange={(e) => setPayerDocument(onlyDigits(e.target.value).slice(0, 14))}
                    className="w-full rounded border border-gray-600 bg-[#0f1012] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                    inputMode="numeric"
                    placeholder="Somente números"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-gray-700 bg-[#111213] p-3">
                <p className="text-xs font-semibold text-gray-300">Endereço de cobrança</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={billingCep}
                    onChange={(e) => setBillingCep(onlyDigits(e.target.value).slice(0, 8))}
                    className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-xs"
                    placeholder="CEP"
                    inputMode="numeric"
                  />
                  <input
                    value={billingUf}
                    onChange={(e) => setBillingUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                    className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-xs"
                    placeholder="UF"
                  />
                </div>
                <input
                  value={billingRua}
                  onChange={(e) => setBillingRua(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-xs"
                  placeholder="Rua"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={billingNumero}
                    onChange={(e) => setBillingNumero(e.target.value)}
                    className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-xs"
                    placeholder="Número"
                  />
                  <input
                    value={billingBairro}
                    onChange={(e) => setBillingBairro(e.target.value)}
                    className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-xs"
                    placeholder="Bairro"
                  />
                </div>
                <input
                  value={billingCidade}
                  onChange={(e) => setBillingCidade(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-xs"
                  placeholder="Cidade"
                />
              </div>

              {!canShowBrick ? (
                <p className="text-xs text-amber-200/90 rounded border border-amber-500/30 bg-amber-500/10 p-2">
                  {!mpPublicKey
                    ? 'Configure VITE_MERCADOPAGO_PUBLIC_KEY no ambiente para pagar no cartão aqui.'
                    : !amountBrl
                      ? 'Carregando valor… Se continuar vazio, confira o valor no Admin ou gere um PIX uma vez para sincronizar.'
                      : !isValidEmail(payerEmail) || !docOk
                        ? 'Preencha e-mail válido e CPF/CNPJ do titular para liberar o cartão.'
                        : ''}
                </p>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-[#111213] p-2">
                  <CardPaymentBrick
                    publicKey={mpPublicKey}
                    amount={amountBrl}
                    payerData={{
                      email: payerEmail,
                      identificationType: onlyDigits(payerDocument).length === 14 ? 'CNPJ' : 'CPF',
                      identificationNumber: onlyDigits(payerDocument),
                      firstName: 'Cliente',
                      lastName: 'AgendeiFacil',
                    }}
                    onSubmit={handleCardBrickSubmit}
                    onError={(err: any) => {
                      const msg = String(err?.message || '').trim();
                      if (msg.toLowerCase().includes('secure fields')) {
                        setConfigError('Cartão indisponível no momento. Tente PIX ou desative bloqueador de anúncios.');
                      } else if (msg) setConfigError(msg);
                    }}
                  />
                </div>
              )}

              {isPayingCard ? (
                <div className="flex items-center justify-center gap-2 text-blue-200 text-sm py-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processando…
                </div>
              ) : null}
            </div>
          )}

          {(configError || statusMessage) && (
            <div
              className={`rounded-lg border p-3 text-sm ${configError
                ? 'border-red-500/40 bg-red-500/10 text-red-100'
                : statusMessage.toLowerCase().includes('confirmado')
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : 'border-gray-600 bg-[#1c1d20] text-gray-200'
                }`}
            >
              {configError || statusMessage}
            </div>
          )}

          {paymentId && (
            <p className="text-xs text-gray-400 text-center">
              Pagamento em verificação automática {isRefreshingStatus ? '(atualizando...)' : ''}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
