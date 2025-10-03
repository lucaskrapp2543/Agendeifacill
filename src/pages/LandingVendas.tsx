import {
  BarChart3,
  Calendar,
  CheckCircle,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const LandingVendas = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Calendar className="w-8 h-8 text-blue-600" />,
      title: "Agendamento Online 24/7",
      description: "Seus clientes agendam a qualquer hora, de qualquer lugar. Nunca mais perca uma venda por estar fechado!"
    },
    {
      icon: <Users className="w-8 h-8 text-green-600" />,
      title: "Múltiplos Profissionais",
      description: "Gerencie toda sua equipe em uma única plataforma. Sem custos extras por profissional!"
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-purple-600" />,
      title: "Lembretes Automáticos",
      description: "Reduza faltas em 80% com lembretes automáticos por WhatsApp e SMS"
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
      icon: <Shield className="w-8 h-8 text-indigo-600" />,
      title: "100% Seguro",
      description: "Seus dados protegidos com criptografia de nível bancário"
    }
  ];

  const testimonials = [
    {
      name: "Maria Silva",
      business: "Salão Maria's",
      text: "Aumentei minha receita em 40% em apenas 3 meses! Os clientes adoram poder agendar online.",
      rating: 5
    },
    {
      name: "João Santos",
      business: "Barbearia do João",
      text: "O sistema de metas motivou muito minha equipe. Agora todos trabalham com mais foco!",
      rating: 5
    },
    {
      name: "Ana Costa",
      business: "Clínica Estética Ana",
      text: "Reduzi as faltas de 30% para apenas 5%. Os lembretes automáticos são incríveis!",
      rating: 5
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
    "Atualizações gratuitas"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-lg' : 'bg-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-blue-600 mr-2" />
              <span className="text-2xl font-bold text-gray-900">AgendaFácil</span>
            </div>

            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">Funcionalidades</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors">Preços</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors">Depoimentos</a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors">Contato</a>
            </nav>

            <div className="flex items-center space-x-4">
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Começar Grátis
              </Link>
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
            <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Mais de 1.000 estabelecimentos já usam
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Transforme seu negócio com
              <span className="text-blue-600 block">agendamentos online</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto px-4">
              O sistema completo de agendamentos que vai aumentar sua receita,
              reduzir faltas e organizar sua agenda profissional.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 px-4">
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all transform hover:scale-105 flex items-center justify-center"
              >
                <Rocket className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Começar Agora - Grátis
              </Link>
              <button className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all flex items-center justify-center">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Falar com Especialista
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-sm text-gray-500 px-4">
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
          <div className="text-center mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Preço que cabe no seu bolso
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Tudo que você precisa por menos que uma pizza por dia
            </p>
          </div>

          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 relative border-2 border-blue-200">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-semibold">
                  Mais Popular
                </span>
              </div>

              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Plano Profissional</h3>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">R$ 47,90</span>
                  <span className="text-gray-600 ml-2 text-lg sm:text-xl">/mês</span>
                </div>
                <p className="text-gray-600 text-sm sm:text-base">Tudo que você precisa para crescer</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Inclui:</h4>
                  <ul className="space-y-2">
                    {pricingFeatures.slice(0, 4).map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">E muito mais:</h4>
                  <ul className="space-y-2">
                    {pricingFeatures.slice(4).map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="text-center">
                <Link
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 inline-flex items-center"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Começar Agora - Grátis
                </Link>
                <p className="text-sm text-gray-500 mt-4">
                  Teste grátis por 14 dias • Cancele quando quiser
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Histórias reais de sucesso
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 p-6 sm:p-8 rounded-xl">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-sm sm:text-base text-gray-700 mb-6 italic">
                  "{testimonial.text}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900 text-sm sm:text-base">{testimonial.name}</div>
                  <div className="text-gray-600 text-sm sm:text-base">{testimonial.business}</div>
                </div>
              </div>
            ))}
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
            Junte-se a mais de 1.000 estabelecimentos que já aumentaram sua receita com o AgendaFácil
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 hover:bg-gray-100 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all transform hover:scale-105 inline-flex items-center justify-center"
            >
              <Rocket className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Começar Agora - Grátis
            </Link>
            <button className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all flex items-center justify-center">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Falar com Especialista
            </button>
          </div>

          <div className="mt-8 text-blue-100 text-xs sm:text-sm">
            <p>✅ Teste grátis por 14 dias • ✅ Sem compromisso • ✅ Suporte 24/7</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center mb-4">
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 mr-2" />
                <span className="text-xl sm:text-2xl font-bold">AgendaFácil</span>
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
                  (11) 99999-9999
                </li>
                <li className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  contato@agendafacil.com
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 AgendaFácil. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingVendas;
