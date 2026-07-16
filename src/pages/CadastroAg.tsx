import { ArrowLeft, Building, CheckCircle, Copy, CreditCard, Eye, EyeOff, Globe, Lock, Mail, Phone, QrCode, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { CardPaymentBrick } from '../components/CardPaymentBrick';
import {
  buildCadastroAgLink,
  computePartnerReferralFirstPaymentAmount,
  normalizePartnerReferralCodeInput,
  readPartnerReferralCupomFromSearch,
} from '../lib/partnerReferralCode';
import { resolvePartnerReferralDiamanteDiscountPercent } from '../lib/partnerReferralTestCoupon';

interface RegistrationData {
  clientName: string;
  establishmentName: string;
  email: string;
  password: string;
  whatsapp: string;
  documentNumber: string;
}

type SitePlan = 'prata' | 'diamante';
type PaymentMethod = 'pix' | 'recurring_card';

const CADASTRO_AG_DRAFT_KEY = 'cadastroag_payment_draft_v2';
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

const DEFAULT_REGISTRATION_DATA: RegistrationData = {
  clientName: '',
  establishmentName: '',
  email: '',
  password: '',
  whatsapp: '',
  documentNumber: ''
};

const PLAN_CONFIG: Record<SitePlan, { label: string; amount: number; description: string }> = {
  prata: {
    label: 'Prata',
    amount: 37.9,
    description: 'Sem WhatsApp de envios, sem assinantes e sem estoque.'
  },
  diamante: {
    label: 'Diamante',
    amount: 67.9,
    description: 'Plano completo com WhatsApp, assinantes, estoque e recorrências.'
  }
};

// Estrutura de países e códigos de país/DDDs
interface Country {
  name: string;
  code: string;
  dialCode: string;
  areaCodes?: string[]; // DDDs/códigos de área principais
}

const countries: Country[] = [
  {
    name: 'Brasil',
    code: 'BR',
    dialCode: '55',
    areaCodes: [
      '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
      '21', '22', '24', // RJ
      '27', '28', // ES
      '31', '32', '33', '34', '35', '37', '38', // MG
      '41', '42', '43', '44', '45', '46', // PR
      '47', '48', '49', // SC
      '51', '53', '54', '55', // RS
      '61', // DF
      '62', '64', // GO
      '63', // TO
      '65', '66', // MT
      '67', // MS
      '68', // AC
      '69', // RO
      '71', '73', '74', '75', '77', // BA
      '79', // SE
      '81', '87', // PE
      '82', // AL
      '83', // PB
      '84', // RN
      '85', '88', // CE
      '86', '89', // PI
      '91', '93', '94', // PA
      '92', '97', // AM
      '95', // RR
      '96', // AP
      '98', '99' // MA
    ]
  },
  {
    name: 'Portugal',
    code: 'PT',
    dialCode: '351',
    areaCodes: [
      // Móvel
      '91', '92', '93', '96',
      // Fixo - Lisboa e Vale do Tejo
      '21', '22',
      // Fixo - Centro
      '23', '24', '25', '26', '27', '28', '29',
      // Fixo - Norte e Centro Norte
      '31', '32', '33', '34', '35', '36',
      // Fixo - Aveiro e Viseu
      '38', '39'
    ]
  },
  {
    name: 'Espanha',
    code: 'ES',
    dialCode: '34',
    areaCodes: ['91', '92', '93', '94', '95', '96', '97', '98', '99', '910', '911', '912', '913', '914', '915', '916', '917', '918', '919']
  },
  {
    name: 'Estados Unidos',
    code: 'US',
    dialCode: '1',
    areaCodes: ['201', '202', '203', '205', '206', '207', '208', '209', '210', '212', '213', '214', '215', '216', '217', '218', '219', '224', '225', '227', '228', '229', '231', '234', '239', '240', '248', '251', '252', '253', '254', '256', '260', '262', '267', '269', '270', '272', '274', '276', '281', '283', '301', '302', '303', '304', '305', '307', '308', '309', '310', '312', '313', '314', '315', '316', '317', '318', '319', '320', '321', '323', '325', '327', '330', '331', '334', '336', '337', '339', '346', '347', '351', '352', '360', '361', '364', '380', '385', '386', '401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '412', '413', '414', '415', '417', '419', '423', '424', '425', '430', '432', '434', '435', '440', '442', '443', '445', '447', '448', '458', '463', '464', '469', '470', '472', '475', '478', '479', '480', '484', '501', '502', '503', '504', '505', '507', '508', '509', '510', '512', '513', '515', '516', '517', '518', '520', '530', '531', '534', '539', '540', '541', '551', '559', '561', '562', '563', '564', '567', '570', '571', '572', '573', '574', '575', '580', '585', '586', '601', '602', '603', '605', '606', '607', '608', '609', '610', '612', '614', '615', '616', '617', '618', '619', '620', '623', '626', '628', '629', '630', '631', '636', '641', '646', '647', '649', '650', '651', '656', '657', '660', '661', '662', '667', '669', '678', '681', '682', '684', '689', '701', '702', '703', '704', '706', '707', '708', '712', '713', '714', '715', '716', '717', '718', '719', '720', '724', '725', '727', '731', '732', '734', '737', '740', '743', '747', '754', '757', '760', '762', '763', '764', '765', '769', '770', '772', '773', '774', '775', '779', '781', '785', '786', '787', '801', '802', '803', '804', '805', '806', '808', '810', '812', '813', '814', '815', '816', '817', '818', '828', '830', '831', '832', '843', '845', '847', '848', '850', '856', '857', '858', '859', '860', '862', '863', '864', '865', '870', '872', '878', '901', '903', '904', '906', '907', '908', '909', '910', '912', '913', '914', '915', '916', '917', '918', '919', '920', '925', '927', '928', '929', '930', '931', '934', '936', '937', '938', '940', '941', '947', '949', '951', '952', '954', '956', '957', '958', '959', '970', '971', '972', '973', '975', '978', '979', '980', '984', '985', '986', '989']
  },
  {
    name: 'Argentina',
    code: 'AR',
    dialCode: '54',
    areaCodes: ['11', '221', '223', '261', '264', '266', '280', '291', '297', '299', '341', '342', '343', '351', '356', '358', '362', '364', '370', '376', '380', '381', '383', '385', '387', '388', '389', '391', '392', '394', '397', '411']
  },
  {
    name: 'Chile',
    code: 'CL',
    dialCode: '56',
    areaCodes: ['2', '32', '33', '34', '35', '41', '42', '43', '45', '51', '52', '53', '55', '57', '58', '61', '63', '64', '65', '67', '71', '72', '73', '75']
  },
  {
    name: 'Angola',
    code: 'AO',
    dialCode: '244',
    areaCodes: ['222', '231', '232', '233', '234', '235', '241', '248', '249', '251']
  }
];

const readCadastroAgDraft = (selectedPlan: SitePlan): any | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CADASTRO_AG_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (String(parsed?.plan || '') !== selectedPlan) return null;
    if (Date.now() - Number(parsed?.savedAt || 0) > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(CADASTRO_AG_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const clearCadastroAgDraft = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CADASTRO_AG_DRAFT_KEY);
  } catch {
    // ignore
  }
};

type PartnerReferralValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

const formatBrl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const CadastroAg = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const planParam = new URLSearchParams(location.search).get('plan')?.toLowerCase();
  const cupomFromUrl = readPartnerReferralCupomFromSearch(location.search);
  const selectedPlan: SitePlan = planParam === 'prata' ? 'prata' : 'diamante';
  const selectedPlanConfig = PLAN_CONFIG[selectedPlan];
  const initialDraftRef = useRef<any | null>(null);
  if (initialDraftRef.current === null) {
    initialDraftRef.current = readCadastroAgDraft(selectedPlan);
  }
  const [formData, setFormData] = useState<RegistrationData>(() => {
    const draftForm = initialDraftRef.current?.formData || {};
    return {
      ...DEFAULT_REGISTRATION_DATA,
      clientName: String(draftForm.clientName || ''),
      establishmentName: String(draftForm.establishmentName || ''),
      email: String(draftForm.email || ''),
      password: String(draftForm.password || ''),
      whatsapp: String(draftForm.whatsapp || ''),
      documentNumber: String(draftForm.documentNumber || '')
    };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<RegistrationData>>({});
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(() => {
    const draftCountryCode = String(initialDraftRef.current?.selectedCountryCode || '');
    return countries.find((country) => country.code === draftCountryCode) || countries[0];
  }); // Brasil como padrão
  const [showPaymentOptions, setShowPaymentOptions] = useState(() => Boolean(initialDraftRef.current?.showPaymentOptions));
  const [checkoutData, setCheckoutData] = useState<any | null>(null);
  const [checkoutId, setCheckoutId] = useState(() => String(initialDraftRef.current?.checkoutId || ''));
  const [isCreatingCheckout, setIsCreatingCheckout] = useState<PaymentMethod | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState(() => String(initialDraftRef.current?.paymentStatusMessage || ''));
  const [showAccountCreatedModal, setShowAccountCreatedModal] = useState(false);
  const [showCardForm, setShowCardForm] = useState(() => Boolean(initialDraftRef.current?.showCardForm));
  const [cardPayerData, setCardPayerData] = useState<any | null>(() => initialDraftRef.current?.cardPayerData || null);
  const [partnerReferralInput, setPartnerReferralInput] = useState(() =>
    normalizePartnerReferralCodeInput(
      String(cupomFromUrl || initialDraftRef.current?.partnerReferralInput || '')
    )
  );
  const [partnerReferralValidation, setPartnerReferralValidation] = useState<PartnerReferralValidationState>('idle');
  const [partnerReferralMessage, setPartnerReferralMessage] = useState('');
  const [partnerReferralAppliedCode, setPartnerReferralAppliedCode] = useState<string | null>(() =>
    cupomFromUrl ? null : initialDraftRef.current?.partnerReferralAppliedCode || null
  );
  const paymentOptionsRef = useRef<HTMLDivElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollCheckoutIdRef = useRef<string>('');
  const mercadoPagoPublicKey = String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim();

  const MAX_CHECKOUT_POLL_ATTEMPTS = 36;

  const validatePartnerReferralUrl = import.meta.env.PROD
    ? '/.netlify/functions/validate-partner-referral-code'
    : '/api/mercadopago/validate-partner-referral-code';

  const partnerReferralDiscountPercent =
    partnerReferralAppliedCode != null
      ? resolvePartnerReferralDiamanteDiscountPercent(
          normalizePartnerReferralCodeInput(partnerReferralAppliedCode)
        )
      : null;

  const diamantePricingPreview =
    selectedPlan === 'diamante' && partnerReferralValidation === 'valid' && partnerReferralAppliedCode
      ? computePartnerReferralFirstPaymentAmount(
          selectedPlanConfig.amount * 100,
          partnerReferralDiscountPercent ?? 0
        )
      : null;
  const checkoutAmountToday =
    diamantePricingPreview != null
      ? diamantePricingPreview.finalAmountCents / 100
      : selectedPlanConfig.amount;
  const cardPaymentAmount = checkoutAmountToday;
  const createCheckoutUrl = import.meta.env.PROD
    ? '/.netlify/functions/site-registration-create-checkout'
    : '/api/mercadopago/site-registration-create-checkout';
  const checkoutStatusUrl = import.meta.env.PROD
    ? '/.netlify/functions/site-registration-checkout-status'
    : '/api/mercadopago/site-registration-checkout-status';

  const onlyDigits = (value: unknown) => String(value || '').replace(/\D/g, '');

  const splitFullName = (name: string) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || 'Cliente',
      lastName: parts.slice(1).join(' ') || 'Agendei Facil',
    };
  };

  const formatCpfCnpj = (value: string) => {
    const digits = onlyDigits(value).slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    }
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
  };

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CADASTRO_AG_DRAFT_KEY,
        JSON.stringify({
          plan: selectedPlan,
          formData,
          selectedCountryCode: selectedCountry?.code || 'BR',
          showPaymentOptions,
          showCardForm,
          cardPayerData,
          checkoutId,
          paymentStatusMessage,
          partnerReferralInput,
          partnerReferralAppliedCode,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Se o navegador bloquear storage, o fluxo segue normalmente sem rascunho.
    }
  }, [
    checkoutId,
    cardPayerData,
    formData,
    paymentStatusMessage,
    partnerReferralAppliedCode,
    partnerReferralInput,
    selectedCountry?.code,
    selectedPlan,
    showCardForm,
    showPaymentOptions,
  ]);

  useEffect(() => {
    if (selectedPlan !== 'diamante' || !cupomFromUrl) return;
    setPartnerReferralInput((current) => (current === cupomFromUrl ? current : cupomFromUrl));
  }, [cupomFromUrl, selectedPlan]);

  useEffect(() => {
    if (selectedPlan !== 'diamante') {
      setPartnerReferralValidation('idle');
      setPartnerReferralMessage('');
      setPartnerReferralAppliedCode(null);
      return;
    }

    const normalized = normalizePartnerReferralCodeInput(partnerReferralInput);
    if (!normalized || normalized.length < 3) {
      setPartnerReferralValidation('idle');
      setPartnerReferralMessage('');
      setPartnerReferralAppliedCode(null);
      return;
    }

    setPartnerReferralValidation('validating');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(validatePartnerReferralUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: 'diamante',
            code: normalized,
            email: formData.email.trim().toLowerCase(),
          }),
        });
        const data = await response.json();
        if (data?.valid) {
          setPartnerReferralValidation('valid');
          setPartnerReferralAppliedCode(String(data.code || normalized));
          setPartnerReferralMessage(
            String(data.message || `Cupom válido: indicado por ${data.partner_name || 'parceiro'}`)
          );
          return;
        }
        setPartnerReferralValidation('invalid');
        setPartnerReferralAppliedCode(null);
        setPartnerReferralMessage(String(data?.message || 'Cupom inválido ou não encontrado.'));
      } catch {
        setPartnerReferralValidation('invalid');
        setPartnerReferralAppliedCode(null);
        setPartnerReferralMessage('Não foi possível validar o cupom agora. Tente novamente.');
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [formData.email, partnerReferralInput, selectedPlan, validatePartnerReferralUrl]);

  useEffect(() => {
    const shouldWarnBeforeLeaving = showCardForm && !isCreatingCheckout && !showAccountCreatedModal;
    if (!shouldWarnBeforeLeaving) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreatingCheckout, showAccountCreatedModal, showCardForm]);

  useEffect(() => {
    if (checkoutId && showPaymentOptions && paymentStatusMessage) {
      pollCheckoutStatus(checkoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const returnedCheckoutId = params.get('site_checkout_id');
    const returnedFromPayment = params.get('site_payment') === 'return';

    if (returnedCheckoutId && returnedFromPayment) {
      setCheckoutId(returnedCheckoutId);
      setShowPaymentOptions(true);
      setPaymentStatusMessage('Pagamento recebido pelo Mercado Pago. Estamos confirmando sua conta automaticamente...');
      pollCheckoutStatus(returnedCheckoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const validateForm = (): boolean => {
    const newErrors: Partial<RegistrationData> = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Nome do cliente é obrigatório';
    }

    if (!formData.establishmentName.trim()) {
      newErrors.establishmentName = 'Nome do estabelecimento é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!formData.whatsapp.trim()) {
      newErrors.whatsapp = 'WhatsApp é obrigatório';
    } else {
      // Validar formato do WhatsApp baseado no país selecionado
      let cleanWhatsapp = formData.whatsapp.replace(/\D/g, '');

      // Remover código do país se estiver presente
      if (selectedCountry && cleanWhatsapp.startsWith(selectedCountry.dialCode)) {
        cleanWhatsapp = cleanWhatsapp.substring(selectedCountry.dialCode.length);
      }

      // Validação por país
      if (selectedCountry?.code === 'BR') {
        // Brasil: 10 ou 11 dígitos (DDD + número)
        if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) {
          newErrors.whatsapp = 'WhatsApp deve ter 10 ou 11 dígitos';
        }
      } else if (selectedCountry?.code === 'PT') {
        // Portugal: 9 dígitos
        if (cleanWhatsapp.length !== 9) {
          newErrors.whatsapp = 'WhatsApp deve ter 9 dígitos (formato português)';
        }
      } else {
        // Outros países: aceitar de 7 a 12 dígitos (formato flexível)
        if (cleanWhatsapp.length < 7 || cleanWhatsapp.length > 12) {
          newErrors.whatsapp = 'WhatsApp deve ter entre 7 e 12 dígitos';
        }
      }
    }

    const documentDigits = onlyDigits(formData.documentNumber);
    if (!documentDigits) {
      newErrors.documentNumber = 'CPF ou CNPJ é obrigatório para aprovar o cartão';
    } else if (documentDigits.length !== 11 && documentDigits.length !== 14) {
      newErrors.documentNumber = 'Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildRegistrationData = () => {
      // Limpar WhatsApp e garantir que tenha o código do país correto
      let cleanWhatsapp = formData.whatsapp.replace(/\D/g, '');

      // IMPORTANTE: Remover QUALQUER código de país que possa estar no início
      // para depois adicionar o código correto do país selecionado
      if (selectedCountry) {
        // Pegar todos os códigos de países cadastrados (ordenado por tamanho, maior primeiro)
        const allCountryCodes = countries.map(c => c.dialCode).sort((a, b) => b.length - a.length);

        // Verificar se começa com algum código de país e remover
        for (const code of allCountryCodes) {
          if (cleanWhatsapp.startsWith(code)) {
            // Verificar se é realmente um código de país (não parte do número)
            // Se depois do código há pelo menos 7 dígitos, é provável que seja código de país
            const rest = cleanWhatsapp.substring(code.length);
            if (rest.length >= 7) {
              cleanWhatsapp = rest;
              break;
            }
          }
        }

        // Agora SEMPRE adicionar o código do país CORRETO (o selecionado)
        // Remove qualquer código anterior e adiciona o correto
        cleanWhatsapp = selectedCountry.dialCode + cleanWhatsapp;
      }

      return {
        client_name: formData.clientName.trim(),
        establishment_name: formData.establishmentName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password, // SENHA EM TEXTO CLARO (sem hash)
        client_whatsapp: cleanWhatsapp,
        document_type: onlyDigits(formData.documentNumber).length === 14 ? 'CNPJ' : 'CPF',
        document_number: onlyDigits(formData.documentNumber),
        ip_address: '127.0.0.1', // Em produção, pegar IP real
        user_agent: navigator.userAgent
      };
  };

  const pollCheckoutStatus = (id: string) => {
    if (!id) return;

    if (pollCheckoutIdRef.current === id && pollTimerRef.current != null) {
      return;
    }

    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    pollCheckoutIdRef.current = id;

    const runPoll = async (attempt: number) => {
      try {
        const response = await fetch(`${checkoutStatusUrl}?checkout_id=${encodeURIComponent(id)}`);
        const data = await response.json();
        const status = String(data?.checkout?.status || '').toLowerCase();
        const hasCreatedAccount = Boolean(data?.checkout?.created_establishment_id);

        if (status === 'converted' || hasCreatedAccount) {
          pollCheckoutIdRef.current = '';
          pollTimerRef.current = null;
          setPaymentStatusMessage('');
          clearCadastroAgDraft();
          setShowAccountCreatedModal(true);
          return;
        }

        if (status === 'conversion_failed') {
          if (attempt < MAX_CHECKOUT_POLL_ATTEMPTS) {
            setPaymentStatusMessage('Pagamento aprovado! Finalizando a criação da sua conta...');
            pollTimerRef.current = window.setTimeout(() => runPoll(attempt + 1), 5000);
            return;
          }

          pollCheckoutIdRef.current = '';
          pollTimerRef.current = null;
          setPaymentStatusMessage(
            'Pagamento aprovado, mas houve erro ao criar a conta. Chame o suporte para liberar manualmente.'
          );
          return;
        }

        setPaymentStatusMessage('Aguardando confirmação do pagamento para criar sua conta...');
        if (attempt < MAX_CHECKOUT_POLL_ATTEMPTS) {
          pollTimerRef.current = window.setTimeout(() => runPoll(attempt + 1), 5000);
        }
      } catch (error) {
        console.error('Erro ao consultar pagamento:', error);
        if (attempt < MAX_CHECKOUT_POLL_ATTEMPTS) {
          setPaymentStatusMessage('Confirmando pagamento... aguarde um instante.');
          pollTimerRef.current = window.setTimeout(() => runPoll(attempt + 1), 5000);
          return;
        }
        pollCheckoutIdRef.current = '';
        pollTimerRef.current = null;
        setPaymentStatusMessage(
          'Não consegui consultar agora. Se o pagamento já foi aprovado, a conta será criada pelo webhook.'
        );
      }
    };

    runPoll(0);
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setShowPaymentOptions(true);
    setShowCardForm(false);
    setPaymentStatusMessage('');
    toast.success('Cadastro preenchido. Agora escolha como pagar para criar a conta.');
    setTimeout(() => {
      paymentOptionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCreateCheckout = async (
    method: PaymentMethod,
    cardData?: {
      token: string;
      payment_method_id: string;
      issuer_id: string;
      installments: number;
      bin?: string;
      lastFourDigits?: string;
    }
  ) => {
    if (!validateForm() || isCreatingCheckout) return;

    const normalizedPartnerCode = normalizePartnerReferralCodeInput(partnerReferralInput);
    if (selectedPlan === 'diamante' && normalizedPartnerCode.length >= 3) {
      if (partnerReferralValidation === 'validating') {
        toast.error('Aguarde a validação do cupom antes de pagar.');
        return;
      }
      if (partnerReferralValidation !== 'valid' || !partnerReferralAppliedCode) {
        toast.error(partnerReferralMessage || 'Cupom inválido ou não encontrado.');
        return;
      }
    }

    setIsCreatingCheckout(method);
    setIsSubmitting(true);
    setPaymentStatusMessage('');

    try {
      const response = await fetch(createCheckoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          method,
          registration: buildRegistrationData(),
          ...(selectedPlan === 'diamante' && partnerReferralAppliedCode
            ? { partner_referral_code: partnerReferralAppliedCode }
            : {}),
          ...(cardData
            ? {
                card_token_id: cardData.token,
                payment_method_id: cardData.payment_method_id,
                issuer_id: cardData.issuer_id,
                installments: cardData.installments,
                card_bin: cardData.bin,
                card_last_four_digits: cardData.lastFourDigits,
              }
            : {}),
          backUrl: `${window.location.origin}${buildCadastroAgLink({
            plan: selectedPlan,
            cupom: selectedPlan === 'diamante' ? partnerReferralAppliedCode : null,
          })}`,
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const details = [data?.error, data?.userMessage, data?.details, data?.hint].filter(Boolean).join(' | ');
        throw new Error(details || 'Erro ao criar pagamento.');
      }

      setCheckoutData(data);
      setCheckoutId(String(data.checkout_id || ''));

      if (method === 'recurring_card') {
        setPaymentStatusMessage('Cartão enviado com segurança. Estamos confirmando a assinatura mensal...');
        pollCheckoutStatus(String(data.checkout_id || ''));
        return;
      }

      setPaymentStatusMessage('PIX gerado. A conta só será criada depois que o pagamento for aprovado.');
      pollCheckoutStatus(String(data.checkout_id || ''));
    } catch (error: any) {
      console.error('Erro ao criar checkout:', error);
      toast.error(error?.message || 'Erro ao iniciar pagamento.');
    } finally {
      setIsSubmitting(false);
      setIsCreatingCheckout(null);
    }
  };

  const handleInputChange = (field: keyof RegistrationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Função para lidar com mudança de país
  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
      setFormData(prev => ({ ...prev, whatsapp: '' })); // Limpar campo WhatsApp ao mudar país
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {showAccountCreatedModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl border border-emerald-200">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
              🎉
            </div>
            <h2 className="text-2xl font-black text-gray-900">
              Parabéns! Agora você é Agendei Fácil
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-700">
              Sua conta foi criada com sucesso e seu pagamento foi aprovado. Seja muito bem-vindo! 🚀
            </p>
            <button
              type="button"
              onClick={() => {
                clearCadastroAgDraft();
                navigate('/login?registered=success', { replace: true });
              }}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-base font-extrabold text-white shadow-lg hover:from-emerald-600 hover:to-green-700 transition-colors"
            >
              Fazer login
            </button>
          </div>
        </div>
      )}

      {/* Header com botão voltar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl p-6 text-white">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Criar Conta</h2>
                <p className="text-blue-100 mt-1">Agendei Fácil</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Plano escolhido</p>
                    <p className="text-xl font-extrabold text-gray-900">{selectedPlanConfig.label}</p>
                    <p className="text-sm text-gray-700">{selectedPlanConfig.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">mensalidade</p>
                    <p className="text-2xl font-black text-blue-700">
                      R$ {selectedPlanConfig.amount.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              </div>

              {selectedPlan === 'diamante' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                  <label htmlFor="partner-referral-checkout-code" className="block text-sm font-semibold text-gray-800">
                    Tem cupom de indicação?
                  </label>
                  <input
                    id="partner-referral-checkout-code"
                    type="text"
                    value={partnerReferralInput}
                    onChange={(e) => setPartnerReferralInput(normalizePartnerReferralCodeInput(e.target.value))}
                    placeholder="Digite o cupom"
                    maxLength={20}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-base font-bold uppercase tracking-wider text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  />
                  {partnerReferralValidation === 'validating' && (
                    <p className="text-sm text-amber-800">Validando cupom...</p>
                  )}
                  {partnerReferralValidation === 'valid' && partnerReferralMessage && (
                    <p className="text-sm font-semibold text-emerald-700">{partnerReferralMessage}</p>
                  )}
                  {partnerReferralValidation === 'invalid' && partnerReferralMessage && (
                    <p className="text-sm font-semibold text-red-700">{partnerReferralMessage}</p>
                  )}
                  {diamantePricingPreview && (
                    <div className="rounded-lg border border-emerald-200 bg-white p-3 text-sm text-gray-800 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span>Valor original:</span>
                        <span>{formatBrl(selectedPlanConfig.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-emerald-700">
                        <span>Desconto:</span>
                        <span>{partnerReferralDiscountPercent}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-extrabold text-gray-900 pt-1 border-t border-gray-100">
                        <span>Total hoje:</span>
                        <span>{formatBrl(diamantePricingPreview.finalAmountCents / 100)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Nome do Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Cliente
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white ${errors.clientName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Seu nome completo"
                  />
                </div>
                {errors.clientName && (
                  <p className="text-red-500 text-sm mt-1">{errors.clientName}</p>
                )}
              </div>

              {/* Nome do Estabelecimento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Estabelecimento
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.establishmentName}
                    onChange={(e) => handleInputChange('establishmentName', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white ${errors.establishmentName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Nome da sua barbearia/salão"
                  />
                </div>
                {errors.establishmentName && (
                  <p className="text-red-500 text-sm mt-1">{errors.establishmentName}</p>
                )}
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white ${errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="seu@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              {/* País e DDD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  País
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                  <select
                    value={selectedCountry?.code || ''}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white border-gray-300 appearance-none cursor-pointer"
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name} (+{country.dialCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>


              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => {
                      if (!selectedCountry) return;

                      // Formatar WhatsApp com código do país no formato (+351) 964 272 201
                      let inputValue = e.target.value;

                      // Remover tudo exceto números
                      let numbers = inputValue.replace(/\D/g, '');

                      // Se já começa com o código do país, remover para reformatar
                      if (numbers.startsWith(selectedCountry.dialCode)) {
                        numbers = numbers.substring(selectedCountry.dialCode.length);
                      }

                      // Formatar baseado no país
                      if (selectedCountry.code === 'BR') {
                        // Brasil: (11) 99999-9999
                        if (numbers.length <= 2) {
                          inputValue = numbers;
                        } else if (numbers.length <= 7) {
                          inputValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
                        } else if (numbers.length <= 10) {
                          inputValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
                        } else {
                          inputValue = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
                        }
                      } else {
                        // Outros países: (+351) 964 272 201 (formato internacional COM código do país)
                        if (numbers.length === 0) {
                          inputValue = '';
                        } else {
                          // Sempre mostrar o código do país + número formatado
                          let formattedNumber = '';
                          if (numbers.length <= 3) {
                            formattedNumber = numbers;
                          } else if (numbers.length <= 6) {
                            formattedNumber = `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
                          } else if (numbers.length <= 9) {
                            formattedNumber = `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6)}`;
                          } else {
                            formattedNumber = `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 9)}`;
                          }
                          inputValue = `(+${selectedCountry.dialCode}) ${formattedNumber}`;
                        }
                      }

                      handleInputChange('whatsapp', inputValue);
                    }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white ${errors.whatsapp ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder={selectedCountry?.code === 'BR' ? "(11) 99999-9999" : `(+${selectedCountry?.dialCode}) 964 272 201`}
                  />
                </div>
                {selectedCountry && (
                  <p className="text-xs text-gray-500 mt-1">
                    Formato completo: (+{selectedCountry.dialCode}) {selectedCountry.code === 'BR' ? '(11) 99999-9999' : '964 272 201'}
                  </p>
                )}
                {errors.whatsapp && (
                  <p className="text-red-500 text-sm mt-1">{errors.whatsapp}</p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white ${errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                )}
              </div>

              {/* CPF/CNPJ para pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CPF ou CNPJ do titular
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.documentNumber}
                    onChange={(e) => handleInputChange('documentNumber', formatCpfCnpj(e.target.value))}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white ${errors.documentNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="CPF ou CNPJ usado no cartão"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Usado pelo Mercado Pago para validar o pagamento e reduzir recusa do cartão.
                </p>
                {errors.documentNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.documentNumber}</p>
                )}
              </div>

              {/* Botão de envio */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Criar Conta
                    </>
                  )}
                </button>
              </div>

              {showPaymentOptions && (
                <div ref={paymentOptionsRef} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
                  <div className="text-center">
                    <h3 className="text-lg font-extrabold text-gray-900">Escolha como pagar</h3>
                    <div className="mx-auto mt-2 inline-flex items-baseline gap-2 rounded-xl bg-gray-900 px-4 py-2">
                      <span className="text-xs font-bold text-gray-300">{selectedPlanConfig.label}:</span>
                      {checkoutAmountToday < selectedPlanConfig.amount ? (
                        <>
                          <span className="text-xs text-gray-400 line-through">{formatBrl(selectedPlanConfig.amount)}</span>
                          <span className="text-xl font-black text-emerald-400">{formatBrl(checkoutAmountToday)}</span>
                          <span className="text-xs font-semibold text-gray-300">hoje</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl font-black text-emerald-400">{formatBrl(checkoutAmountToday)}</span>
                          <span className="text-xs font-semibold text-gray-300">/mês</span>
                        </>
                      )}
                    </div>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                      A conta só será criada automaticamente depois que o Mercado Pago confirmar o pagamento.
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Pagamento seguro via Mercado Pago
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleCreateCheckout('pix')}
                      disabled={!!isCreatingCheckout}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-white p-4 text-left transition hover:border-emerald-500 hover:shadow-md disabled:opacity-60"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                        <QrCode className="h-6 w-6 text-emerald-600" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-extrabold text-gray-900">PIX</span>
                        <span className="block text-xs text-gray-500">Aprovação rápida e automática</span>
                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Válido por 30 dias após aprovação
                        </span>
                      </span>
                      <span className="text-xl text-gray-300 transition group-hover:text-emerald-500">›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!validateForm()) {
                          toast.error('Preencha os dados obrigatórios antes do cartão.');
                          return;
                        }
                        setCheckoutData(null);
                        setCheckoutId('');
                        setPaymentStatusMessage('');
                        setCardPayerData({
                          email: formData.email.trim().toLowerCase(),
                          identificationType: onlyDigits(formData.documentNumber).length === 14 ? 'CNPJ' : 'CPF',
                          identificationNumber: onlyDigits(formData.documentNumber),
                          ...splitFullName(formData.clientName),
                        });
                        setShowCardForm(true);
                      }}
                      disabled={!!isCreatingCheckout}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-blue-200 bg-white p-4 text-left transition hover:border-blue-500 hover:shadow-md disabled:opacity-60"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-extrabold text-gray-900">Cartão de crédito</span>
                        <span className="block text-xs text-gray-500">Renova sozinho todo mês</span>
                        <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Assinatura mensal automática
                        </span>
                      </span>
                      <span className="text-xl text-gray-300 transition group-hover:text-blue-500">›</span>
                    </button>
                  </div>

                  {showCardForm && (
                    <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
                      <div className="mb-3 rounded-lg bg-blue-50 p-3">
                        <p className="text-sm font-extrabold text-blue-900">
                          Cartão de crédito no site
                        </p>
                        <p className="mt-1 text-xs text-blue-800">
                          Digite o cartão abaixo. O número do cartão fica nos campos seguros do Mercado Pago;
                          nosso sistema recebe apenas um token para criar a mensalidade recorrente.
                        </p>
                        <p className="mt-2 text-xs font-semibold text-blue-900">
                          Se precisar sair para conferir CVV ou validade, seus dados do cadastro ficam salvos nesta aba.
                          Por segurança, número do cartão, validade e CVV não são gravados.
                        </p>
                      </div>

                      {mercadoPagoPublicKey ? (
                        <CardPaymentBrick
                          publicKey={mercadoPagoPublicKey}
                          amount={cardPaymentAmount}
                          creditOnly
                          payerData={cardPayerData || {
                            email: formData.email.trim().toLowerCase(),
                            identificationType: onlyDigits(formData.documentNumber).length === 14 ? 'CNPJ' : 'CPF',
                            identificationNumber: onlyDigits(formData.documentNumber),
                            ...splitFullName(formData.clientName),
                          }}
                          onSubmit={(cardData) => handleCreateCheckout('recurring_card', cardData)}
                          onError={(error: any) => {
                            const msg = String(error?.message || '').trim();
                            toast.error(msg || 'Não foi possível abrir o cartão. Tente novamente.');
                          }}
                        />
                      ) : (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                          Configure <strong>VITE_MERCADOPAGO_PUBLIC_KEY</strong> para habilitar cartão no site.
                        </div>
                      )}
                    </div>
                  )}

                  {isCreatingCheckout && (
                    <p className="text-sm font-semibold text-blue-700">Gerando pagamento...</p>
                  )}

                  {checkoutData?.qr_code_base64 && (
                    <div className="overflow-hidden rounded-2xl border-2 border-emerald-300 bg-white shadow-md">
                      <div className="bg-emerald-600 px-4 py-3 text-center">
                        <p className="text-sm font-extrabold text-white">Falta pouco! Pague o PIX para liberar sua conta 🚀</p>
                      </div>
                      <div className="p-4 text-center">
                        <div className="mx-auto inline-block rounded-2xl bg-white p-3 shadow-md ring-1 ring-emerald-100">
                          <img
                            src={`data:image/png;base64,${checkoutData.qr_code_base64}`}
                            alt="QR Code PIX"
                            className="mx-auto h-48 w-48"
                          />
                        </div>
                        <p className="mt-3 text-3xl font-black text-gray-900">{formatBrl(checkoutAmountToday)}</p>
                        <p className="text-[11px] font-semibold text-gray-500">valor exato do PIX • {selectedPlanConfig.label}</p>
                        <div className="mx-auto mt-4 max-w-xs space-y-1.5 text-left">
                          <p className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">1</span>
                            Abra o app do seu banco
                          </p>
                          <p className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">2</span>
                            Escaneie o QR Code ou use o copia e cola
                          </p>
                          <p className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">3</span>
                            Sua conta é criada na hora, sozinha ✅
                          </p>
                        </div>
                        {checkoutData?.qr_code && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(String(checkoutData.qr_code || ''));
                              toast.success('Código PIX copiado!');
                            }}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700"
                          >
                            <Copy className="h-4 w-4" />
                            Copiar PIX copia e cola
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {(paymentStatusMessage || checkoutId) && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                      <p className="text-sm font-semibold text-amber-800">
                        {paymentStatusMessage || 'Aguardando confirmação do pagamento...'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Info */}
              <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />
                <p className="text-sm text-blue-800">
                  Cadastro automático: se o pagamento não for aprovado, a conta não é criada.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadastroAg;
