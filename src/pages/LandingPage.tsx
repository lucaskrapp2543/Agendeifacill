import {
  ArrowRight,
  Calendar,
  Car,
  CheckCircle,
  ChevronDown,
  Clock,
  Coffee,
  DollarSign,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Rocket,
  Scissors,
  Sparkles,
  Star,
  Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CacheBuster } from '../components/CacheBuster';
import { PromoNotifications } from '../components/PromoNotifications';
import PlanosCards from '../components/PlanosCards';
import WhatsAppButton from '../components/WhatsAppButton';

const pulseKeyframes = `
  @keyframes pulse-scale {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(107, 114, 128, 0.4);
    }

    70% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(107, 114, 128, 0);
    }

    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(107, 114, 128, 0);
    }
  }

  @keyframes pulse-scale-green {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    }

    70% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
    }

    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    }
  }
`;

const LandingPage = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [openDropdowns, setOpenDropdowns] = useState<{ [key: string]: boolean }>({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const toggleDropdown = (key: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Funções para deslize no carrossel
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentImageIndex < 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
    if (isRightSwipe && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  // Listener para capturar o prompt de instalação
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const features = [
    {
      icon: <Calendar className="w-6 h-6 text-white" />,
      title: "Agendamento Online 24/7",
      description: "Seus clientes podem agendar a qualquer hora, de qualquer lugar"
    },
    {
      icon: <Clock className="w-6 h-6 text-white" />,
      title: "Tempo Real",
      description: "Atualizações instantâneas de horários disponíveis e ocupados"
    },
    {
      icon: <Users className="w-6 h-6 text-white" />,
      title: "Múltiplos Profissionais",
      description: "Gerencie toda sua equipe em uma única plataforma (sem pagar nada a mais)"
    },
    {
      icon: <Scissors className="w-6 h-6 text-white" />,
      title: "Serviços Ilimitados",
      description: "Cadastre todos seus serviços com preços e durações"
    },
    {
      icon: <MessageCircle className="w-6 h-6 text-white" />,
      title: "Lembretes Automáticos",
      description: "Notificações por WhatsApp e SMS para seus clientes"
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-white" />,
      title: "Confirmação Automática",
      description: "Reduza faltas com confirmações automáticas"
    },
    {
      icon: <Star className="w-6 h-6 text-white" fill="currentColor" />,
      title: "Sistema Premium para Clientes Fiéis",
      description: "Recompense seus clientes mais frequentes automaticamente"
    },
    {
      icon: <DollarSign className="w-6 h-6 text-white" />,
      title: "Dashboard Profissional",
      description: "Administração completa de valores e vendas de cada profissional e produtos do seu estabelecimento"
    },
    {
      icon: <Users className="w-6 h-6 text-white" />,
      title: "COLABORADORES",
      description: "Você que tem outros colaboradores, consegue controlar e adicionar a % que cada um deles recebe por cada serviço, e também configurações completo dessa parte."
    },
    {
      icon: <Lock className="w-6 h-6 text-white" />,
      title: "SEGURANÇA",
      description: "Você pode criar senha para cada profissional, para que eles não tenham acesso ao dashboard de outros profissionais, somente você o dono e o seu funcionário"
    }
  ];

  const businessTypes = [
    { icon: Scissors, name: "Barbearias", color: "bg-blue-500" },
    { icon: Sparkles, name: "Salões de Beleza", color: "bg-pink-500" },
    { icon: Car, name: "Lava Car", color: "bg-[#2ddedb]" },
    { icon: Coffee, name: "Restaurantes", color: "bg-orange-500" },
    { icon: Calendar, name: "Outros", color: "bg-purple-500", description: "Tudo que precisa de agendamento e organização" }
  ];

  const testimonials = [
    {
      name: "João Silva",
      business: "Barbearia Silva",
      text: "O AgendeiFácil revolucionou meu negócio. Reduzi as faltas em 80% e aumentei minha clientela.",
      rating: 5
    },
    {
      name: "Maria Santos",
      business: "Lava-car Santos",
      text: "Sistema completo e fácil de usar. Meus clientes adoram a praticidade de agendar online.",
      rating: 5
    },
    {
      name: "Pedro Costa",
      business: "Salão Elite",
      text: "Excelente suporte e sempre atualizando com novidades. Recomendo para todos os profissionais.",
      rating: 5
    }
  ];

  const monthlyFeatures = [
    "Agendamentos ilimitados",
    "Gestão completa de clientes",
    "Relatórios detalhados financeiro completo",
    "Confirmação automática por SMS",
    "Lucros diários e mensais",
    "Profissionais ilimitados",
    "Controle de % para colaboradores",
    "Cálculo por base taxa da maquininha",
    "Serviços ilimitados",
    "Mensagem de lembrete para clientes",
    "Página de agendamentos exclusiva sua e personalizável",
    "Pagamentos adiantados se preferir"
  ];

  const scrollToPlans = () => {
    const plansSection = document.getElementById('planos');
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' });
    }
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
    const pricingSection = document.getElementById('planos');
    if (pricingSection) {
      pricingSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Função para gerar número aleatório entre 3 e 43
  const getRandomUsers = () => Math.floor(Math.random() * (43 - 3 + 1)) + 3;

  // Atualiza o número de usuários quando a página carrega
  useEffect(() => {
    setOnlineUsers(getRandomUsers());
  }, []);

  // Carrossel automático - troca de imagem a cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex === 0 ? 1 : 0));
    }, 10000);

    return () => clearInterval(interval);
  }, []);



  useEffect(() => {
    // Adiciona os keyframes ao head do documento
    const styleSheet = document.createElement("style");
    styleSheet.textContent = pulseKeyframes;
    document.head.appendChild(styleSheet);

    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  // Adicione o estado para controlar o popup no início do componente LandingPage
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // ✅ ESTADO PARA CONTROLAR O POPUP "VOCÊ JÁ É ASSINANTE?"
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <CacheBuster />
      <style>
        {`
          .header-sticky {
            position: sticky !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 99999 !important;
            transform: none !important;
            will-change: auto !important;
            background-color: rgba(0, 0, 0, 0.95) !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1) !important;
            backdrop-filter: blur(8px) !important;
          }
          
          /* Garantir que o body não tenha overflow que possa afetar */
          body {
            overflow-x: hidden !important;
          }
        `}
      </style>
      <WhatsAppButton />
      <PromoNotifications />
      {/* Header */}
      <div className="header-sticky backdrop-blur-md border-b border-gray-200/50">
        {/* Linha superior - Logo centralizado */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <div className="flex justify-center">
            <img
              src="/aggf.png"
              alt="AgendeiFácil Logo"
              className="h-12 sm:h-16 object-contain"
            />
          </div>
        </div>

        {/* Linha divisória */}
        <div className="w-full border-t border-gray-600 opacity-50"></div>

        {/* Linha inferior - Menu de navegação */}
        <nav className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-center gap-6 sm:gap-8">
            <button
              onClick={() => {
                // Lógica completa para instalar o app
                const handleInstall = async () => {
                  // Verificar se há prompt de instalação disponível
                  if (deferredPrompt) {
                    try {
                      await deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') {
                        console.log('App instalado com sucesso!');
                        setDeferredPrompt(null);
                        return;
                      }
                    } catch (error) {
                      console.log('Erro no prompt nativo:', error);
                    }
                  }

                  // Fallback: mostrar instruções manuais
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
                };

                handleInstall();
              }}
              className="text-white hover:text-blue-400 transition-colors duration-200 text-sm sm:text-base font-medium"
            >
              Instalar app
            </button>
            <button
              onClick={handleLogin}
              className="text-white hover:text-blue-400 transition-colors duration-200 text-sm sm:text-base font-medium"
            >
              Entrar
            </button>
          </div>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="pb-16 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8"> {/* Alterado px-4 para px-0 para mobile */}
          <div className="text-center"> {/* Removido max-w-4xl mx-auto */}
            <div className="flex flex-col items-center space-y-4 pt-0">
              {/* Carrossel de imagens A1 e A2 */}
              <div className="w-full max-w-2xl mx-auto relative">
                <div className="relative overflow-hidden rounded-lg">
                  {/* Imagens do carrossel */}
                  <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    <div className="w-full flex-shrink-0">
                      <img
                        src="/A2.png"
                        alt="Imagem A2"
                        className="w-full h-auto hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="w-full flex-shrink-0">
                      <img
                        src="/A1.png"
                        alt="Imagem A1"
                        className="w-full h-auto hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>

                  {/* Setas de navegação mais visíveis */}
                  <button
                    onClick={() => setCurrentImageIndex(0)}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-300 backdrop-blur-sm"
                    aria-label="Ir para imagem 1"
                  >
                    <ArrowRight className="h-5 w-5 rotate-180" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(1)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-300 backdrop-blur-sm"
                    aria-label="Ir para imagem 2"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>

                  {/* Indicadores de posição mais visíveis */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                    <button
                      onClick={() => setCurrentImageIndex(0)}
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${currentImageIndex === 0 ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/75'
                        }`}
                      aria-label="Ir para imagem 1"
                    />
                    <button
                      onClick={() => setCurrentImageIndex(1)}
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${currentImageIndex === 1 ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/75'
                        }`}
                      aria-label="Ir para imagem 2"
                    />
                  </div>
                </div>

                {/* Indicativo de tempo - só no desktop */}
                <div className="hidden md:block text-center mt-3">
                  <div className="inline-flex items-center gap-2 text-gray-400 text-sm bg-black/20 rounded-full px-3 py-1">
                    <Clock className="h-4 w-4" />
                    <span>Troca automática a cada 10 segundos • Clique nas setas para navegar</span>
                  </div>
                </div>
              </div>

              {/* Nova seção de destaque */}
              <div className="w-full max-w-3xl px-4">
                <div className="bg-white rounded-2xl p-2 md:p-4 animate-pulse-custom shadow-lg" style={{
                  animation: 'pulse-scale 2s infinite',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}>
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <Rocket className="h-3 w-3 md:h-6 md:w-6 text-blue-600 flex-shrink-0" />
                    <span className="text-xs md:text-xl text-gray-800 font-semibold text-center leading-tight">
                      Sistema de agendamentos mais completo do Brasil
                    </span>
                  </div>
                </div>
              </div>

              {/* Imagem testeR */}
              <div className="w-full max-w-2xl mx-auto mt-0 mb-0">
                <img
                  src="/testeR.png"
                  alt="Teste R"
                  className="w-full h-auto hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Vídeo do YouTube */}
              <div className="w-full max-w-4xl mx-auto mt-8 mb-8">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src="https://www.youtube.com/embed/tQMWQLLLDPo"
                    title="Vídeo do Agendei Fácil"
                    className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>

              {/* Imagem 10 mil abaixo da testeR */}
              <div className="w-full max-w-2xl mx-auto mt-4">
                <img
                  src="/10mil.png"
                  alt="10 mil"
                  className="w-full h-auto hover:scale-105 transition-transform duration-300"
                />
              </div>



              {/* Demo Booking Section */}
              <section className="py-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Experimente Como Funciona
                  </h2>
                  <p className="text-center text-gray-400 mb-6 max-w-2xl mx-auto">
                    Clique no botão abaixo para simular um agendamento e ver como é fácil e prático para seus clientes agendarem com você!
                  </p>
                  <div className="flex flex-col space-y-4 items-center">
                    {/* Demonstração Barbearia */}
                    <Link
                      to="/booking/3814"
                      className="group relative bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-semibold py-5 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 inline-block w-full sm:w-auto flex items-center justify-between gap-4 border border-gray-600 hover:border-[#2ddedb] overflow-hidden"
                      style={{
                        boxShadow: '0 0 20px rgba(45, 222, 219, 0.1)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 30px rgba(45, 222, 219, 0.3), inset 0 0 20px rgba(45, 222, 219, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(45, 222, 219, 0.1)';
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#2ddedb]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="relative p-3 rounded-xl bg-white transition-all duration-300"
                          style={{
                            boxShadow: '0 0 15px rgba(45, 222, 219, 0.2)',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 0 25px rgba(45, 222, 219, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(45, 222, 219, 0.2)';
                          }}>
                          <Scissors className="h-6 w-6" style={{ color: '#2ddedb' }} />
                        </div>
                        <span className="text-xl group-hover:text-[#2ddedb] transition-colors duration-300">Demonstração Barbearia</span>
                      </div>
                      <div className="bg-white p-3 rounded-full transition-all duration-300 relative z-10"
                        style={{ boxShadow: '0 0 10px rgba(45, 222, 219, 0.2)' }}>
                        <ArrowRight className="h-5 w-5" style={{ color: '#2ddedb' }} />
                      </div>
                    </Link>
                    {/* Demonstração Lava-car */}
                    <Link
                      to="/booking/3315"
                      className="group relative bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-semibold py-5 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 inline-block w-full sm:w-auto flex items-center justify-between gap-4 border border-gray-600 hover:border-[#2ddedb] overflow-hidden"
                      style={{
                        boxShadow: '0 0 20px rgba(45, 222, 219, 0.1)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 30px rgba(45, 222, 219, 0.3), inset 0 0 20px rgba(45, 222, 219, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(45, 222, 219, 0.1)';
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#2ddedb]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="relative p-3 rounded-xl bg-white transition-all duration-300"
                          style={{
                            boxShadow: '0 0 15px rgba(45, 222, 219, 0.2)',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 0 25px rgba(45, 222, 219, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(45, 222, 219, 0.2)';
                          }}>
                          <Car className="h-6 w-6" style={{ color: '#2ddedb' }} />
                        </div>
                        <span className="text-xl group-hover:text-[#2ddedb] transition-colors duration-300">Demonstração Lava-car</span>
                      </div>
                      <div className="bg-white p-3 rounded-full transition-all duration-300 relative z-10"
                        style={{ boxShadow: '0 0 10px rgba(45, 222, 219, 0.2)' }}>
                        <ArrowRight className="h-5 w-5" style={{ color: '#2ddedb' }} />
                      </div>
                    </Link>
                    {/* Demonstração Salão de beleza */}
                    <button
                      className="group relative bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-semibold py-5 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 inline-block w-full sm:w-auto flex items-center justify-between gap-4 border border-gray-600 hover:border-[#2ddedb] overflow-hidden"
                      style={{
                        boxShadow: '0 0 20px rgba(45, 222, 219, 0.1)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 30px rgba(45, 222, 219, 0.3), inset 0 0 20px rgba(45, 222, 219, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(45, 222, 219, 0.1)';
                      }}
                      disabled // Desabilitado por enquanto, pois não tem link
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#2ddedb]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="relative p-3 rounded-xl bg-white transition-all duration-300"
                          style={{
                            boxShadow: '0 0 15px rgba(45, 222, 219, 0.2)',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 0 25px rgba(45, 222, 219, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(45, 222, 219, 0.2)';
                          }}>
                          <Sparkles className="h-6 w-6" style={{ color: '#2ddedb' }} />
                        </div>
                        <span className="text-xl group-hover:text-[#2ddedb] transition-colors duration-300">Demonstração Salão de beleza</span>
                      </div>
                      <div className="bg-white p-3 rounded-full transition-all duration-300 relative z-10"
                        style={{ boxShadow: '0 0 10px rgba(45, 222, 219, 0.2)' }}>
                        <ArrowRight className="h-5 w-5" style={{ color: '#2ddedb' }} />
                      </div>
                    </button>

                    {/* Botão SER AGENDEI FÁCIL */}
                    <button
                      onClick={() => {
                        const precosSection = document.getElementById('precos');
                        if (precosSection) {
                          precosSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="text-gray-800 font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg inline-block w-full sm:w-auto flex items-center justify-center gap-2"
                      style={{
                        background: 'white',
                        transition: 'all 0.3s ease',
                        animation: 'pulse-scale 2s infinite',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      SER AGENDEI FÁCIL
                    </button>
                  </div>
                </div>
              </section>

              {/* Seção de Benefícios */}
              <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">


                  {/* Card único de funcionalidades */}
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
                      {/* Cabeçalho */}
                      <div className="text-center mb-8">
                        <h3 className="text-3xl font-bold text-gray-800 mb-3">O que oferecemos</h3>
                        <p className="text-gray-600">
                          Porque somos o melhor do mercado?
                        </p>
                      </div>

                      {/* Lista de funcionalidades */}
                      <div className="space-y-4">
                        {/* Página exclusiva */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('pagina-exclusiva')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Página exclusiva</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['pagina-exclusiva'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['pagina-exclusiva'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700 mb-3">Sim, você ganha uma página exclusiva sua! Nela mostra:</p>
                              <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside">
                                <li>Sua localização e contato</li>
                                <li>PIX e Wi-Fi (se tiver)</li>
                                <li>Horários de funcionamento</li>
                                <li>Fotos dos seus cortes</li>
                                <li>Avaliação do Google</li>
                                <li>Serviços para assinaturas</li>
                                <li>Botão de agendamento rápido</li>
                              </ul>
                              <p className="text-gray-600 text-sm mt-3">Tudo organizado para o cliente agendar com você de forma rápida e fácil.</p>
                            </div>
                          )}
                        </div>

                        {/* Não perca clientes */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('nao-perca-clientes')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Lembretes automáticos</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['nao-perca-clientes'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['nao-perca-clientes'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700">Nosso sistema manda mensagem automática de lembrete para seu cliente no WhatsApp 1h30 antes do compromisso.</p>
                            </div>
                          )}
                        </div>

                        {/* Controle de agendamentos */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('controle-agendamentos')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Controle de agendamentos</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['controle-agendamentos'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['controle-agendamentos'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700">Você pode cancelar, adicionar novos horários e até incluir produtos extras vendidos na hora e muito mais.</p>
                            </div>
                          )}
                        </div>

                        {/* Formas de pagamento */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('formas-pagamento')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Formas de pagamento</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['formas-pagamento'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['formas-pagamento'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700">Total controle de quais foram as formas de pagamentos feitas.</p>
                            </div>
                          )}
                        </div>

                        {/* Clube de Assinantes */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('clube-assinantes')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Clube de Assinantes</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['clube-assinantes'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['clube-assinantes'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700">Isso mesmo! Dentro do sistema ainda tem incluso sistema de clube de assinantes, e dentro você tem total controle também dos seus assinantes. Se um assinante seu for fazer agendamento, o sistema reconhece e o valor só desconta na aba "ASSINANTES", evitando confusão do caixa normal.</p>
                            </div>
                          )}
                        </div>

                        {/* Repescagem de clientes */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('repescagem-clientes')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Repescagem de clientes</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['repescagem-clientes'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['repescagem-clientes'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700">O sistema identifica clientes que não retornaram e ajuda você a recuperá-los.</p>
                            </div>
                          )}
                        </div>

                        {/* Colaboradores */}
                        <div className="border-b border-gray-100 pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('colaboradores')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Colaboradores</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['colaboradores'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['colaboradores'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700">Se você tem colaboradores que trabalham na sua barbearia, não se preocupe! Você consegue adicionar quantos profissionais quiser sem acréscimo de nada e ainda colocar a % que cada um deles recebe por corte. Cada colaborador seu terá uma página para ele ver os agendamentos dele, e você, dono do local, tem acesso a tudo.</p>
                            </div>
                          )}
                        </div>

                        {/* Controle financeiro total */}
                        <div className="pb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-3 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => toggleDropdown('controle-financeiro')}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm sm:text-lg font-medium text-gray-800 truncate">Controle financeiro total</span>
                                <span className="text-xs text-gray-500 leading-none">Clique para ver</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns['controle-financeiro'] ? 'rotate-180' : ''}`} />
                          </div>
                          {openDropdowns['controle-financeiro'] && (
                            <div className="mt-3 ml-9 p-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-700 mb-3">Dentro do seu AgendeiFácil você terá 3 indicadores de valor:</p>
                              <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside mb-3">
                                <li><strong>Valor bruto:</strong> quanto sua barbearia está faturando no mês</li>
                                <li><strong>Valor líquido:</strong> tirando as despesas que você adicionou</li>
                                <li><strong>Valor líquido estabelecimento:</strong> descontando despesas e a % de cada profissional</li>
                              </ul>
                              <p className="text-gray-600 text-sm">Assim você vê exatamente quanto cada profissional recebeu e quanto você, estabelecimento, recebeu com tudo descontado.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botão de ação */}
                      <div className="mt-8 text-center">
                        <button
                          onClick={() => {
                            const precosSection = document.getElementById('precos');
                            if (precosSection) {
                              precosSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-4 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
                        >
                          Começar agora
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>



              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                  <span className="block sm:inline">Tudo que você precisa</span><br className="hidden sm:block" />
                  <span className="block sm:inline">em um só lugar</span>
                </h2>
                <p className="text-lg md:text-xl bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-transparent bg-clip-text font-semibold">
                  Gerencie seu negócio com as<br />
                  melhores ferramentas
                </p>
              </div>

              {/* Features Section */}
              <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-3xl font-bold text-center mb-12">
                    Recursos Principais
                  </h2>

                  {/* Indicativo para arrastar - só no mobile */}
                  <div className="md:hidden text-center mb-4">
                    <div className="inline-flex items-center gap-2 text-blue-400 text-sm">
                      <ArrowRight className="h-4 w-4 animate-pulse" />
                      <span>Arraste para ver mais recursos</span>
                      <ArrowRight className="h-4 w-4 animate-pulse" />
                    </div>
                  </div>

                  {/* Features Grid - Desktop */}
                  <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                    {features.map((feature, index) => (
                      <div
                        key={index}
                        className="bg-white hover:bg-gray-100 text-blue-600 rounded-xl shadow-lg p-6 transition-all duration-300 transform hover:scale-105"
                      >
                        <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto">
                          {feature.icon}
                        </div>
                        <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                        <p className="text-blue-600">{feature.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Features Carousel - Mobile */}
                  <div className="md:hidden mt-8 w-full overflow-hidden" style={{ maxWidth: '100vw' }}>
                    <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide" style={{ overscrollBehavior: 'contain', touchAction: 'pan-x', maxWidth: '100%' }}>
                      {features.map((feature, index) => (
                        <div
                          key={index}
                          className="bg-white hover:bg-gray-100 text-blue-600 rounded-xl shadow-lg p-6 transition-all duration-300 transform hover:scale-105 text-center w-80 flex-shrink-0"
                        >
                          <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto">
                            {feature.icon}
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                          <p className="text-blue-600">{feature.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Seção de Depoimentos */}
              <div className="py-16 mb-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                    Histórias reais de quem transformou seu negócio com o AgendeiFácil
                  </h2>
                  <div className="grid md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, index) => (
                      <div key={index} className="bg-[#1a1b1c] p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-all duration-300">
                        <div className="flex items-center mb-4">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-5 w-5 text-yellow-400" fill="currentColor" />
                          ))}
                        </div>
                        <p className="text-gray-300 mb-4 italic">"{testimonial.text}"</p>
                        <div>
                          <p className="font-semibold text-white">{testimonial.name}</p>
                          <p className="text-gray-400 text-sm">{testimonial.business}</p>
                        </div>
                        <div className="flex justify-center mt-4">
                          <button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                            onClick={() => setShowFeedbackModal(true)}
                          >
                            Deixar meu feedback
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seção Tipos de Negócio */}
              <div className="mb-20">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
                  Perfeito para seu tipo de negócio
                </h2>
                <p className="text-xl text-center mb-12 bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent font-semibold">
                  Já ajudamos centenas de estabelecimentos a organizarem suas agendas
                </p>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                  {businessTypes.map((type, index) => (
                    <div key={index} className="bg-[#1a1b1c] p-6 rounded-2xl border border-[#2e2f30] hover:border-blue-500 transition-all duration-300 text-center">
                      <div className={`${type.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                        <type.icon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{type.name}</h3>
                      {type.description && (
                        <p className="text-gray-400 text-sm">{type.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção de Preços */}
              <div id="planos" className="w-full py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-4xl md:text-5xl font-bold text-center mb-2">
                    Investimento que
                  </h2>
                  <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
                    <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                      Se Paga Sozinho
                    </span>
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg max-w-2xl mx-auto px-4">
                    Planos transparentes com ROI comprovado. Sem taxas ocultas, sem surpresas desagradáveis.
                  </p>
                </div>
              </div>

              {/* Imagem Kiwify */}
              <div className="w-full mb-8 px-4">
                <img
                  src="/kiwify.png"
                  alt="Kiwify"
                  className="w-full h-auto object-contain mx-auto"
                />
              </div>

              {/* Imagem 7 Dias */}
              <div id="precos" className="w-full mb-8 px-4">
                <img
                  src="/7dias.png"
                  alt="7 Dias"
                  className="w-full h-auto object-contain mx-auto"
                />
              </div>

              <div className="mt-8">
                <PlanosCards whatsappNumber="5548991484275" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Comece agora mesmo
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Transforme seu negócio com o AgendeiFácil
            </p>
          </div>
        </div>
      </section>

      {/* Seção Como Funciona */}
      <section className="py-16 bg-black text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Experimente Como Funciona
          </h2>



        </div>
      </section>

      {/* Seção Final - Call to Action */}
      <div className="relative w-full bg-black py-16">
        <div className="absolute top-0 left-0 w-full">
          <img
            src="/ftfinal.png"
            alt="Transforme seu negócio"
            className="w-full object-cover object-bottom"
            style={{ marginTop: '-1px' }}
          />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 pt-[200px]">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Comece agora mesmo
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            Transforme seu negócio com o AgendeiFácil
          </p>

        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1a1b1c] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Contato</h3>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:contato@agendeifacil.com" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/agendeifacil.oficial/#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                    <img src="/insta.png" alt="Instagram" className="h-4 w-4" />
                    Instagram
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center mb-4">
                <Calendar className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold">AgendeFácil</span>
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                Sistema completo de agendamentos em tempo real para transformar a gestão do seu negócio.
              </p>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-blue-400 mr-3" />
                  <span className="text-gray-400">contato@agendeifacil.com.br</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-blue-400 mr-3" />
                  <span className="text-gray-400">Florianópolis, SC</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">Produto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Demonstração</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrações</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">Suporte</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/suporte060622" className="hover:text-white transition-colors">Central de Ajuda</Link></li>
                <li><Link to="/suporte060622" className="hover:text-white transition-colors">Tutoriais</Link></li>
                <li><Link to="/suporte060622" className="hover:text-white transition-colors">Contato</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} AgendeFácil. Todos os direitos reservados.
            </p>
            <div className="flex space-x-6 mt-4 sm:mt-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Política de Privacidade
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Termos de Uso
              </a>
            </div>
          </div>
        </div>
      </footer>
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#18191a] rounded-xl p-6 shadow-lg relative w-80 max-w-full text-center border border-blue-500/40">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl font-bold"
              onClick={() => setShowFeedbackModal(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <p className="text-white text-lg font-semibold mb-2">Você precisa estar logado para fazer seu feedback.</p>
          </div>
        </div>
      )}

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

            {/* Texto explicativo */}
            <p className="text-gray-400 text-sm mt-4">
              Escolha a opção que melhor se encaixa com seu perfil
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
