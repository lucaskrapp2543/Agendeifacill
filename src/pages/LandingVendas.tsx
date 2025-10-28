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
import { Link, useNavigate } from 'react-router-dom';
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

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  // Lógica para instalar o app
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const isAndroid = /Android/.test(navigator.userAgent);

                  let message = '';

                  if (isIOS) {
                    message = 'Para instalar o app:\n\n1. Toque no botão Compartilhar (□↑)\n2. Toque em "Adicionar à Tela Inicial"\n3. Toque em "Adicionar"';
                  } else if (isAndroid) {
                    message = 'Para instalar o app:\n\n1. Toque nos 3 pontos (⋮)\n2. Toque em "Adicionar à tela inicial"\n3. Toque em "Adicionar"';
                  } else {
                    message = 'Para instalar o app:\n\n1. Clique nos 3 pontos (⋮)\n2. Clique em "Instalar Agendei Fácil"\n3. Clique em "Instalar"';
                  }

                  alert(message);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Instalar App
              </button>
              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Login
              </button>
            </div>

            <button
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                Sistema mais completo para barbearias e salões de beleza
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Transforme seu negócio com
              <span className="text-blue-600 block">agendamentos online</span>
            </h1>

            {/* Imagem do sistema */}
            <div className="mb-8 px-4">
              <img
                src="/pclanding.png"
                alt="Sistema de Agendamentos AgendaFácil"
                className="w-full h-auto mx-auto"
                style={{ maxHeight: '500px' }}
              />
            </div>

            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto px-4">
              O sistema completo de agendamentos que vai aumentar sua receita,
              reduzir faltas e organizar sua agenda profissional.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 px-4">
              <Link
                to="/testefree"
                className="bg-green-600 hover:bg-green-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                TESTE GRÁTIS
              </Link>
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

                {/* Botão TESTE GRÁTIS centralizado */}
                <div className="text-center">
                  <Link
                    to="/testefree"
                    className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all transform hover:scale-105 shadow-lg"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    TESTE GRÁTIS AGORA
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Seção Página Exclusiva - Moderna e Organizada */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-12 mb-8 md:mb-12 border border-blue-200 shadow-xl">
            <div className="text-center mb-6 md:mb-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-4 leading-tight">
                Você ganha uma página{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-extrabold">
                  EXCLUSIVA
                </span>{' '}
                só sua!
              </h2>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-700 mb-6 md:mb-8 font-medium px-2">
                Nela o seu cliente encontra tudo em um só lugar:
              </p>
            </div>

            {/* Grid de Features - Mobile Otimizado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
              {/* Feature 1 - Fotos */}
              <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="flex items-center space-x-3 md:space-x-4 mb-2 md:mb-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Camera className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">SUAS FOTOS</h3>
                </div>
                <p className="text-gray-600 text-xs md:text-sm leading-relaxed">Galeria completa do seu estabelecimento</p>
              </div>

              {/* Feature 2 - Redes Sociais */}
              <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="flex items-center space-x-3 md:space-x-4 mb-2 md:mb-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">SUAS REDES SOCIAIS</h3>
                </div>
                <p className="text-gray-600 text-xs md:text-sm leading-relaxed">Links diretos para Instagram, Facebook e WhatsApp</p>
              </div>

              {/* Feature 3 - Google Reviews */}
              <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="flex items-center space-x-3 md:space-x-4 mb-2 md:mb-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Search className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">LINK AVALIAÇÃO GOOGLE</h3>
                </div>
                <p className="text-gray-600 text-xs md:text-sm leading-relaxed">Avaliações e comentários dos clientes</p>
              </div>

              {/* Feature 4 - Agendamento */}
              <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="flex items-center space-x-3 md:space-x-4 mb-2 md:mb-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">BOTÃO DE AGENDAMENTO</h3>
                </div>
                <p className="text-gray-600 text-xs md:text-sm leading-relaxed">Cliente agenda com você em poucos cliques!</p>
              </div>

              {/* Feature 5 - Wi-Fi */}
              <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center space-x-3 md:space-x-4 mb-2 md:mb-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wifi className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight">WI-FI</h3>
                </div>
                <p className="text-gray-600 text-xs md:text-sm leading-relaxed">Cliente clica e já copia a senha automaticamente</p>
              </div>
            </div>

            {/* Benefícios - Mobile Otimizado */}
            <div className="text-center space-y-3 md:space-y-4 mb-6 md:mb-8 px-2">
              <p className="text-lg md:text-xl text-gray-700 font-medium leading-relaxed">
                Todas as informações importantes sobre o seu espaço.
              </p>
              <p className="text-lg md:text-xl text-gray-700 font-medium leading-relaxed">
                Diga adeus 👋 aos vários QR Codes e links espalhados!
              </p>
              <p className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                Agora é apenas um link completo, moderno e profissional pra divulgar o seu negócio! 💙
              </p>
            </div>

            {/* Call to Action - Mobile Otimizado */}
            <div className="text-center">
              <div className="inline-flex items-center space-x-1 md:space-x-2 bg-white rounded-full px-4 md:px-6 py-2 md:py-3 shadow-lg border border-gray-200">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <span className="text-base md:text-lg font-bold text-gray-900 ml-1 md:ml-2 whitespace-nowrap">EXEMPLO ABAIXO</span>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }}></div>
              </div>
            </div>
          </div>

          {/* Imagem paginaextra - Mobile Otimizada */}
          <div className="flex justify-center mb-6 md:mb-8 px-2">
            <img
              src="/paginaextra.png"
              alt="Exemplo de página exclusiva"
              className="w-full max-w-md md:max-w-2xl lg:max-w-4xl h-auto rounded-lg md:rounded-xl shadow-2xl border border-gray-200"
            />
          </div>

          <div className="text-center mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 mb-4">
              Histórias reais de sucesso
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Se liga em alguns dos milhares de feedbacks de quem já tá com a gente 🚀
            </p>
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
          {/* Vídeo e Legenda */}
          <div className="text-center mb-8 md:mb-12 px-4">
            <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Veja como funciona nosso sistema
              </span>
            </h3>

            {/* Vídeo do YouTube */}
            <div className="relative w-full max-w-4xl mx-auto mb-6 md:mb-8">
              <div className="aspect-video w-full">
                <iframe
                  src="https://www.youtube.com/embed/YrNHIocqc5k"
                  title="Como funciona o sistema Agendei Fácil"
                  className="w-full h-full rounded-xl md:rounded-2xl shadow-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>

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
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-500 transition-all duration-300 shadow-lg">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Plano Mensal</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">R$ 47</span>
                  <span className="text-xl text-gray-600">,90/mês</span>
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
                <div className="space-y-3">
                  <Link
                    to="/testefree"
                    className="block w-full py-3 px-6 text-center text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
                  >
                    TESTE GRÁTIS
                  </Link>
                  <a
                    href="https://pay.kiwify.com.br/E2dUF4p"
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
                  <span className="text-sm text-gray-200 line-through">R$ 574,80</span>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">R$ 479</span>
                  <span className="text-xl text-gray-200">/ano</span>
                </div>
                <div className="mb-6 bg-blue-700 rounded-lg py-2 px-4">
                  <span className="text-gray-200">Economize R$ 95,80 por ano</span>
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
                  <Link
                    to="/testefree"
                    className="block w-full py-3 px-6 text-center text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
                  >
                    TESTE GRÁTIS
                  </Link>
                  <a
                    href="https://wa.me/5548991265320?text=Quero%20ser%20Anual"
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
            <Link
              to="/testefree"
              className="bg-green-600 hover:bg-green-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all transform hover:scale-105 inline-flex items-center justify-center shadow-lg"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              TESTE GRÁTIS
            </Link>
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

      {/* Botão TESTE GRÁTIS Flutuante */}
      <div className="fixed bottom-6 right-6 z-50">
        <Link
          to="/testefree"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center gap-2 font-bold text-sm animate-pulse"
        >
          <Sparkles className="w-5 h-5" />
          TESTE GRÁTIS
        </Link>
      </div>
    </div>
  );
};

export default LandingVendas;
