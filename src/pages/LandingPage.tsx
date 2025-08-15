import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Calendar,
  Clock,
  Users,
  Smartphone,
  BarChart3,
  CheckCircle,
  Star,
  Menu,
  X,
  Scissors,
  Car,
  Sparkles,
  Coffee,
  ArrowRight,
  ArrowDown,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Rocket,
  Eye,
  DollarSign,
  Lock,
  ThumbsUp,
  Pencil,
  Crown,
  Globe
} from 'lucide-react';
import { PromoBanner } from '../components/PromoBanner';
import WhatsAppButton from '../components/WhatsAppButton';
import DemoBooking from '../components/DemoBooking';
import { PromoNotifications } from '../components/PromoNotifications';
import FinanceCarousel from '../components/FinanceCarousel';

const pulseKeyframes = `
  @keyframes pulse-scale {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7);
    }

    70% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(6, 182, 212, 0);
    }

    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(6, 182, 212, 0);
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

  const toggleDropdown = (key: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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
    { icon: Car, name: "Lava Car", color: "bg-green-500" },
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

  const handleLogin = () => {
    navigate('/login');
  };

  // Função para gerar número aleatório entre 3 e 43
  const getRandomUsers = () => Math.floor(Math.random() * (43 - 3 + 1)) + 3;

  // Atualiza o número de usuários quando a página carrega
  useEffect(() => {
    setOnlineUsers(getRandomUsers());
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

  return (
    <div className="min-h-screen bg-black text-white">
      <WhatsAppButton />
      <PromoNotifications />
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/95 backdrop-blur-sm border-b border-gray-800 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-blue-500" />
              <div className="flex items-center ml-6">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-gray-300" />
                  <span className="text-sm font-medium text-gray-300">Pessoas no site:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium text-gray-300">{onlineUsers}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Entrar
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-12 pb-16 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8"> {/* Alterado px-4 para px-0 para mobile */}
          <div className="text-center"> {/* Removido max-w-4xl mx-auto */}
            <div className="flex flex-col items-center space-y-4 pt-8">
              <img
                src="/testeR.png"
                alt="AgendeiFácil Logo"
                className="mx-auto w-full"
              />

              {/* Nova seção de destaque */}
              <div className="w-full max-w-3xl px-4">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-800 rounded-2xl p-2 md:p-4 animate-pulse-custom" style={{ animation: 'pulse-scale 2s infinite' }}>
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <Rocket className="h-3 w-3 md:h-6 md:w-6 text-white flex-shrink-0" />
                    <span className="text-xs md:text-xl text-white font-semibold text-center leading-tight">
                      Sistema de agendamentos mais completo do Brasil
                    </span>
                  </div>
                </div>
              </div>

              {/* Imagem 10 mil */}
              <div className="w-full max-w-2xl mx-auto mt-0 mb-0">
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
                    <Link
                      to="/booking/3814" // Link para a página de demonstração Barbearia
                      className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg inline-block w-full sm:w-auto flex items-center justify-between gap-4 relative"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-400 p-2 rounded-lg">
                          <Scissors className="h-5 w-5 text-white" />
                        </div>
                        <span>Demonstração Barbearia</span>
                      </div>
                      <div className="bg-gray-700 p-2 rounded-full">
                        <ArrowDown className="h-4 w-4 text-green-400" />
                      </div>
                    </Link>
                    <Link
                      to="/booking/3315" // Link para a página de demonstração Lava-car
                      className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg inline-block w-full sm:w-auto flex items-center justify-between gap-4 relative"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-400 p-2 rounded-lg">
                          <Car className="h-5 w-5 text-white" />
                        </div>
                        <span>Demonstração Lava-car</span>
                      </div>
                      <div className="bg-gray-700 p-2 rounded-full">
                        <ArrowDown className="h-4 w-4 text-green-400" />
                      </div>
                    </Link>
                    <button
                      className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg inline-block w-full sm:w-auto flex items-center justify-between gap-4 relative"
                      disabled // Desabilitado por enquanto, pois não tem link
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-400 p-2 rounded-lg">
                          <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <span>Demonstração Salão de beleza</span>
                      </div>
                      <div className="bg-gray-700 p-2 rounded-full">
                        <ArrowDown className="h-4 w-4 text-green-400" />
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
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg inline-block w-full sm:w-auto flex items-center justify-center gap-2"
                      style={{ animation: 'pulse-scale-green 2s infinite' }}
                    >
                      SER AGENDEI FÁCIL
                    </button>
                  </div>
                </div>
              </section>

              {/* Seção de Benefícios */}
              <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <p className="text-center text-blue-500 font-semibold mb-4">BENEFÍCIOS</p>
                  <div className="text-center mb-8">
                    <h2 className="text-base md:text-xl font-bold leading-snug">
                      Mais <span className="text-blue-500 font-semibold">organização</span>,<br/>
                      menos <span className="text-blue-500 font-semibold">preocupações</span>
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Página exclusiva - ESTILO 1: Glassmorphism */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('pagina-exclusiva')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <Globe className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Página exclusiva</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['pagina-exclusiva'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['pagina-exclusiva'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100 mb-3">Sim, você ganha uma página exclusiva sua! Nela mostra:</p>
                          <ul className="text-blue-100 text-sm space-y-1 mb-3">
                            <li>• Sua localização e contato</li>
                            <li>• PIX e Wi-Fi (se tiver)</li>
                            <li>• Horários de funcionamento</li>
                            <li>• Fotos dos seus cortes</li>
                            <li>• Avaliação do Google</li>
                            <li>• Serviços para assinaturas</li>
                            <li>• Botão de agendamento rápido</li>
                          </ul>
                          <p className="text-blue-100 text-sm">Tudo organizado para o cliente agendar com você de forma rápida e fácil.</p>
                        </div>
                      )}
                    </div>

                    {/* Não perca clientes */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('nao-perca-clientes')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <MessageCircle className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Não perca clientes</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['nao-perca-clientes'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['nao-perca-clientes'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100">Nosso sistema manda mensagem automática de lembrete para seu cliente no WhatsApp 1h30 antes do compromisso.</p>
                        </div>
                      )}
                    </div>

                    {/* Controle total de agendamentos */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('controle-agendamentos')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <Calendar className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Controle total de agendamentos</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['controle-agendamentos'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['controle-agendamentos'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100">Você pode cancelar, adicionar novos horários e até incluir produtos extras vendidos na hora e muito mais.</p>
                        </div>
                      )}
                    </div>

                    {/* Registre as formas de pagamento */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('formas-pagamento')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <DollarSign className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Registre as formas de pagamento</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['formas-pagamento'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['formas-pagamento'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100">Total controle de quais foram as formas de pagamentos feitas.</p>
                        </div>
                      )}
                    </div>

                    {/* Clube de Assinantes */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('clube-assinantes')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <Crown className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Clube de Assinantes</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['clube-assinantes'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['clube-assinantes'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100">Isso mesmo! Dentro do sistema ainda tem incluso sistema de clube de assinantes, e dentro você tem total controle também dos seus assinantes. Se um assinante seu for fazer agendamento, o sistema reconhece e o valor só desconta na aba "ASSINANTES", evitando confusão do caixa normal.</p>
                        </div>
                      )}
                    </div>

                    {/* Repescagem de clientes */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('repescagem-clientes')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Repescagem de clientes</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['repescagem-clientes'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['repescagem-clientes'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100">O sistema identifica clientes que não retornaram e ajuda você a recuperá-los.</p>
                        </div>
                      )}
                    </div>

                    {/* Colaboradores */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('colaboradores')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Colaboradores</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['colaboradores'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['colaboradores'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100">Se você tem colaboradores que trabalham na sua barbearia, não se preocupe! Você consegue adicionar quantos profissionais quiser sem acréscimo de nada e ainda colocar a % que cada um deles recebe por corte. Cada colaborador seu terá uma página para ele ver os agendamentos dele, e você, dono do local, tem acesso a tudo.</p>
                        </div>
                      )}
                    </div>

                    {/* Controle financeiro total */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:scale-105">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleDropdown('controle-financeiro')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex items-center justify-center shadow-lg">
                            <BarChart3 className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Controle financeiro total</h3>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full">
                          <ArrowDown className={`w-4 h-4 text-white transition-transform duration-300 ${openDropdowns['controle-financeiro'] ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2 text-center">Clique para ver</p>
                      {openDropdowns['controle-financeiro'] && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <p className="text-blue-100 mb-3">Dentro do seu AgendeiFácil você terá 3 indicadores de valor:</p>
                          <ul className="text-blue-100 text-sm space-y-1 mb-3">
                            <li>• <strong>Valor bruto:</strong> quanto sua barbearia está faturando no mês</li>
                            <li>• <strong>Valor líquido:</strong> tirando as despesas que você adicionou</li>
                            <li>• <strong>Valor líquido estabelecimento:</strong> descontando despesas e a % de cada profissional</li>
                          </ul>
                          <p className="text-blue-100 text-sm">Assim você vê exatamente quanto cada profissional recebeu e quanto você, estabelecimento, recebeu com tudo descontado.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Imagens de exemplo do celular */}
              <div className="w-full mt-8 mb-24">
                {/* Legenda */}
                <p className="text-center text-xl text-white mb-6">
                  Envie seu link agendeifacil, ou coloque na bio do instagram
                </p>
                <img
                  src="/envia.svg"
                  alt="Envia"
                  className="w-full max-w-2xl mx-auto hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Imagem Celulares */}
              <div className="w-full mb-16">
                {/* Nova legenda */}
                <p className="text-center text-xl text-white mb-8">
                  Seu cliente irá para uma página editável única e exclusiva sua
                </p>
                <img
                  src="/testecel.svg"
                  alt="Versão Celular"
                  className="w-full mx-auto hover:scale-105 transition-transform duration-300"
                />
                {/* Legenda e imagem nova */}
                <div className="mt-8">
                  <p className="text-center text-xl text-white mb-6">
                    e você irá ver tudo em tempo real, 100% atualizado e automático
                  </p>
                  <img
                    src="/agendeifacilpordentro.png"
                    alt="AgendeiFácil por dentro"
                    className="w-full mx-auto hover:scale-105 transition-transform duration-300 rounded-xl shadow-lg"
                  />
                </div>
              </div>

              {/* Imagem metas.png adicionada aqui */}
              <div className="w-full mx-auto mb-8"> {/* Removido max-w-3xl */}
                <img
                  src="/metas.png"
                  alt="Metas"
                  className="w-full h-auto" // Removido object-contain e adicionado h-auto
                />
              </div>

              {/* Imagem finan1.png no lugar do carrossel */}
              <div className="w-full max-w-3xl mx-auto mb-8">
                <img
                  src="/finan1.png"
                  alt="Finanças 1"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Imagem finan2.png abaixo de finan1.png */}
              <div className="w-full max-w-3xl mx-auto mb-8">
                <img
                  src="/finan2.png"
                  alt="Finanças 2"
                  className="w-full h-full object-contain"
                />
              </div>

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

              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
                {/* Plano Mensal */}
                <div className="bg-[#1a1b1c] border-2 border-gray-700 rounded-2xl p-8 hover:border-blue-500 transition-all duration-300">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Plano Mensal</h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-white">R$ 39</span>
                      <span className="text-xl text-gray-300">,90/mês</span>
                    </div>
                    <ul className="space-y-4 mb-8 text-left">
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Agendamentos ilimitados</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Gestão completa de clientes</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Relatórios detalhados financeiro completo</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Confirmação automática por SMS</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Lucros diários e mensais</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Profissionais ilimitados</span>
              </li>
                            <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                <span className="text-gray-300">Controle de % para colaboradores</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                <span className="text-gray-300">Cálculo por base taxa da maquininha</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Serviços ilimitados</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Sistema de prêmio para clientes fiéis</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Mensagem de lembrete para clientes</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Página de agendamentos exclusiva sua e personalizável</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Pagamentos adiantados se preferir</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Sistema de assinantes incluso</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-gray-300">Controle total de clientes novos e antigos e atuais</span>
                      </li>
                    </ul>
                    <a
                      href="https://pay.cakto.com.br/o798qm9_509159?affiliate=jK2AXbTW"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 px-6 text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Começar Agora
                    </a>
                  </div>
                </div>

                {/* Plano Anual */}
                <div className="bg-blue-600 border-2 border-blue-500 rounded-2xl p-8 hover:border-blue-400 transition-all duration-300 relative">
                  <div className="absolute -top-3 right-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-medium">
                    2 meses grátis
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Plano Anual</h3>
                    <div className="mb-2">
                      <span className="text-sm text-gray-200 line-through">R$ 478,80</span>
                    </div>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-white">R$ 399</span>
                      <span className="text-xl text-gray-200">/ano</span>
                    </div>
                    <div className="mb-6 bg-blue-700 rounded-lg py-2 px-4">
                      <span className="text-gray-200">Economize R$ 79,80 por ano</span>
                    </div>
                    <ul className="space-y-4 mb-8 text-left">
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-white mr-3" />
                        <span className="text-white">Tudo do plano mensal</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-white mr-3" />
                        <span className="text-white">2 meses totalmente grátis</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-white mr-3" />
                        <span className="text-white">Suporte prioritário</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-white mr-3" />
                        <span className="text-white">Relatórios avançados</span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-white mr-3" />
                        <span className="text-white">Área de clientes VIP</span>
                      </li>
                    </ul>
                    <a
                      href="https://pay.cakto.com.br/ccx4wk8?affiliate=jK2AXbTW"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 px-6 text-center text-blue-600 bg-white hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Economizar Agora
                    </a>
                  </div>
                </div>
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

          <p className="text-center text-lg mb-8">
            Envie seu link agendeifacil, ou coloque na bio do instagram
          </p>

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
    </div>
  );
};

export default LandingPage;
