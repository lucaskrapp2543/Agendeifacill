import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import PlanosCards from '../components/PlanosCards';
import { readPartnerReferralCupomFromSearch } from '../lib/partnerReferralCode';

export default function Planos() {
  const location = useLocation();
  const referralCupom = readPartnerReferralCupomFromSearch(location.search);
  const whatsappNumber = '5548991484275';
  const waLink = (mensagem: string) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`;

  // ✅ Popups (somente na página /planos)
  const [socialProof, setSocialProof] = useState<{ name: string; plan: 'ouro' | 'diamante' } | null>(
    null
  );
  const [socialProofVisible, setSocialProofVisible] = useState(false);
  const socialProofStartedRef = useRef(false);

  // ✅ Carrossel (mesmo da página inicial, abaixo do /paginaextra.png)
  const carouselImages = ['/feedback.png', '/VS1.png', '/s1.png', '/s2.png'];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);

  // ✅ FAQ (mesmo da página inicial)
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  useEffect(() => {
    // Evita duplicar timers em dev/StrictMode
    if (socialProofStartedRef.current) return;
    socialProofStartedRef.current = true;

    const names = [
      'João',
      'Maria',
      'Pedro',
      'Ana',
      'Lucas',
      'Fernanda',
      'Rafael',
      'Camila',
      'Guilherme',
      'Juliana',
      'Bruno',
      'Beatriz',
      'Matheus',
      'Larissa',
      'Felipe',
      'Mariana',
      'Diego',
      'Letícia',
      'Thiago',
      'Carolina'
    ];
    const plans: Array<'ouro' | 'diamante'> = ['ouro', 'diamante'];

    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    let timeoutId: number | undefined;

    const cycle = () => {
      timeoutId = window.setTimeout(() => {
        const next = { name: pick(names), plan: pick(plans) };
        setSocialProof(next);
        setSocialProofVisible(true);

        // Dura 3s na tela
        timeoutId = window.setTimeout(() => {
          setSocialProofVisible(false);
          // Após sumir, espera 7s e aparece outro
          timeoutId = window.setTimeout(() => {
            cycle();
          }, 7000);
        }, 3000);
      }, 7000);
    };

    cycle();

    return () => {
      socialProofStartedRef.current = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const planLabel = (p: 'ouro' | 'diamante') => {
    if (p === 'ouro') return 'ouro';
    return 'diamante';
  };

  const planBadgeClasses = (p: 'ouro' | 'diamante') => {
    if (p === 'ouro') return 'bg-amber-300 text-black';
    return 'bg-sky-200 text-sky-900';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Imagem de topo — mesma da landing (novaim), apenas mobile, full-width */}
      <img
        src="/novaim.webp"
        alt="Agendei Fácil"
        className="sm:hidden w-full h-auto block"
      />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="text-center mb-8 sm:mb-10">
          <img
            src="/clientesk.png"
            alt="Clientes"
            className="w-full max-w-[420px] mx-auto mb-5 rounded-2xl border border-white/10 shadow-xl"
            loading="lazy"
          />
          {/* Vídeo (mesmo da landing) — logo abaixo do clientesk, só mobile */}
          <div className="sm:hidden mt-6 mb-8">
            <h2 className="text-2xl font-bold text-white leading-snug">
              Veja o sistema <span className="text-blue-400">por dentro</span>
            </h2>
            <p className="text-gray-400 text-sm mt-2 mb-5">Um tour rápido de como tudo funciona.</p>
            <div className="flex justify-center px-2">
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
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">PLANOS</div>
          {referralCupom && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100">
              <span>Cupom de indicação:</span>
              <span className="font-black tracking-wider text-white">{referralCupom}</span>
              <span className="text-emerald-200/90">— plano Diamante com desconto</span>
            </div>
          )}
        </div>

        {/* Mensagem curta (título "NÃO É PARCELAMENTO" removido a pedido) */}
        <div className="mb-10">
          <div className="text-center">
            <div className="text-white/80 leading-relaxed">
              Zero burocracia para cancelar.
              <br />
              Sistema rápido, intuitivo e sem chatice.
              <br />
              Só no Agendei Fácil.
            </div>
          </div>
        </div>

        {/* Imagem pizza logo abaixo do "Zero burocracia..." */}
        <div className="max-w-2xl mx-auto mb-8">
          <img
            src="/pizza.png"
            alt="Agendei Fácil"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>

        <div className="text-center mb-6 text-lg sm:text-xl font-semibold text-white/90">
          Escolha o plano ideal para o seu estabelecimento.
        </div>
        <PlanosCards whatsappNumber="5548991484275" hidePrata referralCupom={referralCupom || null} />

        {/* ✅ Botão abaixo do plano Diamante */}
        <div className="max-w-2xl mx-auto mt-8">
          <a
            href={waLink('Tenho dúvidas sobre os planos')}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-5 py-4 text-center transition-colors"
          >
            Voltar para o atendimento <span className="underline">(clique aqui)</span>
          </a>
        </div>

        {/* ✅ Carrossel de feedbacks (igual da página inicial) */}
        <div className="mt-10">
          <div className="text-center mb-4">
            <div className="text-xl sm:text-2xl font-extrabold">Feedbacks reais</div>
            <div className="text-white/70 text-sm">Veja algumas demonstrações e resultados de clientes.</div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative mb-4">
              <div className="relative overflow-hidden rounded-lg border border-white/10">
                <img
                  src={carouselImages[currentImageIndex]}
                  alt={`Slide ${currentImageIndex + 1}`}
                  className="w-full h-auto rounded-lg transition-opacity duration-300"
                />

                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-all"
                  aria-label="Anterior"
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-all"
                  aria-label="Próximo"
                >
                  →
                </button>
              </div>

              <div className="flex justify-center mt-3 space-x-2">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentImageIndex ? 'bg-blue-500' : 'bg-gray-700'
                    }`}
                    aria-label={`Ir para slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ (mesmo da página inicial) ── */}
      <section id="faq" className="py-16 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
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

          {/* Link para a página oficial do sistema */}
          <div className="text-center mt-12">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-semibold text-base sm:text-lg transition-colors"
            >
              Ir para a página oficial do sistema
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ✅ Popups de prova social (somente nesta página) */}
      <div
        className={`fixed left-3 right-3 sm:left-auto sm:right-6 top-4 sm:top-6 z-[70] pointer-events-none transition-all duration-300 ${socialProofVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
      >
        {socialProof && (
          <div className="pointer-events-auto max-w-md sm:w-[360px] mx-auto sm:mx-0">
            <div className="rounded-2xl bg-black/90 border border-white/10 shadow-2xl backdrop-blur px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white leading-tight truncate">
                    {socialProof.name} assinou plano {planLabel(socialProof.plan)}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${planBadgeClasses(
                        socialProof.plan
                      )}`}
                    >
                      {socialProof.plan.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-white/70">agora mesmo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

