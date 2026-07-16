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
  const [socialProof, setSocialProof] = useState<{ name: string; plan: 'prata' | 'diamante'; business: string } | null>(
    null
  );
  const [socialProofVisible, setSocialProofVisible] = useState(false);
  const socialProofStartedRef = useRef(false);

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
      'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Fernanda', 'Rafael', 'Camila',
      'Guilherme', 'Juliana', 'Bruno', 'Beatriz', 'Matheus', 'Larissa', 'Felipe',
      'Mariana', 'Diego', 'Letícia', 'Thiago', 'Carolina', 'André', 'Vanessa',
      'Gabriel', 'Amanda', 'Rodrigo', 'Patrícia', 'Eduardo', 'Aline', 'Marcelo',
      'Renata', 'Gustavo', 'Tatiane', 'Leandro', 'Priscila', 'Fábio', 'Daniela',
      'Vitor', 'Simone', 'Alexandre', 'Kelly', 'Márcio', 'Cristiane', 'Jonathan',
      'Elaine', 'Wesley', 'Adriana', 'Caio', 'Bianca'
    ];
    // Barbearia e salão aparecem mais (público principal)
    const businesses = [
      'barbearia', 'salão de beleza', 'barbearia', 'lava-car',
      'salão de beleza', 'clínica odonto', 'barbearia', 'clínica de estética'
    ];
    // Diamante aparece um pouco mais (é o plano mais escolhido)
    const plans: Array<'prata' | 'diamante'> = ['prata', 'diamante', 'diamante'];

    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = <T,>(arr: T[]) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    // Fila embaralhada: cada nome aparece UMA única vez até a fila esgotar (48 nomes ≈ 8min).
    // Só re-embaralha quando acaba — nada de "Vanessa assinou" duas vezes seguidas.
    const buildQueue = () =>
      shuffle(names).map((name) => ({ name, plan: pick(plans), business: pick(businesses) }));
    let queue = buildQueue();
    let queueIndex = 0;
    const nextProof = () => {
      if (queueIndex >= queue.length) {
        queue = buildQueue();
        queueIndex = 0;
      }
      return queue[queueIndex++];
    };

    let timeoutId: number | undefined;

    const cycle = () => {
      timeoutId = window.setTimeout(() => {
        setSocialProof(nextProof());
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

  const planLabel = (p: 'prata' | 'diamante') => {
    if (p === 'prata') return 'prata';
    return 'diamante';
  };

  const planBadgeClasses = (p: 'prata' | 'diamante') => {
    if (p === 'prata') return 'bg-slate-300 text-slate-900';
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
          {/* Vídeo (formato reels) — acima do título PLANOS */}
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              VEJA O SISTEMA <span className="text-pink-500">POR DENTRO</span> 👀
            </h2>
            <p className="text-white/60 text-sm mt-1 mb-5">Um tour rápido de como tudo funciona 👇</p>
            <div className="flex justify-center px-2">
              <div className="w-full max-w-[300px]">
                <div
                  className="relative rounded-2xl overflow-hidden border-2 border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.35)] bg-black"
                  style={{ aspectRatio: '9/16' }}
                >
                  <iframe
                    src="https://www.youtube.com/embed/DibbRkvtbgI?rel=0"
                    title="Veja o sistema por dentro"
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
            💬 Tenho dúvidas — conversar com a equipe comercial
          </a>
        </div>

      </div>

      {/* ── FAQ (mesmo da página inicial) ── */}
      <section id="faq" className="py-16 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Imagem acima do FAQ (mesma usada no quiz — repetida de propósito) */}
          <div className="mb-8 flex justify-center">
            <img
              src="/A233.webp"
              alt="Sistema de agendamentos mais completo do Brasil"
              className="w-full max-w-lg h-auto rounded-2xl"
            />
          </div>
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
                  <div className="text-sm font-extrabold text-white leading-tight">
                    {socialProof.name} assinou o plano {planLabel(socialProof.plan)} para sua {socialProof.business}
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

