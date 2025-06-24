import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PromoBanner } from '../components/PromoBanner';
import WhatsAppButton from '../components/WhatsAppButton';

const LandingPage = () => {
  const { user, userRole } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const features = [
    {
      icon: Calendar,
      title: "Agendamento Online 24/7",
      description: "Seus clientes podem agendar a qualquer hora, de qualquer lugar"
    },
    {
      icon: Clock,
      title: "Tempo Real",
      description: "Atualizações instantâneas de horários disponíveis e ocupados"
    },
    {
      icon: Users,
      title: "Gestão de Clientes",
      description: "Histórico completo, preferências e dados de contato organizados"
    },
    {
      icon: Smartphone,
      title: "100% Mobile",
      description: "Interface otimizada para celular, tablet e desktop"
    },
    {
      icon: BarChart3,
      title: "Relatórios Detalhados",
      description: "Acompanhe faturamento, horários mais procurados e performance"
    },
    {
      icon: CheckCircle,
      title: "Confirmação Automática",
      description: "SMS e WhatsApp automáticos para confirmar e lembrar agendamentos"
    }
  ];

  const businessTypes = [
    { icon: Scissors, name: "Barbearias", color: "bg-blue-500" },
    { icon: Sparkles, name: "Salões de Beleza", color: "bg-pink-500" },
    { icon: Car, name: "Lava Car", color: "bg-green-500" },
    { icon: Coffee, name: "Restaurantes", color: "bg-orange-500" }
  ];

  const testimonials = [
    {
      name: "Carlos Silva",
      business: "Barbearia do Carlos",
      text: "Desde que comecei a usar o sistema, minha agenda nunca mais ficou bagunçada. Os clientes adoram poder agendar pelo celular!",
      rating: 5
    },
    {
      name: "Maria Santos",
      business: "Salão Glamour",
      text: "Economizo 2 horas por dia que antes gastava organizando agendamentos. Agora foco no que realmente importa: meus clientes.",
      rating: 5
    },
    {
      name: "João Ferreira",
      business: "AutoLave Express",
      text: "O sistema de confirmação automática reduziu em 80% as faltas. Meu faturamento aumentou significativamente!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <WhatsAppButton />
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/95 backdrop-blur-sm border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-400" />
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">AgendeiFácil</span>
              <a 
                href="https://wa.link/1jj7uf" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="ml-4 hover:opacity-80 transition-opacity"
              >
                <img 
                  src="/wppicon.png" 
                  alt="WhatsApp" 
                  className="w-6 h-6"
                />
              </a>
              <a 
                href="https://www.instagram.com/agendeifacil.oficial/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="ml-3 hover:opacity-80 transition-opacity"
              >
                <img 
                  src="/insta.png" 
                  alt="Instagram" 
                  className="w-6 h-6"
                />
              </a>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {user ? (
                <Link 
                  to={`/dashboard/${userRole}`} 
                  className="btn-primary"
                >
                  Acessar Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/suporte060622" className="btn-accent">
                    SUPORTE
                  </Link>
                  <div className="relative group">
                    <button className="btn-secondary">
                      Cadastrar
                    </button>
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-2">
                        <a 
                          href="https://pay.kiwify.com.br/ApygJMY" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Cadastrar como estabelecimento
                        </a>
                        <Link 
                          to="/register?role=client" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Cadastrar como cliente
                        </Link>
                      </div>
                    </div>
                  </div>
                  <Link to="/login" className="btn-primary">
                    Entrar
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-black border-t border-gray-800">
            <div className="px-4 py-2 space-y-2">
              {user ? (
                <Link 
                  to={`/dashboard/${userRole}`} 
                  className="block w-full text-left px-3 py-2 text-gray-300 hover:text-blue-400"
                >
                  Acessar Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/suporte060622" className="block w-full text-left px-3 py-2 text-gray-300 hover:text-blue-400">
                    SUPORTE
                  </Link>
                  <Link to="/register?role=client" className="block w-full text-left px-3 py-2 text-gray-300 hover:text-blue-400">
                    Cadastrar como cliente
                  </Link>
                  <a 
                    href="https://pay.kiwify.com.br/ApygJMY" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-left px-3 py-2 text-gray-300 hover:text-blue-400"
                  >
                    Cadastrar como estabelecimento
                  </a>
                  <Link to="/login" className="block w-full text-left px-3 py-2 text-gray-300 hover:text-blue-400">
                    Entrar
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <img 
              src="/logoagendei.png"
              alt="AgendeiFácil - Revolucione seu Agendamento em Tempo Real"
              className="mx-auto mb-8 max-w-[300px] w-full"
            />
            <div className="bg-[#0a0a1f] rounded-full py-3 px-6 inline-flex items-center gap-2 mb-8 shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span className="text-blue-400 font-medium">Sistema #1 em Agendamentos no Brasil</span>
            </div>
            <div className="aspect-video w-full mb-8">
              <iframe
                className="w-full h-full rounded-lg shadow-lg"
                src="https://www.youtube.com/embed/E_fY0Xo5cE8"
                title="Vídeo de apresentação"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <img 
              src="/QUAIS.png" 
              alt="Seu agendamento em tempo real nunca foi tão fácil" 
              className="mx-auto mb-6 max-w-[400px] w-full"
            />

            <PromoBanner />

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
                      <span className="text-gray-300">Relatórios detalhados</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                      <span className="text-gray-300">Suporte por WhatsApp</span>
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
                      <span className="text-gray-300">Serviços ilimitados</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                      <span className="text-gray-300">Mensagem de lembrete para clientes</span>
                    </li>
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
                    href="https://pay.kiwify.com.br/ApygJMY"
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
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Funcionalidades pensadas especificamente para otimizar seu negócio e encantar seus clientes
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:border-blue-500 group">
                <div className="bg-blue-900/50 w-12 h-12 rounded-lg flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                  <feature.icon className="h-6 w-6 text-blue-400 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Types Section */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Perfeito para seu tipo de negócio
            </h2>
            <p className="text-xl text-gray-300">
              Já ajudamos centenas de estabelecimentos a organizarem suas agendas
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {businessTypes.map((type, index) => (
              <div key={index} className="bg-gray-800 p-8 rounded-xl text-center hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-2 border border-gray-700 hover:border-blue-500">
                <div className={`${type.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <type.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{type.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-xl text-gray-300">
              Histórias reais de quem transformou seu negócio com o AgendeFácil
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:border-blue-500">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 italic">"{testimonial.text}"</p>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-gray-400 text-sm">{testimonial.business}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Pronto para revolucionar seu negócio?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de estabelecimentos que já transformaram sua gestão de agendamentos.
            Comece hoje mesmo e veja a diferença.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://pay.kiwify.com.br/ApygJMY"
              target="_blank"
              rel="noopener noreferrer" 
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
            >
              Começar Agora
              <ArrowRight className="inline-block ml-2 h-5 w-5" />
            </a>
            <a 
              href="https://wa.link/1jj7uf"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-blue-600 transition-all duration-200"
            >
              Falar com Especialista
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
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
                  <Phone className="h-5 w-5 text-blue-400 mr-3" />
                  <span className="text-gray-400">(48) 9 9126-5320</span>
                </div>
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
                <li><a href="https://wa.link/1jj7uf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>
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
