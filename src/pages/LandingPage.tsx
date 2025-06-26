import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Rocket
} from 'lucide-react';
import { PromoBanner } from '../components/PromoBanner';

const LandingPage = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      business: "Studio Beauty",
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
    "Relatórios detalhados",
    "Confirmação automática por SMS",
    "Lucros diários e mensais",
    "Profissionais ilimitados",
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/95 backdrop-blur-sm border-b border-gray-800 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-blue-500" />
              <div className="flex items-center ml-6">
                <span className="text-sm font-medium text-gray-300 mr-2">DÚVIDAS MANDE DIRECT</span>
                <ArrowRight className="h-5 w-5 text-gray-300 mx-2" />
                <a 
                  href="https://www.instagram.com/agendeifacil.oficial/#" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <img src="/insta.png" alt="Instagram" className="h-7 w-7 hover:opacity-80 transition-opacity" />
                </a>
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
      <section className="pt-24 pb-16 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex flex-col items-center space-y-4 pt-8">
              <img
                src="/logoagendei.png"
                alt="AgendeiFácil Logo"
                className="mx-auto max-w-[200px] w-full"
              />
              
              {/* Nova seção de destaque */}
              <div className="w-full max-w-3xl">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-800 rounded-2xl p-3 md:p-4">
                  <div className="flex items-center justify-center gap-2 md:gap-3 whitespace-nowrap">
                    <Rocket className="h-4 w-4 md:h-6 md:w-6 text-white flex-shrink-0" />
                    <span className="text-sm md:text-xl text-white font-semibold">
                      Líder em Tecnologia de Agendamentos
                    </span>
                  </div>
                </div>
              </div>

              {/* Vídeo do YouTube */}
              <div className="aspect-video w-full mb-6">
                <iframe
                  className="w-full h-full rounded-2xl"
                  src="https://www.youtube.com/embed/6H9u6mxRkgI"
                  title="Vídeo de apresentação"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Botão de ação */}
              <div className="w-full flex justify-center mb-6">
                <button
                  onClick={() => {
                    const plansSection = document.getElementById('planos');
                    if (plansSection) {
                      plansSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  SER AGENDEI FÁCIL
                </button>
              </div>

              {/* Imagem QUAIS */}
              <div className="w-full mb-8">
                <img 
                  src="/QUAIS.png" 
                  alt="Barbearia, Salões, Lava-car e outros estabelecimentos" 
                  className="w-full rounded-2xl"
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

              {/* Cards de Funcionalidades */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
                {features.map((feature, index) => (
                  <div key={index} className="bg-[#1a1b1c] p-6 rounded-2xl border border-[#2e2f30] hover:border-blue-500 transition-all duration-300">
                    <div className="flex items-start gap-4 mb-2">
                      <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                        {feature.icon}
                      </div>
                      <h3 className="text-xl font-semibold pt-2">{feature.title}</h3>
                    </div>
                    <p className="text-gray-400 pl-16">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Seção de Depoimentos */}
              <div className="bg-white py-16 mb-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 bg-gradient-to-r from-[#FF6B00] to-[#0099FF] bg-clip-text text-transparent">
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
                      {monthlyFeatures.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
            <a 
              href="https://pay.kiwify.com.br/ApygJMY"
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
                  href="https://pay.kiwify.com.br/77necFv"
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
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a
                href="https://wa.link/wtmlac"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
              >
                Falar com Consultor
              </a>
              <a
                href="https://pay.kiwify.com.br/8gW8Hl8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10"
              >
                Começar Agora
              </a>
            </div>
          </div>
              </div>
      </section>

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
    </div>
  );
};

export default LandingPage;
