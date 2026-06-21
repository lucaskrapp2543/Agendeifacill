import {
  BarChart3,
  Calendar,
  Camera,
  CheckCircle,
  ChevronDown,
  CreditCard,
  Mail,
  MessageCircle,
  Phone,
  Rocket,
  Search,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanosCards from '../components/PlanosCards';
import WhatsAppButton from '../components/WhatsAppButton';
import { getCurrentVersion } from '../utils/versionManager';

const LandingVendas = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const assetVersion = getCurrentVersion();
  const img = (path: string) => `${path}?v=${assetVersion}`;

  const images = [img('/feedback.png'), img('/VS1.png'), img('/s1.png'), img('/s2.png')];

  const whatsappNumber = '5548991484275';
  const whatsappMessage = 'Quero saber melhor sobre agendei facil vim pelo site';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  // ✅ LÓGICA DO POPUP "VOCÊ JÁ É ASSINANTE?" — MANTIDA INTACTA
  const handleLogin = () => setShowSubscriberModal(true);
  const handleGoToLogin = () => { setShowSubscriberModal(false); navigate('/login'); };
  const handleGoToPricing = () => {
    setShowSubscriberModal(false);
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const painPoints = [
    {
      icon: <MessageCircle className="w-6 h-6 text-red-400" />,
      title: 'WhatsApp inundado de perguntas',
      desc: '"Qual o horário disponível?" — às 23h, no seu dia de folga.',
    },
    {
      icon: <Users className="w-6 h-6 text-red-400" />,
      title: 'Falta sem aviso',
      desc: 'Cadeira vazia, profissional esperando, dinheiro perdido. Sempre.',
    },
    {
      icon: <Calendar className="w-6 h-6 text-red-400" />,
      title: 'Agenda bagunçada',
      desc: 'Horários conflitando, anotações no papel, cliente irritado.',
    },
    {
      icon: <CreditCard className="w-6 h-6 text-red-400" />,
      title: 'Pagamentos esquecidos',
      desc: 'Cobrar depois do atendimento é constrangedor. E alguns simplesmente somem.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-red-400" />,
      title: 'Sem controle financeiro',
      desc: 'Não sabe quanto cada profissional rendeu nem qual serviço dá mais lucro.',
    },
  ];

  const solutions = [
    {
      icon: <Calendar className="w-7 h-7 text-blue-400" />,
      title: 'Agenda online 24/7',
      desc: 'Seus clientes agendam a qualquer hora, sem precisar falar com você. Você acorda com a agenda cheia.',
    },
    {
      icon: <MessageCircle className="w-7 h-7 text-green-400" />,
      title: 'Lembretes automáticos',
      desc: 'O sistema avisa o cliente 1 hora antes pelo WhatsApp. Menos faltas, mais dinheiro.',
    },
    {
      icon: <CreditCard className="w-7 h-7 text-purple-400" />,
      title: 'Pagamento antecipado',
      desc: 'Cliente paga no momento do agendamento. Você recebe antes de atender.',
    },
    {
      icon: <BarChart3 className="w-7 h-7 text-amber-400" />,
      title: 'Financeiro completo',
      desc: 'Faturamento, comissões e lucro de cada profissional — em tempo real, sem planilha.',
    },
    {
      icon: <Star className="w-7 h-7 text-yellow-400" />,
      title: 'AFCoins & Assinaturas',
      desc: 'Fidelize com moedas de recompensa e planos mensais com cobrança automática.',
    },
    {
      icon: <Smartphone className="w-7 h-7 text-teal-400" />,
      title: 'Página exclusiva sua',
      desc: 'Um link único com foto, serviços, avaliações e agendamento direto.',
    },
  ];

  const faqs = [
    {
      q: 'Meu cliente precisa baixar algum aplicativo?',
      a: 'Não. Tudo funciona direto no navegador do celular ou computador. Zero downloads, zero atrito.',
    },
    {
      q: 'O cliente precisa criar uma conta para agendar?',
      a: 'Não. Basta informar nome e telefone. O agendamento é feito em poucos cliques, sem cadastro.',
    },
    {
      q: 'Posso usar no celular?',
      a: 'Sim. O sistema é 100% responsivo e funciona perfeitamente no celular, tablet e computador.',
    },
    {
      q: 'O pagamento online é obrigatório?',
      a: 'Não. É opcional. O cliente escolhe se prefere pagar online na hora do agendamento ou pagar no local.',
    },
    {
      q: 'Posso cancelar quando quiser?',
      a: 'Sim. Sem multa, sem fidelidade, sem burocracia. Cancele quando quiser.',
    },
    {
      q: 'Funciona para barbearia e salão de beleza?',
      a: 'Sim. O sistema funciona para qualquer estabelecimento de beleza e bem-estar — barbearia, salão, estética, nail design e mais.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#101112] text-white">
      <WhatsAppButton />

      {/* ── HEADER ── */}
      <header
        className={`hidden sm:block fixed w-full z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#101112]/95 border-b border-gray-800 shadow-[0_10px_30px_rgba(0,0,0,0.45)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <img src={img('/logosite.png')} alt="Agendei Fácil" className="hidden sm:block h-8 w-auto" />

            <nav className="hidden md:flex items-center space-x-8">
              <a href="#como-funciona" className="text-gray-300 hover:text-white transition-colors text-sm">Como Funciona</a>
              <a href="#features" className="text-gray-300 hover:text-white transition-colors text-sm">Funcionalidades</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors text-sm">Planos</a>
              <a href="#faq" className="text-gray-300 hover:text-white transition-colors text-sm">FAQ</a>
            </nav>

            <button
              onClick={handleLogin}
              className="hidden sm:block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="sm:pt-20 pb-16 bg-[#0b0c0d]">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">

          {/* Imagem topo mobile — colada no topo, sem espaço */}
          <div className="sm:hidden mb-0">
            <div className="relative">
              <img
                src={img('/ppp3.webp')}
                alt="Sistema Agendei Fácil"
                className="w-full h-auto block"
              />
              {/* Login sobreposto na imagem */}
              <button
                onClick={handleLogin}
                className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg"
              >
                Login
              </button>
            </div>
            {/* Faixa diagonal separadora */}
            <div className="relative bg-[#0b0c0d] overflow-hidden" style={{ height: '60px' }}>
              <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <polygon points="0,0 400,0 400,60 0,30" fill="#000000" />
              </svg>
              <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <polygon points="0,0 400,0 400,45 0,18" fill="#000000" opacity="0.4" />
              </svg>
            </div>
            {/* Vídeo mobile - formato reels/vertical */}
            <div className="flex justify-center mt-6 mb-4 px-8">
              <div className="w-full max-w-[300px]">
                <div className="relative rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl bg-black" style={{ aspectRatio: '9/16' }}>
                  <iframe
                    src="https://www.youtube.com/embed/6F5I6FDbito?rel=0"
                    title="Agendei Fácil"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-6 mb-10">
            <div className="inline-flex items-center gap-2 bg-blue-600/15 border border-blue-500/30 rounded-full px-4 py-1.5 text-xs sm:text-sm text-blue-300 font-semibold mb-6">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              Sistema completo para barbearias e salões
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
              Seus clientes agendam sozinhos.{' '}
              <span className="text-blue-400">Você foca em atender.</span>
            </h1>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <a
                href="#pricing"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-bold transition-colors flex items-center justify-center shadow-lg"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Começar agora
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gray-700 text-gray-200 hover:bg-white/10 px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center"
              >
                <Phone className="w-5 h-5 mr-2" />
                Falar com especialista
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Sem taxa de setup
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Cancele quando quiser
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Suporte todos os dias
              </span>
            </div>
          </div>

          {/* Imagem hero */}
          <div className="-mx-4 sm:mx-auto sm:max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0f1011] shadow-[0_30px_70px_rgba(0,0,0,0.65)]">
              <img
                src={img('/pclanding.png')}
                alt="Sistema Agendei Fácil"
                className="hidden sm:block w-full h-auto mx-auto object-contain opacity-95"
                style={{ maxHeight: '520px' }}
              />
            </div>
          </div>

          {/* Vídeo desktop - abaixo da imagem pclanding */}
          <div className="hidden sm:block mt-6 mx-auto max-w-5xl">
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-black" style={{ aspectRatio: '16/9' }}>
              <iframe
                src="https://www.youtube.com/embed/oC9_F-7wXeo?rel=0"
                title="Agendei Fácil - Vídeo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                style={{ border: 'none' }}
              />
            </div>
          </div>

          <div className="flex justify-center mt-8 px-4">
            <img
              src={img('/clientesk.png')}
              alt="Clientes usando o Agendei Fácil"
              className="h-20 w-[96vw] max-w-none sm:h-12 sm:w-auto object-contain"
            />
          </div>
        </div>
      </section>

      {/* ── DOR DO BARBEIRO ── */}
      <section className="py-20 bg-[#101112]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Você se identifica com algum disso?
            </h2>
            <p className="text-gray-400 text-base sm:text-lg">
              Esses são os problemas mais comuns de quem ainda não usa o Agendei Fácil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {painPoints.map((p, i) => (
              <div
                key={i}
                className="bg-[#1a1b1c] border border-red-900/40 rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  {p.icon}
                  <h3 className="text-white font-semibold text-sm sm:text-base">{p.title}</h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}

            {/* Card de resolução */}
            <div className="bg-[#1a2236] border border-blue-500/40 rounded-xl p-5 flex flex-col gap-3 items-start justify-center sm:col-span-2 lg:col-span-1">
              <Sparkles className="w-6 h-6 text-blue-400" />
              <h3 className="text-white font-bold text-base sm:text-lg">
                O Agendei Fácil resolve tudo isso.
              </h3>
              <a
                href="#pricing"
                className="text-blue-400 text-sm font-semibold hover:underline"
              >
                Ver planos →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="py-20 bg-[#0f1011]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-gray-800 bg-[#1a1b1c] shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-6 sm:p-10">
            <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-3 uppercase tracking-tight">
              Como Funciona?
            </h2>
            <p className="text-center text-gray-400 text-sm sm:text-base mb-10 max-w-xl mx-auto">
              Em 3 passos simples, sua barbearia fica no automático.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              {[
                {
                  step: '01',
                  title: 'Compartilhe seu link',
                  text: 'Você recebe um link único da sua barbearia. Coloca no WhatsApp, Instagram, story — onde preferir. Seu cliente acessa direto, sem baixar nada.',
                  color: 'text-blue-400',
                  border: 'border-blue-900/50',
                },
                {
                  step: '02',
                  title: 'Cliente agenda em segundos',
                  text: 'Ele escolhe o serviço, profissional, data e horário. Tudo em poucos cliques, sem criar conta. Pode pagar online ou no local.',
                  color: 'text-emerald-400',
                  border: 'border-emerald-900/50',
                },
                {
                  step: '03',
                  title: 'Você recebe e relaxa',
                  text: 'Notificação no sistema e no seu WhatsApp. O sistema lembra o cliente 1 hora antes automaticamente. Menos faltas, mais dinheiro.',
                  color: 'text-purple-400',
                  border: 'border-purple-900/50',
                },
              ].map(({ step, title, text, color, border }) => (
                <div key={step} className={`rounded-2xl bg-[#101112] border ${border} p-6 space-y-3`}>
                  <div className={`text-4xl font-black ${color} opacity-80`}>{step}</div>
                  <h3 className={`text-base sm:text-lg font-bold ${color}`}>{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-[#101112] border border-gray-800 p-6">
              <h3 className="text-base sm:text-lg font-bold text-blue-300 mb-2">
                Área do estabelecimento
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Dentro do sistema você tem controle total: financeiro, estoque de produtos, agendamentos,
                assinaturas, profissionais e comissões. Tudo em um painel simples e intuitivo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES / SOLUÇÃO ── */}
      <section id="features" className="py-20 bg-[#101112]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Tudo que sua barbearia precisa
            </h2>
            <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
              Não é só uma agenda. É um sistema completo de vendas, gestão e fidelização.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((s, i) => (
              <div
                key={i}
                className="bg-[#1a1b1c] border border-gray-800 rounded-xl p-6 space-y-3"
              >
                <div className="w-12 h-12 bg-[#101112] border border-gray-800 rounded-xl flex items-center justify-center">
                  {s.icon}
                </div>
                <h3 className="text-white font-semibold text-base sm:text-lg">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PÁGINA EXCLUSIVA ── */}
      <section id="testimonials" className="py-20 bg-[#0f1011]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-gray-800 bg-[#101112] shadow-[0_35px_90px_rgba(0,0,0,0.55)] mb-14">
            <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-blue-600/8 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-purple-600/8 blur-3xl pointer-events-none" />

            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center p-6 sm:p-10 lg:p-14">
              <div className="space-y-6 text-center lg:text-left">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-gray-800 px-4 py-2 text-xs sm:text-sm font-semibold text-blue-200">
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                  Página exclusiva do seu estabelecimento
                </span>

                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                  Você ganha uma página{' '}
                  <span className="text-blue-400">EXCLUSIVA</span>{' '}
                  só sua!
                </h2>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
                  Um link único com tudo que seus clientes precisam: agendamentos, fotos, avaliações,
                  redes sociais e benefícios — em um layout moderno pensado para conversão.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Galeria completa', desc: 'Fotos do seu espaço para encantar novos clientes.', icon: <Camera className="w-5 h-5 text-blue-400" /> },
                    { title: 'Redes sociais conectadas', desc: 'Links diretos para Instagram, Facebook e WhatsApp.', icon: <Smartphone className="w-5 h-5 text-green-400" /> },
                    { title: 'Avaliações do Google', desc: 'Mostre depoimentos reais e ganhe credibilidade.', icon: <Search className="w-5 h-5 text-yellow-400" /> },
                    { title: 'Agendamento + Wi‑Fi', desc: 'Cliente agenda em segundos e ainda recebe a senha do Wi‑Fi.', icon: <Calendar className="w-5 h-5 text-purple-400" /> },
                  ].map((f) => (
                    <div key={f.title} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-white/5 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#101112] border border-gray-800 flex-shrink-0">
                        {f.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-base text-gray-300 leading-relaxed">
                  Chega de vários QR Codes espalhados pelo salão. Seu cliente acessa tudo em um único link elegante — no celular ou no computador.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-gray-800 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                <img
                  src={img('/paginaextra.png')}
                  alt="Exemplo de página exclusiva"
                  className="w-full h-auto opacity-95"
                />
              </div>
            </div>
          </div>

          {/* Carrossel — veja o sistema por dentro */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-center text-lg sm:text-xl font-bold text-white mb-2">
              Veja o sistema por dentro
            </h3>
            <p className="text-center text-gray-400 text-sm mb-6">
              Painel limpo, intuitivo e pensado para o dia a dia da barbearia.
            </p>
            <div className="relative">
              <div className="relative overflow-hidden rounded-xl border border-gray-800">
                <img
                  src={images[currentImageIndex]}
                  alt={`Demonstração ${currentImageIndex + 1}`}
                  className="w-full h-auto rounded-xl transition-opacity duration-300"
                />
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                  aria-label="Imagem anterior"
                >←</button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                  aria-label="Próxima imagem"
                >→</button>
              </div>
              <div className="flex justify-center mt-3 gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentImageIndex ? 'bg-blue-500' : 'bg-gray-700'}`}
                    aria-label={`Ir para slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── AFCOINS ── */}
      <section className="py-20 bg-[#101112]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-amber-900/40 bg-[#1a1b1c] p-6 sm:p-10 flex flex-col lg:flex-row items-center gap-10">
            <div className="flex-shrink-0">
              <img
                src={img('/afcoin.png')}
                alt="AFCoins — moedas de recompensa Agendei Fácil"
                className="w-36 h-36 sm:w-48 sm:h-48 object-contain mx-auto"
              />
            </div>
            <div className="space-y-4 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 text-xs font-semibold text-amber-300">
                <Star className="w-3.5 h-3.5" />
                Sistema de recompensas exclusivo
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                Seus clientes ganham{' '}
                <span className="text-amber-400">AFCoins</span>{' '}
                a cada agendamento
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                O Agendei Fácil recompensa seus clientes por agendarem com você. Eles acumulam moedas e
                podem trocá-las por benefícios na sua barbearia —{' '}
                <strong className="text-white">pagos pelo próprio Agendei Fácil, não por você.</strong>
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Resultado: clientes voltam mais, indicam mais e ficam mais fiéis. Você ganha recorrência sem gastar nada extra.
              </p>
              <a href="#pricing" className="inline-flex items-center gap-2 text-amber-400 font-semibold text-sm hover:underline">
                Quero esse recurso →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── PAGAMENTO ANTECIPADO + WHATSAPP + ASSINATURAS ── */}
      <section className="py-20 bg-[#0f1011]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Recursos que fazem a diferença
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
              Cada funcionalidade foi pensada para aumentar sua receita e reduzir sua dor de cabeça.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pagamento antecipado */}
            <div className="bg-[#1a1b1c] border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 bg-[#101112] border border-gray-800 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-white font-bold text-lg">Pagamento antecipado</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Seu cliente escolhe pagar online na hora do agendamento ou pagar no local. Quando paga online,{' '}
                <strong className="text-white">você recebe antes de atender — e as faltas caem drasticamente.</strong>
              </p>
              <ul className="space-y-2 pt-2">
                {['Pix e cartão aceitos', 'Você recebe na hora', 'Menos faltas, mais controle'].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </div>

            {/* WhatsApp automático */}
            <div className="bg-[#1a1b1c] border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 bg-[#101112] border border-gray-800 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-white font-bold text-lg">WhatsApp automático</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                O sistema envia lembretes automáticos pelo WhatsApp 1 hora antes do horário marcado.
                Seu cliente não esquece — e você não perde dinheiro com falta.
              </p>
              <div className="pt-2">
                <img
                  src={img('/lembrete.png')}
                  alt="Exemplo de lembrete automático no WhatsApp"
                  className="w-full h-auto rounded-lg border border-gray-800 opacity-90"
                />
              </div>
            </div>

            {/* Assinaturas */}
            <div className="bg-[#1a1b1c] border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 bg-[#101112] border border-gray-800 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-bold text-lg">Assinaturas mensais</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Venda planos mensais para seus melhores clientes. Eles pagam um valor fixo por mês
                e têm acesso a serviços exclusivos. Você garante receita recorrente e previsível.
              </p>
              <ul className="space-y-2 pt-2">
                {['Cobranças automáticas', 'Fidelização garantida', 'Renda previsível todo mês'].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-purple-300">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINANCEIRO ── */}
      <section className="py-20 bg-[#101112]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-gray-800 bg-[#1a1b1c] p-6 sm:p-10 flex flex-col lg:flex-row-reverse items-center gap-10">
            <div className="flex-shrink-0 lg:w-1/2">
              <img
                src={img('/finan1.png')}
                alt="Dashboard financeiro Agendei Fácil"
                className="w-full h-auto rounded-xl border border-gray-800 opacity-90"
              />
            </div>
            <div className="space-y-5 text-center lg:text-left lg:w-1/2">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-full px-4 py-1.5 text-xs font-semibold text-teal-300">
                <TrendingUp className="w-3.5 h-3.5" />
                Financeiro completo
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                Saiba exatamente quanto sua barbearia está ganhando
              </h2>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                Faturamento, despesas, comissões por profissional, metas e lucro — tudo em tempo real.
                Sem planilha, sem achismo, sem surpresa no fim do mês.
              </p>
              <ul className="space-y-2.5 text-left">
                {[
                  'Receita por profissional e por serviço',
                  'Controle de comissões (%)',
                  'Entradas e saídas registradas',
                  'Estoque de produtos com controle de vendas',
                  'Metas e ranking de profissionais',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-teal-200">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-teal-400" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHECKLIST BENEFÍCIOS ── */}
      <section className="py-16 bg-[#0f1011]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#1a1b1c] rounded-2xl border border-gray-800 shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-6 sm:p-10">
            <div className="flex justify-center mb-8">
              <img
                src={img('/A1.png')}
                alt="Agendei Fácil — sistema mais completo"
                className="w-[85vw] max-w-[480px] object-contain rounded-xl opacity-95"
              />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Somos o sistema mais completo do mercado
              </h2>
              <p className="text-sm text-gray-400">E isso é só parte do que você leva:</p>
            </div>

            <div className="space-y-2.5 mb-8">
              {[
                'Página exclusiva e editável sua',
                'Seu cliente agenda em poucos cliques',
                'Clientes não precisam criar conta para agendar',
                'Notificação no sistema e no WhatsApp a cada agendamento',
                'Seu cliente não precisa baixar app',
                'Seu cliente recebe lembrete antes do horário',
                'Seus clientes não veem sua concorrência',
                'Controle financeiro completo',
                'Controle total de agendamentos',
                'Sistema de estoque completo',
                'Controle de % por colaborador',
                'Controle de taxas de maquininha',
                'Sistema de assinaturas incluso',
                'App Agendei Fácil disponível',
                'Sistema intuitivo e fácil de usar',
              ].map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20"
                >
                  <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <span className="text-sm text-emerald-100 font-semibold">{f}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#101112] border border-blue-500/30 rounded-xl p-4 text-center">
              <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                <span className="text-emerald-300">Gostou?</span> Isso é só{' '}
                <span className="text-red-400 font-extrabold">40%</span> do que oferecemos.{' '}
                <span className="text-blue-300 font-extrabold">Tem muito mais.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL ── */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
            {[
              { num: 'Centenas', label: 'de estabelecimentos' },
              { num: 'Milhares', label: 'de agendamentos por mês' },
              { num: '7 dias', label: 'de garantia' },
              { num: 'Todo dia', label: 'suporte ativo' },
            ].map(({ num, label }) => (
              <div key={label}>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1">{num}</div>
                <div className="text-sm sm:text-base text-blue-100">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="pricing" className="py-20 bg-[#101112]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Escolha o plano certo para você
            </h2>
            <div className="max-w-2xl mx-auto mb-6">
              <img
                src={img('/pizza.png')}
                alt=""
                className="w-full h-auto rounded-lg border border-gray-800 opacity-95"
              />
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-6 max-w-xl mx-auto">
              <p className="text-base sm:text-lg text-blue-200 font-bold">
                Confiamos tanto no nosso sistema que você tem 7 dias de garantia
              </p>
            </div>
          </div>

          <PlanosCards whatsappNumber="5548991484275" hidePrata />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 bg-[#0f1011]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Perguntas frequentes
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Tire suas dúvidas antes de começar.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#1a1b1c] border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
                >
                  <span className="text-white font-semibold text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="contact" className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Pronto para deixar sua agenda no automático?
          </h2>
          <p className="text-blue-100 text-base sm:text-lg mb-10 max-w-2xl mx-auto">
            Centenas de barbearias já organizam, vendem mais e perdem menos cliente com o Agendei Fácil.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#pricing"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-lg text-lg font-bold transition-colors flex items-center justify-center"
            >
              <Rocket className="w-5 h-5 mr-2" />
              Começar agora
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center"
            >
              <Phone className="w-5 h-5 mr-2" />
              Falar com especialista
            </a>
          </div>

          <p className="mt-8 text-blue-100 text-xs sm:text-sm">
            ✅ Sem compromisso &nbsp;•&nbsp; ✅ 7 dias de garantia &nbsp;•&nbsp; ✅ Suporte todos os dias
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0b0c0d] border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src={img('/logosite.png')} alt="Agendei Fácil" className="h-7 w-auto" />
                <span className="text-xl font-bold text-white">Agendei Fácil</span>
              </div>
              <p className="text-sm text-gray-400">
                O sistema de agendamento e gestão mais completo para barbearias e salões.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Produto</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Suporte</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white transition-colors">
                    Falar com especialista
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Contato</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />(48) 99126-5320
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />contato@agendafacil.com
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-8 text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Agendei Fácil. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* ── POPUP "VOCÊ JÁ É ASSINANTE AGENDEI FÁCIL?" ── */}
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
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🤔</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">
              Você já é assinante Agendei Fácil?
            </h3>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleGoToLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ✅ SIM - Já sou assinante
              </button>
              <button
                onClick={handleGoToPricing}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
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
