import {
  BarChart3,
  Calendar,
  Camera,
  CheckCircle,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Rocket,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Target,
  Users,
  Wifi,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WhatsAppButton from '../components/WhatsAppButton';

const LandingVendas = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ✅ ESTADO PARA CONTROLAR O POPUP "VOCÊ JÁ É ASSINANTE?"
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const images = ['/feedback.png', '/VS1.png', '/s1.png', '/s2.png'];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // ✅ FUNÇÃO PARA MOSTRAR POPUP EM VEZ DE NAVEGAR DIRETO
  const handleLogin = () => {
    setShowSubscriberModal(true);
  };

  // ✅ FUNÇÃO PARA IR PARA LOGIN (quando clica SIM)
  const handleGoToLogin = () => {
    setShowSubscriberModal(false);
    navigate('/login');
  };

  // ✅ FUNÇÃO PARA IR PARA SEÇÃO DE PREÇOS (quando clica NÃO)
  const handleGoToPricing = () => {
    setShowSubscriberModal(false);
    // Scroll para a seção de preços
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
      pricingSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const features = [
    {
      icon: <Calendar className="w-8 h-8 text-blue-600" />,
      title: "Agendamento Online 24/7",
      description: "Seus clientes agendam a qualquer hora, de qualquer lugar. Nunca mais perca uma venda por estar fechado!"
    },
    {
      icon: <Sparkles className="w-8 h-8 text-orange-600" />,
      title: "Página de Agendamentos",
      description: "Você ganha uma página EXCLUSIVA SUA de agendamentos, com fotos, suas redes sociais, seus links do Google (se tiver), Wi-Fi, comodidades e outras informações importantes."
    },
    {
      icon: <Users className="w-8 h-8 text-green-600" />,
      title: "Múltiplos Profissionais",
      description: "Gerencie toda sua equipe em uma única plataforma. Sem custos extras por profissional!"
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-purple-600" />,
      title: "Lembretes Automáticos",
      description: "Reduza faltas em 80% com lembretes automáticos, que lembra seu cliente uma hora antes de ir pro compromisso com você"
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
      title: "Dashboard Financeiro",
      description: "Controle total de vendas, comissões e faturamento de cada profissional"
    },
    {
      icon: <Target className="w-8 h-8 text-red-600" />,
      title: "Sistema de Metas",
      description: "Defina metas para seus profissionais e acompanhe o progresso em tempo real"
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-teal-600" />,
      title: "Controle de Estoque",
      description: "Tenha controle de todos seus produtos vendidos/pomadas, Bebidas, e etc, e o retorno sobre"
    },
    {
      icon: <Shield className="w-8 h-8 text-indigo-600" />,
      title: "100% Seguro",
      description: "Seus dados protegidos com criptografia de nível bancário"
    }
  ];


  const pricingFeatures = [
    "Agendamentos ilimitados",
    "Múltiplos profissionais",
    "Lembretes automáticos",
    "Dashboard financeiro completo",
    "Sistema de metas",
    "Relatórios detalhados",
    "Suporte 24/7",
    "Atualizações constantes"
  ];

  return (
    <div className="min-h-screen bg-white">
      <WhatsAppButton />
      {/* Header */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-lg' : 'bg-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img
                src="/logosite.png"
                alt="AgendeiFácil Logo"
                className="h-8 w-auto"
              />
            </div>

            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">Funcionalidades</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors">Preços</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors">Depoimentos</a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors">Contato</a>
            </nav>

            <button
              onClick={handleLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-0 sm:pt-10 pb-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Imagem do sistema - aparece logo abaixo do cabeçalho */}
            <div className="-mx-4 sm:mx-auto sm:max-w-4xl mb-6">
              <img
                src="/ppp.png"
                alt="Sistema de Agendamentos AgendaFácil"
                className="w-full h-auto object-cover sm:hidden"
                style={{ maxHeight: '500px', maxWidth: '100%' }}
              />
              <img
                src="/pclanding.png"
                alt="Sistema de Agendamentos AgendaFácil"
                className="hidden sm:block w-full h-auto mx-auto object-contain md:max-w-4xl"
                style={{ maxHeight: '500px', maxWidth: '100%' }}
              />
            </div>

            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                Sistema mais completo para barbearias e salões de beleza
              </div>
            </div>

            <div className="mx-auto mb-8 max-w-4xl px-4">
              <div className="overflow-hidden rounded-3xl border border-blue-100 shadow-lg sm:shadow-[0_30px_60px_rgba(59,130,246,0.15)]">
                <img
                  src="/praia.png"
                  alt="Curta a praia enquanto o Agendei Fácil trabalha por você"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Como Funciona */}
            <div className="mx-auto mb-10 max-w-5xl px-4">
              <div className="rounded-3xl border border-gray-100 bg-white/90 shadow-xl backdrop-blur-sm p-6 sm:p-10">
                <h2 className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-8 sm:mb-10 uppercase">
                  Como Funciona?
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-left">
                  <div className="space-y-3 rounded-2xl bg-white border border-gray-200 shadow-md p-6 sm:p-7">
                    <h3 className="text-lg sm:text-xl font-semibold text-blue-600 sm:text-gray-900 text-center sm:text-left uppercase sm:normal-case tracking-wide sm:tracking-normal">Link</h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      Primeiro você vai <strong>disponibilizar o link Agendei Fácil</strong> para o seu cliente (através do WhatsApp, Redes Sociais ou pelo seu site).
                    </p>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      <strong>O melhor de tudo:</strong> seu cliente não precisa baixar nenhum aplicativo. Tudo acontece online, rápido e fácil.
                    </p>
                  </div>
                  <div className="space-y-3 rounded-2xl bg-white border border-gray-200 shadow-md p-6 sm:p-7">
                    <h3 className="text-lg sm:text-xl font-semibold text-blue-600 sm:text-gray-900 text-center sm:text-left uppercase sm:normal-case tracking-wide sm:tracking-normal">Agendamento</h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      Depois, o seu cliente acessa o link, preenche <strong>nome e telefone</strong>, escolhe o <strong>serviço</strong>, a <strong>data</strong>, o <strong>horário</strong> e o <strong>profissional</strong> de preferência, além da forma de pagamento.
                    </p>
                  </div>
                  <div className="space-y-3 rounded-2xl bg-white border border-gray-200 shadow-md p-6 sm:p-7">
                    <h3 className="text-lg sm:text-xl font-semibold text-blue-600 sm:text-gray-900 text-center sm:text-left uppercase sm:normal-case tracking-wide sm:tracking-normal">Notificação</h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      Assim que o cliente agenda, você recebe uma notificação <strong>dentro do sistema</strong> e no <strong>seu WhatsApp</strong>. E pode relaxar: nós <strong>lembramos o cliente</strong> do compromisso no dia certo.
                    </p>
                  </div>
                  <div className="space-y-3 rounded-2xl bg-white border border-gray-200 shadow-md p-6 sm:p-7">
                    <h3 className="text-lg sm:text-xl font-semibold text-blue-600 sm:text-gray-900 text-center sm:text-left uppercase sm:normal-case tracking-wide sm:tracking-normal">Área do profissional</h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      Dentro do sistema, você tem <strong>controle total</strong> de tudo: financeiro (entradas e saídas), estoque de produtos,
                      agendamentos, assinaturas, profissionais e <strong>comissões (%)</strong>.
                    </p>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      Continue explorando o site — ainda tem <strong>muita funcionalidade poderosa</strong> pra descobrir por aqui.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 px-4">
              <a
                href="#pricing"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all transform hover:scale-105 flex items-center justify-center"
              >
                <Rocket className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Começar Agora
              </a>
              <a
                href="https://wa.me/5548991265320?text=Quero%20falar%20com%20especialista%20Agendei%20Fácil"
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all flex items-center justify-center"
              >
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Falar com Especialista
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-sm text-gray-500 px-4 mb-12">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                Sem taxa de setup
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                Cancele quando quiser
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                Suporte 24/7
              </div>
            </div>

            {/* Seção de Benefícios - Estilo Quiz V3 */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-4xl mx-auto">
              {/* Imagem do banner */}
              <div className="mb-6">
                <div className="flex justify-center items-center">
                  <img
                    src="/A1.png"
                    alt="Banner AgendeiFácil"
                    className="w-[90vw] max-w-[500px] object-contain rounded-xl"
                  />
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Somos o sistema de agendamento e gestão mais completo de todos
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Olha abaixo o que oferecemos
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  'Página exclusiva e editável sua',
                  'Seu cliente agenda em poucos cliques',
                  'Seus clientes não precisam criar conta para agendar',
                  'Você recebe notificação no sistema e no seu whatsapp de cada agendamento novo ou cancelado',
                  'Seu cliente não precisa baixar app',
                  'Seu cliente recebe lembrete 30min antes',
                  'Seus clientes não veem sua concorrência',
                  'Você tem controle total financeiro',
                  'Controle total de agendamentos',
                  'Sistema de estoque completo',
                  'Controle total % colaboradores, se tiver',
                  'Controle total de taxas de maquininha',
                  'Sistema de assinaturas incluso',
                  'Temos app agendei fácil, se quiser',
                  'Você recebe notificações quando alguém agenda ou cancela com você',
                  'Você tem sistema totalmente intuitivo e fácil de usar'
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <span className="text-sm text-green-800 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
                  <p className="text-base sm:text-lg font-bold text-center text-gray-900 leading-relaxed">
                    <span className="text-green-600">Gostou?</span> Isso é só{' '}
                    <span className="text-red-600 font-extrabold">40%</span> do que oferecemos{' '}
                    <span className="text-green-600 font-extrabold">tem muito mais</span>.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Seção Página Exclusiva - Nova composição */}
          <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-purple-50 shadow-[0_35px_90px_rgba(37,99,235,0.18)] mb-12">
            <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-blue-200/40 blur-3xl"></div>
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-purple-200/40 blur-3xl"></div>

            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center p-6 sm:p-10 lg:p-14">
              <div className="space-y-6 lg:space-y-8 text-center lg:text-left">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs sm:text-sm font-semibold text-blue-600 shadow-sm backdrop-blur">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  Página exclusiva do seu estabelecimento
                </span>

                <div className="space-y-4">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                    Você ganha uma página{' '}
                    <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                      EXCLUSIVA
                    </span>{' '}
                    só sua!
                  </h2>
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    Um link único com tudo que seus clientes precisam: agendamentos, fotos, avaliações,
                    redes sociais e benefícios — em um layout moderno pensado para conversão.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      title: 'Galeria completa',
                      description: 'Fotos profissionais do seu espaço para encantar clientes.',
                      icon: <Camera className="w-5 h-5 text-blue-500" />
                    },
                    {
                      title: 'Redes sociais conectadas',
                      description: 'Links diretos para Instagram, Facebook e WhatsApp.',
                      icon: <Smartphone className="w-5 h-5 text-green-500" />
                    },
                    {
                      title: 'Avaliações do Google',
                      description: 'Mostre depoimentos reais e ganhe credibilidade.',
                      icon: <Search className="w-5 h-5 text-yellow-500" />
                    },
                    {
                      title: 'Agendamento + Wi‑Fi',
                      description: 'Cliente agenda em segundos e ainda recebe a senha do Wi‑Fi.',
                      icon: <Calendar className="w-5 h-5 text-purple-500" />
                    }
                  ].map((feature) => (
                    <div
                      key={feature.title}
                      className="group flex items-start gap-4 rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-white to-blue-50 shadow-inner">
                        {feature.icon}
                      </div>
                      <div className="space-y-1 text-left">
                        <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{feature.title}</h3>
                        <p className="text-xs text-gray-600 sm:text-sm">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    Chega de vários QR Codes espalhados pelo salão. Seu cliente acessa tudo em um único link elegante
                    e memorável — seja no celular ou no computador.
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 shadow-lg border border-blue-100">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse delay-150" />
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse delay-300" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Veja um exemplo abaixo</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-blue-300/30 blur-2xl"></div>
                <div className="absolute -bottom-8 -right-10 h-32 w-32 rounded-full bg-purple-300/30 blur-2xl"></div>
                <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_20px_60px_rgba(79,70,229,0.22)] backdrop-blur">
                  <img
                    src="/paginaextra.png"
                    alt="Exemplo de página exclusiva"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Carrossel de imagens */}
          <div className="max-w-4xl mx-auto">
            <div className="relative mb-4">
              <div className="relative overflow-hidden rounded-lg">
                <img
                  src={images[currentImageIndex]}
                  alt={`Slide ${currentImageIndex + 1}`}
                  className="w-full h-auto rounded-lg transition-opacity duration-300"
                />

                {/* Botão anterior */}
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  ←
                </button>

                {/* Botão próximo */}
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  →
                </button>
              </div>

              {/* Indicadores de slide */}
              <div className="flex justify-center mt-3 space-x-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-blue-500' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Funcionalidades poderosas que vão revolucionar a gestão do seu negócio
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 sm:p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center text-white">
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">+1.000</div>
              <div className="text-sm sm:text-base text-blue-100">Estabelecimentos</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">+50.000</div>
              <div className="text-sm sm:text-base text-blue-100">Agendamentos/mês</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">95%</div>
              <div className="text-sm sm:text-base text-blue-100">Redução de faltas</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">40%</div>
              <div className="text-sm sm:text-base text-blue-100">Aumento na receita</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 px-4">
            <div className="max-w-2xl mx-auto mb-4">
              <img
                src="/pizza.png"
                alt="Pizza"
                className="w-full h-auto rounded-lg"
              />
            </div>

            {/* Texto de garantia */}
            <div className="mb-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 sm:p-6">
                <p className="text-lg sm:text-xl text-blue-800 font-bold text-center">
                  Confiamos tanto no nosso sistema que você tem 7 dias de garantia
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plano Mensal */}
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-500 transition-all duration-300 shadow-lg relative">
              <div className="absolute -top-3 left-4 bg-black text-white px-3 py-1 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase shadow-md">
                BLACK FRIDAY
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Plano Mensal</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">R$ 57</span>
                  <span className="text-xl text-gray-600">,90/mês</span>
                </div>
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <p className="text-yellow-900 text-sm sm:text-base font-semibold leading-snug">
                    Ao entrar por esse valor, ele fica fixo pra você, sem aumento.
                  </p>
                </div>
                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Agendamentos ilimitados</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Gestão completa de clientes</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Relatórios detalhados financeiro completo</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Confirmação automática por SMS</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Lucros diários e mensais</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Profissionais ilimitados</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Controle de % para colaboradores</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Cálculo por base taxa da maquininha</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Serviços ilimitados</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Sistema de prêmio para clientes fiéis</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Mensagem de lembrete para clientes</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Página de agendamentos exclusiva sua e personalizável</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Sistema de assinantes incluso</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Controle total de clientes novos e antigos e atuais</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Controle de clientes sumidos</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Ranking de clientes</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">Notificações em tempo real de agendamentos ou cancelamentos</span>
                  </li>
                </ul>
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-blue-900 text-sm sm:text-base font-semibold leading-snug text-center">
                  PARECE LOUCURA NÉ, mas é isso mesmo: R$ 57,90 para ter tudo isso. Clique agora em começar!
                </p>
              </div>
                <div className="space-y-3">
                  <a
                    href="https://pay.kiwify.com.br/6z5ZX4t"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-6 text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Começar Agora
                  </a>
                </div>
              </div>
            </div>

            {/* Plano Anual */}
            <div className="bg-blue-600 border-2 border-blue-500 rounded-2xl p-8 hover:border-blue-400 transition-all duration-300 relative shadow-lg">
              <div className="absolute -top-3 right-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-medium">
                4 meses grátis
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">Plano Anual</h3>
                <div className="mb-2">
                  <span className="text-sm text-gray-200 line-through">R$ 814,80</span>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">R$ 579</span>
                  <span className="text-xl text-gray-200">,90/ano</span>
                </div>
                <div className="mb-6 bg-blue-700 rounded-lg py-2 px-4">
                  <span className="text-gray-200">Economize R$ 134,90 por ano</span>
                </div>
                <div className="mb-6 bg-yellow-500 rounded-lg py-3 px-4">
                  <p className="text-black font-semibold text-sm">
                    🎉 Paga 10 meses e ganha 4 meses a mais!
                  </p>
                  <p className="text-black text-xs mt-1">
                    Você só vai renovar seu plano daqui a 1 ano e 4 meses 😉
                  </p>
                </div>
                <ul className="space-y-4 mb-8 text-left">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-white mr-3" />
                    <span className="text-white">Tudo do plano mensal</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-white mr-3" />
                    <span className="text-white">4 meses totalmente grátis</span>
                  </li>
                </ul>
                <div className="space-y-3">
                  <a
                    href="https://pay.kiwify.com.br/Z6ETL6v"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-6 text-center text-blue-600 bg-white hover:bg-gray-100 rounded-lg transition-colors font-semibold"
                  >
                    Começar Agora
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Pronto para transformar seu negócio?
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Sistema mais completo para barbearias e salões de beleza
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#pricing"
              className="bg-white text-blue-600 hover:bg-gray-100 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all transform hover:scale-105 inline-flex items-center justify-center"
            >
              <Rocket className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Começar Agora
            </a>
            <a
              href="https://wa.me/5548991265320?text=Quero%20falar%20com%20especialista%20Agendei%20Fácil"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all flex items-center justify-center"
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Falar com Especialista
            </a>
          </div>

          <div className="mt-8 text-blue-100 text-xs sm:text-sm">
            <p>✅ Sem compromisso • ✅ Suporte 24/7 • ✅ Ativação imediata</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center mb-4">
                <img
                  src="/logosite.png"
                  alt="AgendeiFácil Logo"
                  className="h-6 sm:h-8 w-auto mr-2"
                />
                <span className="text-xl sm:text-2xl font-bold">AgendeiFácil</span>
              </div>
              <p className="text-sm sm:text-base text-gray-400">
                O sistema de agendamentos que vai revolucionar seu negócio.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-sm sm:text-base">Produto</h3>
              <ul className="space-y-2 text-gray-400 text-sm sm:text-base">
                <li><a href="#features" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-sm sm:text-base">Suporte</h3>
              <ul className="space-y-2 text-gray-400 text-sm sm:text-base">
                <li><a href="#" className="hover:text-white transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-sm sm:text-base">Contato</h3>
              <ul className="space-y-2 text-gray-400 text-sm sm:text-base">
                <li className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  (48) 99126-5320
                </li>
                <li className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  contato@agendafacil.com
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 AgendeiFácil. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* ✅ POPUP "VOCÊ JÁ É ASSINANTE AGENDEI FÁCIL?" */}
      {showSubscriberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#18191a] rounded-xl p-8 shadow-lg relative w-96 max-w-full text-center border border-blue-500/40">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl font-bold"
              onClick={() => setShowSubscriberModal(false)}
              aria-label="Fechar"
            >
              ×
            </button>

            {/* Ícone */}
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🤔</span>
            </div>

            {/* Título */}
            <h3 className="text-white text-xl font-bold mb-2">
              Você já é assinante Agendei Fácil?
            </h3>

            {/* Botões */}
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleGoToLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                ✅ SIM - Já sou assinante
              </button>

              <button
                onClick={handleGoToPricing}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                ❌ NÃO - Quero conhecer os planos
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LandingVendas;
