import { ArrowLeft, Building, CheckCircle, Copy, CreditCard, Eye, EyeOff, Globe, Lock, Mail, Phone, QrCode, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';

interface RegistrationData {
  clientName: string;
  establishmentName: string;
  email: string;
  password: string;
  whatsapp: string;
}

type SitePlan = 'prata' | 'diamante';
type PaymentMethod = 'pix' | 'recurring_card';

const PLAN_CONFIG: Record<SitePlan, { label: string; amount: number; description: string }> = {
  prata: {
    label: 'Prata',
    amount: 37.9,
    description: 'Sem WhatsApp de envios, sem assinantes e sem estoque.'
  },
  diamante: {
    label: 'Diamante',
    amount: 57.9,
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

const CadastroAg = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const planParam = new URLSearchParams(location.search).get('plan')?.toLowerCase();
  const selectedPlan: SitePlan = planParam === 'prata' ? 'prata' : 'diamante';
  const selectedPlanConfig = PLAN_CONFIG[selectedPlan];
  const [formData, setFormData] = useState<RegistrationData>({
    clientName: '',
    establishmentName: '',
    email: '',
    password: '',
    whatsapp: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<RegistrationData>>({});
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(countries[0]); // Brasil como padrão
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any | null>(null);
  const [checkoutId, setCheckoutId] = useState('');
  const [isCreatingCheckout, setIsCreatingCheckout] = useState<PaymentMethod | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
  const [showAccountCreatedModal, setShowAccountCreatedModal] = useState(false);
  const paymentOptionsRef = useRef<HTMLDivElement | null>(null);

  const createCheckoutUrl = import.meta.env.PROD
    ? '/.netlify/functions/site-registration-create-checkout'
    : '/api/mercadopago/site-registration-create-checkout';
  const checkoutStatusUrl = import.meta.env.PROD
    ? '/.netlify/functions/site-registration-checkout-status'
    : '/api/mercadopago/site-registration-checkout-status';

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
        ip_address: '127.0.0.1', // Em produção, pegar IP real
        user_agent: navigator.userAgent
      };
  };

  const pollCheckoutStatus = async (id: string) => {
    if (!id) return;

    try {
      const response = await fetch(`${checkoutStatusUrl}?checkout_id=${encodeURIComponent(id)}`);
      const data = await response.json();
      const status = String(data?.checkout?.status || '').toLowerCase();

      if (status === 'converted') {
        setPaymentStatusMessage('');
        setShowAccountCreatedModal(true);
        return;
      }

      if (status === 'conversion_failed') {
        setPaymentStatusMessage('Pagamento aprovado, mas houve erro ao criar a conta. Chame o suporte para liberar manualmente.');
        return;
      }

      setPaymentStatusMessage('Aguardando confirmação do pagamento para criar sua conta...');
      setTimeout(() => pollCheckoutStatus(id), 5000);
    } catch (error) {
      console.error('Erro ao consultar pagamento:', error);
      setPaymentStatusMessage('Não consegui consultar agora. Se o pagamento já foi aprovado, a conta será criada pelo webhook.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setShowPaymentOptions(true);
    setPaymentStatusMessage('');
    toast.success('Cadastro preenchido. Agora escolha como pagar para criar a conta.');
    setTimeout(() => {
      paymentOptionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCreateCheckout = async (method: PaymentMethod) => {
    if (!validateForm() || isCreatingCheckout) return;

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
          backUrl: `${window.location.origin}/cadastroag?plan=${selectedPlan}`
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
        toast.success('Redirecionando para a assinatura no Mercado Pago...');
        window.location.href = String(data.init_point || data.checkout_url || '');
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
              onClick={() => navigate('/login?registered=success', { replace: true })}
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
                <div ref={paymentOptionsRef} className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Escolha como pagar</h3>
                    <p className="text-sm text-gray-600">
                      A conta só será criada automaticamente depois que o Mercado Pago confirmar o pagamento.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleCreateCheckout('pix')}
                      disabled={!!isCreatingCheckout}
                      className="rounded-xl border border-emerald-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      <QrCode className="mb-2 h-6 w-6 text-emerald-600" />
                      <div className="font-extrabold text-gray-900">PIX</div>
                      <div className="text-xs text-gray-600">Válido por 30 dias após aprovação.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCreateCheckout('recurring_card')}
                      disabled={!!isCreatingCheckout}
                      className="rounded-xl border border-blue-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
                    >
                      <CreditCard className="mb-2 h-6 w-6 text-blue-600" />
                      <div className="font-extrabold text-gray-900">Cartão de crédito</div>
                      <div className="text-xs text-gray-600">Assinatura mensal automática.</div>
                    </button>
                  </div>

                  {isCreatingCheckout && (
                    <p className="text-sm font-semibold text-blue-700">Gerando pagamento...</p>
                  )}

                  {checkoutData?.qr_code_base64 && (
                    <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center">
                      <p className="mb-3 text-sm font-bold text-gray-900">PIX gerado</p>
                      <img
                        src={`data:image/png;base64,${checkoutData.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="mx-auto h-48 w-48 rounded-lg border border-gray-200"
                      />
                      {checkoutData?.qr_code && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(String(checkoutData.qr_code || ''));
                            toast.success('Código PIX copiado!');
                          }}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar PIX copia e cola
                        </button>
                      )}
                    </div>
                  )}

                  {(paymentStatusMessage || checkoutId) && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                      {paymentStatusMessage || 'Aguardando confirmação do pagamento...'}
                    </div>
                  )}
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
