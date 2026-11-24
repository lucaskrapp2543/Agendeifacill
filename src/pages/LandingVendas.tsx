/**
 * PÁGINA INICIAL (rota "/") — página de vendas do Agendei Fácil.
 *
 * Visual no estilo da página /adeuspobreza do Lucas: fundo preto esverdeado,
 * texto creme, dourado e verde; Space Grotesk (títulos), Inter (texto) e
 * Playfair Display itálica numa palavra dourada de cada título.
 * Pensada PRIMEIRO para celular (99% de quem compra vem do celular).
 *
 * Regras desta página:
 * - Só visual e texto. Não chama banco, pagamento nem o WhatsApp do sistema.
 * - Os botões de compra usam o MESMO link de cadastro de antes (buildCadastroAgLink).
 * - Preços iguais aos do PlanosCards (precoDiamante / precoPrata): se mudar lá, mudar aqui.
 * - O estilo fica dentro deste arquivo (tag <style>) e só existe enquanto esta
 *   página está aberta: não muda nenhuma outra tela do sistema.
 * - Tudo que está escrito aqui foi conferido no código em 23/11/2026
 *   (opções do lembrete, textos das mensagens, o que vem em cada plano).
 *   Números de uso (+300 mil / 25 a 30 mil por mês) foram informados pelo Lucas.
 * - Fotos de barbearia: Unsplash (licença gratuita). Depoimentos: prints reais que
 *   já estavam no site/quiz, recortados sem dados de clientes das barbearias.
 */
import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Headphones,
  Loader2,
  Lock,
  LogIn,
  Maximize2,
  MessageCircle,
  Mic,
  PackageCheck,
  Pause,
  Play,
  Plus,
  QrCode,
  Scissors,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildCadastroAgLink } from '../lib/partnerReferralCode';
import { getCurrentVersion } from '../utils/versionManager';

// Número e mensagem pedidos pelo Lucas em 23/11/2026: (48) 99126-5320.
const WHATSAPP_VENDAS = '5548991265320';
const WHATSAPP_MSG = 'Quero saber mais sobre o Agendei Fácil, vim pelo site';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(WHATSAPP_MSG)}`;

// Mesmos valores do PlanosCards (precoDiamante = 67.9 / precoPrata = 37.9).
const PRECO_DIAMANTE = '67,90';
const PRECO_PRATA = '37,90';

/**
 * VÍDEO DO TOPO — reels do Lucas ("Você é barbeiro?" → sistema completo), em pé.
 * Versão leve (720p) da edição nova de 24/11/2026 de
 * modelos-de-video/.../reels-agendeifacil-barbeiro-ouro.mp4 (156 MB no original), sem corte:
 * o próprio Lucas já tirou a enrolação do começo na edição.
 * Para trocar: gerar um arquivo com NOME NOVO em public/lp/ (evita celular mostrar o vídeo antigo
 * guardado) e mudar `arquivo` e `capa` aqui.
 * Se `arquivo` ficar vazio, o topo volta a mostrar o celular com as mensagens e a página não trava.
 */
const VIDEO_TOPO = { arquivo: '/lp/video-agendei-v2.mp4', capa: '/lp/video-agendei-v2-capa.webp' };
const MOSTRAR_VIDEO_TOPO = Boolean(VIDEO_TOPO.arquivo);

/**
 * TRAVA DA PÁGINA (pedido do Lucas): o resto do site só aparece depois de 1 minuto de vídeo
 * assistido de verdade (pular para frente não conta). Quem já liberou uma vez não precisa
 * assistir de novo (fica salvo no navegador). Links antigos que apontam para uma parte da
 * página (#oferta, #pricing, #faq...) abrem já liberados. O "Entrar" e o WhatsApp ficam sempre visíveis.
 */
const LIBERAR_APOS_SEGUNDOS = 60;
const CHAVE_LIBERADO = 'afv-pagina-liberada';
const ATALHOS_LIBERADOS = [
  '#oferta',
  '#pricing',
  '#faq',
  '#features',
  '#como-funciona',
  '#depoimentos',
  '#testimonials',
  '#contact',
];
// Se o vídeo ficar só carregando (internet lenta) por este tempo, aparece o link "ver a página sem o vídeo".
const SEGUNDOS_INTERNET_LENTA = 15;

// Quanto da trava a pessoa já assistiu e em que ponto do vídeo parou (para continuar se recarregar).
const CHAVE_PROGRESSO = 'afv-video-progresso';

function lerProgressoVideo(): { assistido: number; posicao: number } {
  try {
    const bruto = window.localStorage.getItem(CHAVE_PROGRESSO);
    if (!bruto) return { assistido: 0, posicao: 0 };
    const dados = JSON.parse(bruto) as { s?: unknown; p?: unknown };
    return {
      assistido: Math.min(LIBERAR_APOS_SEGUNDOS, Math.max(0, Number(dados.s) || 0)),
      posicao: Math.max(0, Number(dados.p) || 0),
    };
  } catch {
    return { assistido: 0, posicao: 0 };
  }
}

function salvarProgressoVideo(assistido: number, posicao: number) {
  try {
    window.localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify({ s: Math.round(assistido), p: Math.round(posicao) }));
  } catch {
    // sem armazenamento: só não continua de onde parou
  }
}

function paginaJaLiberada(): boolean {
  if (!MOSTRAR_VIDEO_TOPO || typeof window === 'undefined') return true;
  try {
    // agendeifacil.com/?travar → trava de novo neste navegador (para o Lucas testar/mostrar).
    if (new URLSearchParams(window.location.search).has('travar')) {
      window.localStorage.removeItem(CHAVE_LIBERADO);
      window.localStorage.removeItem(CHAVE_PROGRESSO);
      // Tira o ?travar do endereço: recarregar depois não trava de novo nem zera o vídeo.
      // (mantém o history.state para não atrapalhar o "voltar" do navegador)
      const url = new URL(window.location.href);
      url.searchParams.delete('travar');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      return false;
    }
  } catch {
    // sem armazenamento: segue a regra normal
  }
  if (ATALHOS_LIBERADOS.includes(window.location.hash)) return true;
  try {
    return window.localStorage.getItem(CHAVE_LIBERADO) === '1';
  } catch {
    return false;
  }
}

const tempoMS = (segundos: number) => {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const VIDEO_DEPOIMENTO = '1qbZbbkuPEE'; // vertical (mesmo do /planos)

const FONTES_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700;1,800&family=Space+Grotesk:wght@500;600;700&display=swap';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Meu cliente precisa baixar aplicativo?',
    a: 'Não. Ele agenda pelo seu link, direto no navegador do celular ou do computador.',
  },
  {
    q: 'O cliente precisa criar conta para agendar?',
    a: 'Não. Basta informar nome e telefone. O agendamento é feito em poucos toques, sem cadastro.',
  },
  {
    q: 'De qual número sai o lembrete?',
    a: 'Do WhatsApp da sua barbearia. Você conecta o seu número pelo QR Code dentro do sistema. Isso vem no Plano Diamante.',
  },
  {
    q: 'Posso escolher a hora do lembrete?',
    a: 'Pode. Você escolhe se o lembrete sai 10 minutos, 30 minutos, 1 hora, 3 horas, 5 horas ou 12 horas antes do horário.',
  },
  {
    q: 'O pagamento online é obrigatório?',
    a: 'Não. É você quem decide: o cliente pode pagar antes, no PIX ou no cartão, ou pagar no local.',
  },
  {
    q: 'Tem fidelidade? Posso cancelar?',
    a: 'Não tem fidelidade nem multa. É mensalidade: você paga o mês que usar e cancela quando quiser.',
  },
  {
    q: 'Funciona para barbearia com vários barbeiros?',
    a: 'Sim. No Plano Diamante os barbeiros são ilimitados, cada um com a sua agenda.',
  },
  {
    q: 'Como eu pago a assinatura?',
    a: 'No PIX ou no cartão, pelo Mercado Pago. Sua conta é criada assim que o pagamento é aprovado.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim. Funciona no celular, no tablet e no computador.',
  },
  {
    q: 'Funciona para salão também?',
    a: 'Sim. O foco é barbearia, mas funciona para salão, estética, nail design e outros negócios de beleza.',
  },
];

const TUDO_INCLUSO: { titulo: string; itens: ReactNode[] }[] = [
  {
    titulo: 'Para acabar com a falta',
    itens: [
      <>
        <b>Link de agendamento</b> 24 horas, sem app e sem cadastro
      </>,
      <>
        <b>Confirmação no WhatsApp</b> na hora que o cliente marca
      </>,
      <>
        <b>Lembrete automático ilimitado</b>, de 10 minutos a 12 horas antes
      </>,
      <>
        Mensagens saindo do <b>WhatsApp da sua barbearia</b>
      </>,
      <>
        <b>Pagamento antecipado</b> no PIX ou no cartão, se você quiser
      </>,
    ],
  },
  {
    titulo: 'Para organizar a barbearia',
    itens: [
      <>
        <b>Barbeiros, serviços e agendamentos</b> ilimitados
      </>,
      <>
        <b>Financeiro</b> e comissão de cada barbeiro
      </>,
      <>
        <b>Clube de assinantes</b> com cobrança recorrente
      </>,
      <>
        <b>Estoque</b>, ranking de clientes e clientes sumidos
      </>,
      <>
        <b>Fila de espera</b> e avaliações
      </>,
    ],
  },
  {
    titulo: 'E ainda',
    itens: [
      <>
        <b>Duas páginas de agendamento</b> só suas
      </>,
      <>
        <b>AFCoins</b>: prêmio para o seu cliente, pago pelo Agendei Fácil
      </>,
      <>
        <b>Suporte todo dia</b>, com prioridade
      </>,
    ],
  },
];

/** Prints reais de mensagens de clientes (mesmos do site e do quiz). */
const PROVAS: { img: string; w: number; h: number; frase: string; fonte: string; alt: string }[] = [
  {
    img: '/lp/depoimento-renovando.webp',
    w: 760,
    h: 447,
    frase: 'Não é à toa que tô renovando meu segundo ano já.',
    fonte: 'Barbeiro cliente · mensagem real',
    alt: 'Mensagem de um barbeiro: realmente vocês são o sistema de agendamentos mais completo, não é à toa que estou renovando meu segundo ano. Olha como está a agenda hoje, socada.',
  },
  {
    img: '/lp/depoimento-brabo.webp',
    w: 700,
    h: 744,
    frase: 'Melhor aquisição pra Brabo Barber.',
    fonte: 'Brabo Barbearia · WhatsApp',
    alt: 'Conversa no WhatsApp com a Brabo Barbearia: parabéns pela agilidade, o suporte é brabo demais, melhor aquisição pra Brabo Barber.',
  },
  {
    img: '/lp/depoimento-suporte.webp',
    w: 758,
    h: 666,
    frase: 'O suporte de vocês é surreal de bom.',
    fonte: 'Barbeiro cliente · mensagem real',
    alt: 'Mensagem de um barbeiro elogiando o suporte, que tira as dúvidas em segundos, e dizendo que é muito bom ouvir a notificação de que alguém agendou.',
  },
  {
    img: '/lp/depoimento-costa.webp',
    w: 680,
    h: 444,
    frase: 'Ele chegou aqui rendendo muitos elogios ao app.',
    fonte: 'Costa Barbearia e Tatuagem · WhatsApp',
    alt: 'Mensagem da Costa Barbearia e Tatuagem dando parabéns: um cliente chegou rendendo muitos elogios ao app.',
  },
];

const brl = (valor: number) =>
  valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

/** Frases que se escrevem sozinhas embaixo do título (pedido do Lucas: menos texto no topo). */
const FRASES_TOPO = [
  'Agenda online 24h por dia',
  'Lembrete automático no WhatsApp',
  'Controle financeiro completo',
  'Clube de assinantes',
  'Controle de estoque',
  'Comissão de cada barbeiro',
];

/* ───────────────────────── peças da página ───────────────────────── */

/** Linha que "digita" uma frase, apaga e digita a próxima (sempre, mesmo com "menos animações"
    ligado no aparelho — pedido do Lucas). Leitores de tela recebem a lista inteira. */
function Digitando({ frases }: { frases: string[] }) {
  const [indice, setIndice] = useState(0);
  const [letras, setLetras] = useState(0);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    const frase = frases[indice];
    let espera: number;
    if (!apagando && letras < frase.length) espera = window.setTimeout(() => setLetras(letras + 1), 55);
    else if (!apagando) espera = window.setTimeout(() => setApagando(true), 1700);
    else if (letras > 0) espera = window.setTimeout(() => setLetras(letras - 1), 26);
    else
      espera = window.setTimeout(() => {
        setApagando(false);
        setIndice((indice + 1) % frases.length);
      }, 280);
    return () => window.clearTimeout(espera);
  }, [frases, indice, letras, apagando]);

  const texto = frases[indice].slice(0, letras);
  return (
    <p className="afv-digita afv-rise afv-d2">
      <span className="afv-sr">{frases.join(', ')}.</span>
      <span aria-hidden="true" className="afv-digita-txt">
        <Check size={20} strokeWidth={3} className="afv-digita-check" />
        {texto}
        <span className="afv-cursor" />
      </span>
    </p>
  );
}

function Ouro({ children }: { children: ReactNode }) {
  return <span className="afv-serif afv-gold">{children}</span>;
}

/** Marca do Agendei Fácil redesenhada para esta página: selo "AF" dourado com as argolas
    de calendário (como no logo original) + nome. O logo preto não combinava com o fundo escuro. */
function Marca({ id }: { id: string }) {
  return (
    <span className="afv-brand">
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFE59A" />
            <stop offset=".55" stopColor="#F4C247" />
            <stop offset="1" stopColor="#C98C16" />
          </linearGradient>
        </defs>
        <rect x="2" y="6" width="36" height="32" rx="9" fill={`url(#${id})`} />
        <rect x="10.5" y="2" width="3.4" height="8.5" rx="1.7" fill="#F7F3E8" />
        <rect x="26.1" y="2" width="3.4" height="8.5" rx="1.7" fill="#F7F3E8" />
        <text
          x="20"
          y="30.5"
          textAnchor="middle"
          fontFamily="'Space Grotesk', Inter, sans-serif"
          fontWeight={700}
          fontSize={16}
          letterSpacing={-0.6}
          fill="#1A1200"
        >
          AF
        </text>
      </svg>
      <span className="afv-brand-name">
        Agendei <b>Fácil</b>
      </span>
    </span>
  );
}

/** Botão dourado de duas linhas (igual ao da /adeuspobreza). */
function BotaoOuro({
  principal,
  linha,
  href,
  to,
  onClick,
}: {
  principal: string;
  linha: string;
  href?: string;
  to?: string;
  onClick?: (e: { preventDefault: () => void }) => void;
}) {
  const conteudo = (
    <>
      <span className="afv-cta-main">{principal}</span>
      <span className="afv-cta-sub">{linha}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="afv-cta">
        {conteudo}
      </Link>
    );
  }
  return (
    <a href={href || '#oferta'} onClick={onClick} className="afv-cta">
      {conteudo}
    </a>
  );
}

/** Celular de exemplo com as DUAS mensagens reais que o sistema manda (textos padrão do código). */
function CelularComLembrete({ noTopo = false }: { noTopo?: boolean }) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  return (
    <div
      className={`afv-phone-wrap${noTopo ? ' afv-rise afv-d3' : ''}`}
      role="img"
      aria-label="Exemplo das mensagens automáticas que o cliente recebe no WhatsApp: a confirmação quando marca e o lembrete antes do horário"
    >
      <div className="afv-badge afv-badge-a" aria-hidden="true">
        <small>Na hora que marca</small>
        <strong>Confirmação</strong>
        <span>chega no WhatsApp dele</span>
      </div>

      <div className="afv-phone" aria-hidden="true">
        <div className="afv-screen">
          <div className="afv-notch" />
          <div className="afv-chat-top">
            <div className="afv-chat-avatar">
              <Scissors size={18} />
            </div>
            <div>
              <div className="afv-chat-name">Sua Barbearia</div>
              <div className="afv-chat-sub">WhatsApp da barbearia</div>
            </div>
          </div>

          <div className="afv-chat-body">
            <span className="afv-chat-day">HOJE</span>

            <div className="afv-msg afv-msg-1">
              <span className="afv-msg-tag">
                <Check size={11} strokeWidth={3} /> Confirmação
              </span>
              <p>
                Opa, Carlos! 👋
                <br />
                Obrigado por agendar na Sua Barbearia. Ficamos muito felizes! 🙏
              </p>
              <p>
                📅 Data: {hoje}
                <br />⏰ Horário: 15:00
                <br />💈 Profissional: Rafael
              </p>
              <p>Qualquer dúvida, estamos por aqui no WhatsApp 💬</p>
              <span className="afv-msg-time">09:12</span>
            </div>

            <div className="afv-msg afv-msg-2">
              <span className="afv-msg-tag">
                <Check size={11} strokeWidth={3} /> Lembrete automático
              </span>
              <p>
                Olá, Carlos! 👋✨
                <br />
                Passando para lembrar seu horário na Sua Barbearia.
                <br />⏰ Falta 1 hora para seu atendimento de hoje às 15:00.
                <br />📅 Data: {hoje}
                <br />💈 Profissional: Rafael
              </p>
              <p>Te aguardamos! 🤝</p>
              <span className="afv-msg-time">14:00</span>
            </div>
          </div>

          <div className="afv-chat-input">
            <div className="afv-chat-field">Mensagem</div>
            <div className="afv-chat-mic">
              <Mic size={16} />
            </div>
          </div>
        </div>
      </div>

      <div className="afv-badge afv-badge-b" aria-hidden="true">
        <small>Antes do horário</small>
        <strong>Lembrete</strong>
        <span>sai sozinho, você escolhe quando</span>
      </div>
    </div>
  );
}

/** Vídeo do YouTube que só carrega quando a pessoa toca no play (a página abre mais rápido). */
function VideoLeve({
  id,
  vertical,
  titulo,
  legenda,
  className = '',
  iniciar = false,
  aoTocar,
}: {
  id: string;
  vertical: boolean;
  titulo: string;
  legenda?: string;
  className?: string;
  /** Quando vira true, o vídeo começa (ex.: tocar na etiqueta em cima do vídeo). */
  iniciar?: boolean;
  /** Avisa quem está em volta que o vídeo começou. */
  aoTocar?: () => void;
}) {
  const [tocando, setTocando] = useState(false);
  useEffect(() => {
    if (iniciar) setTocando(true);
  }, [iniciar]);
  const reserva = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const [capa, setCapa] = useState(vertical ? reserva : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  return (
    <div className={`afv-video ${vertical ? 'afv-video-v' : 'afv-video-h'} ${className}`}>
      {tocando ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1`}
          title={titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="afv-play"
          onClick={() => {
            setTocando(true);
            aoTocar?.();
          }}
          aria-label={`Assistir: ${titulo}`}
        >
          <img
            src={capa}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              // Quando a capa grande não existe, o YouTube devolve uma imagem cinza pequena.
              if (capa !== reserva && e.currentTarget.naturalWidth <= 120) setCapa(reserva);
            }}
            onError={() => {
              if (capa !== reserva) setCapa(reserva);
            }}
          />
          <span className="afv-play-btn">
            <Play size={30} fill="currentColor" />
          </span>
          {legenda && <span className="afv-play-cap">{legenda}</span>}
        </button>
      )}
    </div>
  );
}

/** Vídeo do topo (arquivo do próprio site, em pé) com a etiqueta-botão em cima e a contagem embaixo.
    Conta só o tempo assistido de verdade (pular para frente não conta). Com 1 minuto, libera a página. */
function VideoTopo({
  arquivo,
  capa,
  liberado,
  aoLiberar,
  aoIrParaBaixo,
}: {
  arquivo: string;
  capa: string;
  liberado: boolean;
  aoLiberar: () => void;
  aoIrParaBaixo: () => void;
}) {
  // Progresso salvo no navegador: se a pessoa recarregar ou sair no meio, continua de onde parou
  // (vídeo e contagem) em vez de começar do zero.
  const [salvo] = useState(lerProgressoVideo);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ultimoTempo = useRef(salvo.posicao);
  const retomarEm = useRef(salvo.posicao);
  // Começa igual ao salvo: assim abrir a página não regrava o progresso com a posição 0.
  const ultimoSalvo = useRef(salvo.assistido);
  const jaLiberou = useRef(liberado);
  const [comecou, setComecou] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [assistido, setAssistido] = useState(liberado ? 0 : salvo.assistido);
  const [liberouAgora, setLiberouAgora] = useState(false);

  useEffect(() => {
    if (liberado || jaLiberou.current) return;
    if (Math.abs(assistido - ultimoSalvo.current) < 2) return;
    ultimoSalvo.current = assistido;
    // `||` de propósito: com o vídeo ainda não carregado o tempo é 0, aí guarda o ponto para retomar.
    salvarProgressoVideo(assistido, videoRef.current?.currentTime || retomarEm.current);
  }, [assistido, liberado]);

  // Internet lenta: depois do play, se o vídeo ficar só carregando, mostra "Carregando…" e,
  // somando SEGUNDOS_INTERNET_LENTA de espera (de uma vez ou aos pedaços), oferece ver a página
  // sem o vídeo. Assim ninguém fica preso sem ver o preço por causa da internet.
  const [carregando, setCarregando] = useState(false);
  const [lento, setLento] = useState(false);
  const esperaSomada = useRef(0);
  useEffect(() => {
    if (!carregando || lento || jaLiberou.current) return;
    const inicio = Date.now();
    const restante = Math.max(0, SEGUNDOS_INTERNET_LENTA * 1000 - esperaSomada.current);
    const espera = window.setTimeout(() => setLento(true), restante);
    return () => {
      window.clearTimeout(espera);
      esperaSomada.current += Date.now() - inicio;
    };
  }, [carregando, lento]);

  const falta = Math.max(0, LIBERAR_APOS_SEGUNDOS - assistido);
  const progresso = Math.min(100, (assistido / LIBERAR_APOS_SEGUNDOS) * 100);

  const liberar = () => {
    if (jaLiberou.current) return;
    jaLiberou.current = true;
    setLiberouAgora(true);
    aoLiberar();
  };

  useEffect(() => {
    if (assistido < LIBERAR_APOS_SEGUNDOS || jaLiberou.current) return;
    jaLiberou.current = true;
    setLiberouAgora(true);
    aoLiberar();
  }, [assistido, aoLiberar]);

  const tocar = () => {
    const v = videoRef.current;
    if (!v) return;
    setComecou(true);
    const p = v.play();
    if (p && typeof p.catch === 'function')
      p.catch(() => {
        setTocando(false);
        setCarregando(false);
      });
  };
  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) tocar();
    else v.pause();
  };
  const [mudo, setMudo] = useState(false);
  const alternarSom = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMudo(v.muted);
  };
  // Ponto mais longe que a pessoa chegou assistindo normalmente: não deixa pular para frente dele.
  const maisLonge = useRef(salvo.posicao);

  return (
    <div className="afv-video-box afv-video-v" id="afv-video">
      {!comecou && (
        <button type="button" className="afv-video-tag" onClick={tocar} aria-label="Assistir o vídeo e ver o sistema funcionando">
          <span className="afv-video-tag-ico" aria-hidden="true">
            <Play size={13} fill="currentColor" />
          </span>
          <span className="afv-video-tag-txt">
            <small>Assista o vídeo</small>
            Veja o sistema funcionando
          </span>
        </button>
      )}

      <div className="afv-video afv-video-v">
        {/* Sem a barra do player (pedido do Lucas): não mostra o tempo e não deixa adiantar.
            Só dá para pausar/continuar (tocando no vídeo ou no botão) e ligar/desligar o som. */}
        <video
          ref={videoRef}
          src={arquivo}
          poster={capa}
          playsInline
          preload="none"
          disablePictureInPicture
          disableRemotePlayback
          onClick={alternar}
          onContextMenu={(e) => e.preventDefault()}
          onPlay={() => {
            setComecou(true);
            setTocando(true);
          }}
          // Parou para carregar (internet lenta) / voltou a andar.
          onWaiting={() => setCarregando(true)}
          onPlaying={() => setCarregando(false)}
          onLoadedMetadata={(e) => {
            // Voltou depois de sair/recarregar no meio: continua do ponto onde parou.
            if (retomarEm.current > 0 && retomarEm.current < e.currentTarget.duration - 1) {
              e.currentTarget.currentTime = retomarEm.current;
            }
            retomarEm.current = 0;
          }}
          onPause={() => {
            setTocando(false);
            setCarregando(false);
          }}
          onEnded={() => {
            setTocando(false);
            setCarregando(false);
          }}
          onSeeking={(e) => {
            const v = e.currentTarget;
            // Tentou pular para frente (por qualquer caminho)? Volta para onde estava.
            if (v.currentTime > maisLonge.current + 0.75) {
              v.currentTime = maisLonge.current;
              return;
            }
            ultimoTempo.current = v.currentTime;
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            const passo = t - ultimoTempo.current;
            ultimoTempo.current = t;
            // Só soma o tempo que andou assistindo (pulos para frente não contam).
            if (passo > 0 && passo < 1.6) {
              maisLonge.current = Math.max(maisLonge.current, t);
              setAssistido((a) => Math.min(LIBERAR_APOS_SEGUNDOS, a + passo));
              if (carregando) setCarregando(false);
            }
          }}
          // Se o vídeo não carregar (internet ruim, erro), não deixa a pessoa presa: libera a página.
          onError={() => liberar()}
        />
        {!comecou && (
          <button type="button" className="afv-play afv-play-capa" onClick={tocar} aria-label="Assistir o vídeo com som">
            <img src={capa} alt="" decoding="async" />
            <span className="afv-play-btn">
              <Play size={28} fill="currentColor" />
            </span>
          </button>
        )}
        {comecou && !tocando && (
          <button type="button" className="afv-play afv-play-pausado" onClick={tocar} aria-label="Continuar o vídeo">
            <span className="afv-play-btn">
              <Play size={30} fill="currentColor" />
            </span>
            <span className="afv-play-cap">Toque para continuar</span>
          </button>
        )}
        {comecou && (
          <div className="afv-vctl">
            <button type="button" onClick={alternar} aria-label={tocando ? 'Pausar o vídeo' : 'Continuar o vídeo'}>
              {tocando ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button type="button" onClick={alternarSom} aria-label={mudo ? 'Ligar o som' : 'Tirar o som'}>
              {mudo ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        )}
      </div>

      {(!liberado || liberouAgora) && (
        <div className={`afv-trava${liberouAgora ? ' is-ok' : ''}`}>
          {/* Leitor de tela: só avisa quando a página libera (não anuncia a contagem a cada segundo). */}
          <p className="afv-sr" role="status" aria-live="polite">
            {liberouAgora ? 'Pronto! A página foi liberada.' : ''}
          </p>
          {liberouAgora ? (
            <>
              <p className="afv-trava-titulo" aria-hidden="true">
                <Check size={17} strokeWidth={3} /> Pronto! A página foi liberada.
              </p>
              <button type="button" className="afv-trava-link" onClick={aoIrParaBaixo}>
                Ver tudo que vem junto <ArrowDown size={16} />
              </button>
            </>
          ) : (
            <>
              <p className="afv-trava-titulo">
                {comecou && tocando && carregando ? <Loader2 size={15} className="afv-gira" /> : <Lock size={15} />}
                {!comecou
                  ? assistido > 0
                    ? `Dê o play para continuar: faltam ${tempoMS(falta)} para liberar`
                    : 'Dê o play (com som): a página toda libera com 1 minuto de vídeo'
                  : tocando
                    ? carregando
                      ? 'Carregando o vídeo…'
                      : `Liberando a página em ${tempoMS(falta)}`
                    : `Vídeo pausado · faltam ${tempoMS(falta)} para liberar`}
              </p>
              <div className="afv-trava-barra" aria-hidden="true">
                <span style={{ width: `${progresso}%` }} />
              </div>
              {lento && (
                <button type="button" className="afv-trava-lento" onClick={liberar}>
                  Internet lenta? Ver a página sem o vídeo
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** A conta da falta: o barbeiro coloca os PRÓPRIOS números. Nada inventado. */
function ContaDaFalta({ onCta }: { onCta: (e: { preventDefault: () => void }) => void }) {
  const [preco, setPreco] = useState(40);
  const [faltas, setFaltas] = useState(2);
  const porMes = preco * faltas * 4;
  const porAno = porMes * 12;

  return (
    <div className="afv-calc" data-reveal>
      <p className="afv-calc-title">Coloque os seus números</p>

      <div className="afv-calc-row">
        <div className="afv-calc-label">
          Valor do corte
          <small>quanto o cliente paga, em média</small>
        </div>
        <div className="afv-stepper">
          <button
            type="button"
            onClick={() => setPreco((v) => Math.max(10, v - 5))}
            disabled={preco <= 10}
            aria-label="Diminuir valor do corte"
          >
            <span aria-hidden="true">−</span>
          </button>
          <output aria-live="polite">{brl(preco)}</output>
          <button
            type="button"
            onClick={() => setPreco((v) => Math.min(300, v + 5))}
            disabled={preco >= 300}
            aria-label="Aumentar valor do corte"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="afv-calc-row">
        <div className="afv-calc-label">
          Faltas por semana
          <small>cliente que marcou e não apareceu</small>
        </div>
        <div className="afv-stepper">
          <button
            type="button"
            onClick={() => setFaltas((v) => Math.max(1, v - 1))}
            disabled={faltas <= 1}
            aria-label="Diminuir faltas por semana"
          >
            <span aria-hidden="true">−</span>
          </button>
          <output aria-live="polite">{faltas}</output>
          <button
            type="button"
            onClick={() => setFaltas((v) => Math.min(40, v + 1))}
            disabled={faltas >= 40}
            aria-label="Aumentar faltas por semana"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="afv-calc-result">
        <small>Você deixa de ganhar por mês</small>
        <span className="afv-calc-big afv-gold">{brl(porMes)}</span>
        <p className="afv-calc-year">
          São <b>{brl(porAno)}</b> por ano.
        </p>
        <p className="afv-calc-math">
          Conta: {brl(preco)} × {faltas} {faltas === 1 ? 'falta' : 'faltas'} × 4 semanas
        </p>
      </div>

      <div className="afv-center afv-mt-s">
        <a href="#oferta" onClick={onCta} className="afv-ghost">
          Quero o lembrete automático <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}

/** Áudio real do barbeiro parceiro (o mesmo do /planos). */
function AudioDoBarbeiro({ foto }: { foto: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [tempo, setTempo] = useState('0:00');
  const [velocidade, setVelocidade] = useState(1);

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => {
          setTocando(true);
          if (audioRef.current) audioRef.current.playbackRate = velocidade;
        }}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setProgresso(0);
          setTempo('0:00');
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration > 0) {
            setProgresso((a.currentTime / a.duration) * 100);
            const m = Math.floor(a.currentTime / 60);
            const s = Math.floor(a.currentTime % 60);
            setTempo(`${m}:${String(s).padStart(2, '0')}`);
          }
        }}
      >
        {/* ogg (leve) para Android/Chrome; mp3 como reserva para iPhone */}
        <source src="/audioapresentacao.ogg" type="audio/ogg" />
        <source src="/audiobarbeiro.mp3" type="audio/mpeg" />
      </audio>

      <div className="afv-audio">
        <img src={foto} alt="Ronaldo, barbeiro parceiro" className="afv-audio-photo" loading="lazy" />
        <button
          type="button"
          className="afv-audio-btn"
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (a.paused) void a.play();
            else a.pause();
          }}
          aria-label={tocando ? 'Pausar áudio' : 'Ouvir áudio'}
        >
          {tocando ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <div className="afv-audio-main">
          <div className="afv-audio-bar">
            <span style={{ width: `${progresso}%` }} />
          </div>
          <div className="afv-audio-meta">
            <span>Áudio 🎧</span>
            <span className="afv-audio-right">
              <button
                type="button"
                className="afv-rate"
                onClick={() => {
                  const prox = velocidade === 1 ? 1.5 : velocidade === 1.5 ? 2 : 1;
                  setVelocidade(prox);
                  if (audioRef.current) audioRef.current.playbackRate = prox;
                }}
                aria-label="Mudar velocidade do áudio"
              >
                {velocidade}x
              </button>
              <span>{tempo}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/** Setinhas (computador) para passar uma fileira de cartões. */
function SetasFileira({ alvo, nome }: { alvo: RefObject<HTMLDivElement>; nome: string }) {
  const passar = (direcao: 1 | -1) => {
    const row = alvo.current;
    if (!row) return;
    const card = row.querySelector<HTMLElement>('.afv-card');
    const passo = card ? card.offsetWidth + 14 : row.clientWidth * 0.8;
    row.scrollBy({ left: direcao * passo, behavior: 'smooth' });
  };
  return (
    <div className="afv-row-nav">
      <button type="button" onClick={() => passar(-1)} aria-label={`Voltar ${nome}`}>
        <ChevronLeft size={20} />
      </button>
      <button type="button" onClick={() => passar(1)} aria-label={`Ver mais ${nome}`}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

/* ───────────────────────── página ───────────────────────── */

const LandingVendas = () => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const incluidosRef = useRef<HTMLDivElement>(null);
  const provasRef = useRef<HTMLDivElement>(null);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  // Trava: false = só o topo e o vídeo aparecem; vira true com 1 minuto de vídeo assistido.
  const [liberado, setLiberado] = useState<boolean>(paginaJaLiberada);
  const liberarPagina = () => {
    setLiberado(true);
    try {
      window.localStorage.setItem(CHAVE_LIBERADO, '1');
      window.localStorage.removeItem(CHAVE_PROGRESSO);
    } catch {
      // navegador sem armazenamento: libera só nesta visita
    }
  };

  const assetVersion = getCurrentVersion();
  const img = (path: string) => `${path}?v=${assetVersion}`;

  const cadastroDiamante = buildCadastroAgLink({ plan: 'diamante' });
  const cadastroPrata = buildCadastroAgLink({ plan: 'prata' });

  // Fontes dos títulos: carregadas SÓ nesta página (Inter já vem do index.html).
  useEffect(() => {
    const id = 'afv-fontes';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = FONTES_URL;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  // Animação leve ao rolar: cada bloco com data-reveal aparece quando entra na tela.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzir || typeof IntersectionObserver === 'undefined') return;
    const blocos = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    root.setAttribute('data-anim', '1');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-on', '1');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    );
    blocos.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.removeAttribute('data-anim');
    };
  }, []);

  // Tecla Esc fecha o popup e a foto ampliada.
  useEffect(() => {
    if (!showSubscriberModal && !zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSubscriberModal(false);
        setZoom(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSubscriberModal, zoom]);

  const rolarAte = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const irParaOferta = (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    rolarAte('oferta');
  };

  // ✅ LÓGICA DO POPUP "VOCÊ JÁ É ASSINANTE?" — MANTIDA (mesmo comportamento de antes)
  const handleLogin = () => setShowSubscriberModal(true);
  const handleGoToLogin = () => {
    setShowSubscriberModal(false);
    navigate('/login');
  };
  const handleGoToPricing = () => {
    setShowSubscriberModal(false);
    // Com a página ainda travada, leva para o vídeo (é ele que libera o resto).
    rolarAte(liberado ? 'oferta' : 'afv-video');
  };

  const cartoes: {
    etiqueta: string;
    principal?: boolean;
    titulo: string;
    texto: string;
    imagem?: string;
    encaixe?: 'cobrir' | 'caber';
    posicao?: string;
    icone?: ReactNode;
    verde?: boolean;
  }[] = [
    {
      etiqueta: 'Principal',
      principal: true,
      titulo: 'Lembrete automático no WhatsApp',
      texto: 'Sai sozinho antes do horário, sem limite de mensagens. Você escolhe quando: de 10 minutos até 12 horas antes.',
      imagem: img('/lembreteppp3.webp'),
      encaixe: 'cobrir',
      posicao: '50% 86%',
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Seu link de agendamento',
      texto: 'Uma página só da sua barbearia. O cliente escolhe serviço, barbeiro e horário, sem baixar app e sem criar conta.',
      imagem: img('/paginaextrappp3.webp'),
      encaixe: 'caber',
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Confirmação na hora',
      texto: 'Marcou, chegou: o cliente recebe no WhatsApp a confirmação com o dia, o horário e o barbeiro.',
      icone: <CalendarCheck size={38} />,
      verde: true,
    },
    {
      etiqueta: 'Incluso',
      titulo: 'O WhatsApp da sua barbearia',
      texto: 'Você conecta pelo QR Code. As mensagens saem do seu número, com o nome da sua barbearia.',
      icone: <QrCode size={38} />,
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Pagamento antecipado',
      texto: 'Se você quiser, o cliente paga no PIX ou no cartão na hora de marcar. Você recebe antes de atender.',
      imagem: img('/recebaantesppp3.webp'),
      encaixe: 'caber',
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Barbeiros ilimitados',
      texto: 'Cada barbeiro com a sua agenda. Coloque a equipe toda sem pagar a mais por isso.',
      imagem: img('/A233.webp'),
      encaixe: 'caber',
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Financeiro e comissões',
      texto: 'Quanto entrou no mês, quanto cada barbeiro fez e a comissão de cada um, sem planilha.',
      imagem: img('/finan1.png'),
      encaixe: 'caber',
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Clube de assinantes',
      texto: 'Venda plano mensal com cobrança recorrente e veja quantos atendimentos cada assinante já usou.',
      icone: <Crown size={38} />,
    },
    {
      etiqueta: 'Incluso',
      titulo: 'AFCoins para o seu cliente',
      texto: 'O cliente ganha moedas a cada agendamento e troca por benefícios, pagos pelo Agendei Fácil, não por você.',
      imagem: img('/afcoin.png'),
      encaixe: 'caber',
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Clientes sumidos e ranking',
      texto: 'Veja quem parou de vir e quem são seus melhores clientes. Tem fila de espera e avaliações também.',
      icone: <Users size={38} />,
      verde: true,
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Estoque de produtos',
      texto: 'Controle o que você vende na barbearia junto com os atendimentos.',
      icone: <PackageCheck size={38} />,
    },
    {
      etiqueta: 'Incluso',
      titulo: 'Suporte todo dia',
      texto: 'Gente de verdade no WhatsApp para te ajudar a configurar e tirar dúvida, com prioridade.',
      icone: <Headphones size={38} />,
      verde: true,
    },
  ];

  return (
    <div className="afv" ref={rootRef}>
      <style>{CSS}</style>

      {/* ── TOPO ── */}
      <header className="afv-hero">
        {/* Foto de fundo (Unsplash, licença gratuita) */}
        <div className="afv-hero-photo" aria-hidden="true">
          <img src={img('/lp/barbearia-dourada.webp')} alt="" decoding="async" />
        </div>
        <div className="afv-wrap">
          <div className="afv-top">
            <Link
              to="/"
              aria-label="Agendei Fácil — início"
              className="afv-brand-link"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Marca id="afv-marca-topo" />
            </Link>
            <button type="button" onClick={handleLogin} className="afv-enter">
              <LogIn size={15} /> Entrar
            </button>
          </div>

          {/* Três blocos: texto, vídeo e botão. No celular ficam um embaixo do outro
              (texto → vídeo → botão); no computador o vídeo vai para a direita. */}
          <div className={`afv-hero-grid${MOSTRAR_VIDEO_TOPO ? ' tem-video' : ''}`}>
            <div className="afv-hero-copy">
              <span className="afv-seal afv-rise">
                <span className="afv-dot" /> +300 mil agendamentos feitos
              </span>

              <h1 className="afv-h1 afv-rise afv-d1">
                <span className="afv-line">
                  <span className="afv-chamada">Barbeiro,</span>
                </span>{' '}
                <span className="afv-line">
                  sua barbearia <Ouro>inteira</Ouro> no celular.
                </span>
              </h1>

              <Digitando frases={FRASES_TOPO} />
            </div>

            <div className="afv-hero-visual afv-rise afv-d2">
              {MOSTRAR_VIDEO_TOPO ? (
                <VideoTopo
                  arquivo={img(VIDEO_TOPO.arquivo)}
                  capa={img(VIDEO_TOPO.capa)}
                  liberado={liberado}
                  aoLiberar={liberarPagina}
                  aoIrParaBaixo={() => rolarAte('como-funciona')}
                />
              ) : (
                <CelularComLembrete noTopo />
              )}
            </div>

            <div className="afv-hero-cta afv-rise afv-d3">
              {liberado ? (
                <>
                  <BotaoOuro
                    principal="Quero minha barbearia no celular"
                    linha="Veja o que vem junto e o preço de hoje"
                    onClick={irParaOferta}
                  />
                  <ul className="afv-checks">
                    <li>
                      <Check size={16} strokeWidth={3} /> Cliente não baixa app
                    </li>
                    <li>
                      <Check size={16} strokeWidth={3} /> Sem fidelidade
                    </li>
                    <li>
                      <Check size={16} strokeWidth={3} /> Suporte todo dia
                    </li>
                    <li>
                      <Check size={16} strokeWidth={3} /> Barbeiros ilimitados
                    </li>
                  </ul>
                </>
              ) : (
                <p className="afv-trava-aviso">
                  <Lock size={16} /> Assista 1 minuto do vídeo ao lado e a página inteira é liberada.
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── TUDO DAQUI PARA BAIXO SÓ APARECE DEPOIS DE 1 MINUTO DE VÍDEO ── */}
      <div className={`afv-resto${liberado ? '' : ' is-travado'}`} aria-hidden={!liberado}>
      <div className="afv-band">
        <div className="afv-wrap">
          <ul className="afv-chips">
            <li>Agenda online</li>
            <li>Lembrete no WhatsApp</li>
            <li>Financeiro</li>
            <li>Assinantes</li>
            <li>Barbeiros ilimitados</li>
          </ul>
        </div>
      </div>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="afv-section">
        <div className="afv-wrap">
          <div className="afv-head" data-reveal>
            <span className="afv-kicker">Como funciona</span>
            <h2 className="afv-h2">
              O cliente marca sozinho. <span className="afv-nw">O WhatsApp</span> <Ouro>lembra</Ouro> por você.
            </h2>
          </div>

          <div className="afv-how">
            <div className="afv-steps" data-reveal>
              <div className="afv-step">
                <small>1 · O cliente marca</small>
                <span className="afv-step-big">Sozinho</span>
                <p>
                  Pelo seu link, no Instagram, no status ou no WhatsApp. Ele escolhe serviço, barbeiro e horário, sem
                  baixar app e sem criar conta.
                </p>
              </div>
              <div className="afv-arrow" aria-hidden="true">
                <ArrowDown size={20} />
              </div>
              <div className="afv-step">
                <small>2 · Na mesma hora</small>
                <span className="afv-step-big is-green">Confirmação</span>
                <p>Chega no WhatsApp dele a confirmação com o dia, o horário e o barbeiro.</p>
              </div>
              <div className="afv-arrow" aria-hidden="true">
                <ArrowDown size={20} />
              </div>
              <div className="afv-step afv-step-gold">
                <small>3 · Antes do horário</small>
                <span className="afv-step-big afv-gold">Lembrete</span>
                <p>
                  O sistema manda o lembrete sozinho. Você escolhe quando: 10&nbsp;min, 30&nbsp;min, 1&nbsp;h, 3&nbsp;h,
                  5&nbsp;h ou 12&nbsp;h antes.
                </p>
              </div>
            </div>

            <div className="afv-how-img" data-reveal>
              {MOSTRAR_VIDEO_TOPO ? (
                <CelularComLembrete />
              ) : (
                <>
                  <img
                    src={img('/inicioquiz.webp')}
                    alt="Agenda do Agendei Fácil no computador e no celular"
                    loading="lazy"
                    decoding="async"
                    width={1100}
                    height={1032}
                  />
                  <p>E tudo cai na sua agenda, no celular ou no computador.</p>
                </>
              )}
              <div className="afv-note">
                <MessageCircle size={18} />
                <span>
                  As mensagens saem do <b className="afv-hl">WhatsApp da sua barbearia</b>, com o nome da sua barbearia.
                  O cliente sabe na hora quem está falando.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NÚMEROS (informados pelo Lucas) ── */}
      <div className="afv-nums-band">
        <div className="afv-bg-photo" aria-hidden="true">
          <img src={img('/lp/barbearia-interior.webp')} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="afv-wrap">
          <div className="afv-head" data-reveal>
            <span className="afv-kicker">O Agendei Fácil em números</span>
          </div>
          <div className="afv-nums" data-reveal>
            <div className="afv-num">
              <strong className="afv-gold">+300 mil</strong>
              <span>agendamentos feitos pelo Agendei Fácil desde o começo</span>
            </div>
            <div className="afv-num">
              <strong className="afv-gold">25 a 30 mil</strong>
              <span>agendamentos por mês, em média</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TUDO INCLUSO (cartões deslizantes) ── */}
      <section id="features" className="afv-section">
        <div className="afv-wrap">
          <div className="afv-head" data-reveal>
            <span className="afv-kicker">Tudo incluso no Plano Diamante</span>
            <h2 className="afv-h2">
              Não é só agenda. É a barbearia <Ouro>inteira</Ouro> na sua mão.
            </h2>
            <p className="afv-lead">Agenda, WhatsApp, dinheiro e equipe num lugar só. Arrasta para o lado e veja.</p>
            <ul className="afv-pills">
              <li>
                barbeiros <b>ilimitados</b>
              </li>
              <li>
                lembrete <b>ilimitado</b>
              </li>
              <li>
                <b>sem</b> fidelidade
              </li>
              <li>
                suporte <b>todo dia</b>
              </li>
            </ul>
          </div>

          <SetasFileira alvo={incluidosRef} nome="cartões do que vem incluso" />

          <div className="afv-row" ref={incluidosRef} data-reveal>
            {cartoes.map((c) => (
              <article key={c.titulo} className="afv-card">
                <div className="afv-card-art">
                  <span className={`afv-card-tag${c.principal ? ' is-main' : ''}`}>
                    <Check size={11} strokeWidth={3} /> {c.etiqueta}
                  </span>
                  {c.imagem ? (
                    <img
                      src={c.imagem}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={c.encaixe === 'caber' ? 'is-contain' : ''}
                      style={c.posicao ? { objectPosition: c.posicao } : undefined}
                    />
                  ) : (
                    <span className={`afv-art-icon${c.verde ? ' is-green' : ''}`}>{c.icone}</span>
                  )}
                </div>
                <div className="afv-card-body">
                  <h3>{c.titulo}</h3>
                  <p>{c.texto}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="afv-hint">
            Arrasta para o lado e veja tudo que vem junto <ArrowRight size={15} />
          </p>

          <div className="afv-mt">
            <BotaoOuro principal="Quero tudo isso" linha="Ver o preço de hoje" onClick={irParaOferta} />
          </div>
          <div className="afv-center afv-mt-s">
            <button type="button" onClick={handleLogin} className="afv-ghost">
              <LogIn size={15} /> Já sou cliente · Entrar
            </button>
          </div>
        </div>
      </section>

      {/* ── QUEM USA (depoimentos reais, arrasta para o lado) ── */}
      <section id="depoimentos" className="afv-section afv-section-dark">
        <div className="afv-wrap">
          <div className="afv-head" data-reveal>
            <span className="afv-kicker">Quem usa</span>
            <h2 className="afv-h2">
              Não confia em mim? Confia em quem <Ouro>usa</Ouro> todo dia.
            </h2>
            <p className="afv-lead">Arrasta para o lado e veja o que os barbeiros mandam pra gente.</p>
          </div>

          <SetasFileira alvo={provasRef} nome="depoimentos" />

          <div className="afv-row afv-row-provas" ref={provasRef} data-reveal>
            <article className="afv-card afv-prova">
              <button
                type="button"
                className="afv-prova-midia is-escuro"
                onClick={() =>
                  setZoom({
                    src: img('/clientefinanceiro.webp'),
                    alt: 'Print do financeiro do barbeiro do áudio, mostrando o crescimento entre os meses',
                  })
                }
                aria-label="Ampliar o print do financeiro do barbeiro"
              >
                <img
                  src={img('/clientefinanceiro.webp')}
                  alt="Print do financeiro do barbeiro do áudio, mostrando o crescimento entre os meses"
                  loading="lazy"
                  decoding="async"
                  width={1200}
                  height={720}
                />
                <span className="afv-prova-zoom">
                  <Maximize2 size={13} /> Ampliar
                </span>
              </button>
              <div className="afv-prova-corpo">
                <p className="afv-prova-frase">Ele mandou o print do crescimento e um áudio. Escuta:</p>
                <AudioDoBarbeiro foto={img('/fotoronaldo.webp')} />
                <p className="afv-prova-fonte">Ronaldo, barbeiro parceiro · áudio real</p>
              </div>
            </article>

            {PROVAS.map((p) => (
              <article key={p.img} className="afv-card afv-prova">
                <button
                  type="button"
                  className="afv-prova-midia"
                  onClick={() => setZoom({ src: img(p.img), alt: p.alt })}
                  aria-label="Ampliar a mensagem do cliente"
                >
                  <img src={img(p.img)} alt={p.alt} loading="lazy" decoding="async" width={p.w} height={p.h} />
                  <span className="afv-prova-zoom">
                    <Maximize2 size={13} /> Ampliar
                  </span>
                </button>
                <div className="afv-prova-corpo">
                  <p className="afv-prova-frase">“{p.frase}”</p>
                  <p className="afv-prova-fonte">{p.fonte}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="afv-hint">
            Arrasta para o lado e veja mais <ArrowRight size={15} />
          </p>

          <div className="afv-video-depo" data-reveal>
            <p className="afv-panel-title">Olha o que um cliente falou 👇</p>
            <VideoLeve id={VIDEO_DEPOIMENTO} vertical titulo="Depoimento de cliente da barbearia" />
            <p className="afv-small">Depoimento real de quem é atendido numa barbearia que usa o Agendei Fácil.</p>
          </div>
        </div>
      </section>

      {/* ── A CONTA DA FALTA ── */}
      <section className="afv-section">
        <div className="afv-wrap afv-tight">
          <div className="afv-head" data-reveal>
            <span className="afv-kicker">A conta da falta</span>
            <h2 className="afv-h2">
              Cada falta é dinheiro que <Ouro>não volta.</Ouro>
            </h2>
            <p className="afv-lead">
              Sabe aquele cliente que marca, esquece e não aparece? O horário fica parado e não dá tempo de encaixar
              outro. Faça a conta da sua barbearia:
            </p>
          </div>

          <figure className="afv-chair" data-reveal>
            <img
              src={img('/lp/cadeira-vazia.webp')}
              alt="Cadeira de barbeiro vazia, com a capa pendurada no braço"
              loading="lazy"
              decoding="async"
              width={1200}
              height={900}
            />
            <figcaption>
              <small>
                <span className="afv-red-dot" /> No horário marcado
              </small>
              <strong>Cadeira vazia</strong>
              <span>o cliente esqueceu e não veio</span>
            </figcaption>
          </figure>

          <ContaDaFalta onCta={irParaOferta} />

          <p className="afv-calc-after" data-reveal>
            Com o Agendei, o lembrete automático avisa o cliente no WhatsApp antes do horário, sem você mandar mensagem.
          </p>
        </div>
      </section>

      {/* ── PARA QUEM É ── */}
      <section className="afv-section afv-who-section">
        <div className="afv-bg-photo" aria-hidden="true">
          <img src={img('/lp/barbeiro-tesoura.webp')} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="afv-wrap">
          <div className="afv-who" data-reveal>
            <h2>Para quem é</h2>
            <ul className="afv-list">
              <li>
                <Check size={18} strokeWidth={3} /> Barbeiro que vive respondendo “tem horário hoje?” no WhatsApp.
              </li>
              <li>
                <Check size={18} strokeWidth={3} /> Quem perde dinheiro com cliente que marca e não aparece.
              </li>
              <li>
                <Check size={18} strokeWidth={3} /> Quem quer ver quanto entrou e quanto cada barbeiro fez, sem planilha.
              </li>
              <li>
                <Check size={18} strokeWidth={3} /> Barbearia com um barbeiro só ou com equipe.
              </li>
              <li>
                <Check size={18} strokeWidth={3} /> Quem quer coisa simples: o cliente não baixa nada.
              </li>
            </ul>
            <p className="afv-who-end">Se você corta cabelo e tem agenda, é para você.</p>
          </div>
        </div>
      </section>

      {/* ── OFERTA ── (id "pricing" mantido para links antigos que apontam para #pricing) */}
      <div id="pricing">
        <section id="oferta" className="afv-section">
          <div className="afv-wrap">
            <div className="afv-head" data-reveal>
              <span className="afv-kicker">O preço de hoje</span>
              <h2 className="afv-h2">
                Tudo isso por menos de R$&nbsp;2,50 <Ouro>por dia.</Ouro>
              </h2>
            </div>

            <div className="afv-offer" data-reveal>
              <div className="afv-offer-in">
                <span className="afv-offer-seal">Plano Diamante · Tudo incluso</span>
                <h3>Agendei Fácil completo</h3>
                <p className="afv-offer-sub">+ lembrete automático no WhatsApp, sem limite</p>

                <div className="afv-price" aria-label={`R$ ${PRECO_DIAMANTE} por mês`}>
                  <span className="afv-price-cur">R$</span>
                  <span className="afv-price-val afv-gold">{PRECO_DIAMANTE}</span>
                  <span className="afv-price-per">/mês</span>
                </div>
                <p className="afv-offer-lines">
                  Mensalidade, não é parcelamento: você paga o mês que usar.
                  <br />
                  Sem fidelidade · cancele quando quiser
                </p>

                <BotaoOuro
                  to={cadastroDiamante}
                  principal="Quero o Agendei Fácil agora"
                  linha="Sua conta é criada assim que o pagamento é aprovado"
                />
                <p className="afv-secure">
                  <Lock size={14} /> Compra segura pelo Mercado Pago · PIX ou cartão
                </p>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="afv-ghost afv-offer-alt">
                  <MessageCircle size={16} /> Prefere tirar dúvida antes? Fala no WhatsApp
                </a>
              </div>
            </div>

            <div className="afv-all" data-reveal>
              <p className="afv-all-title">Tudo isso é seu hoje</p>
              {TUDO_INCLUSO.map((grupo) => (
                <div key={grupo.titulo} className="afv-all-group">
                  <h4>{grupo.titulo}</h4>
                  <ul>
                    {grupo.itens.map((item, i) => (
                      <li key={i}>
                        <Check size={16} strokeWidth={3} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="afv-prata">
              Só quer a agenda, sem o WhatsApp?{' '}
              <Link to={cadastroPrata}>Conheça o Plano Prata por R$ {PRECO_PRATA}/mês</Link>
            </p>
          </div>
        </section>
      </div>

      {/* ── GARANTIA E COMPRA SEGURA ── */}
      <section className="afv-section afv-section-s">
        <div className="afv-wrap">
          <div className="afv-safe" data-reveal>
            <div className="afv-safe-card">
              <span className="afv-safe-ico">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h3>7 dias de garantia</h3>
                <p>Confiamos tanto no nosso sistema que você tem 7 dias de garantia.</p>
              </div>
            </div>
            <div className="afv-safe-card">
              <span className="afv-safe-ico">
                <Lock size={22} />
              </span>
              <div>
                <h3>Compra segura</h3>
                <p>O pagamento é feito pelo Mercado Pago, no PIX ou no cartão.</p>
              </div>
            </div>
            <div className="afv-safe-card">
              <span className="afv-safe-ico">
                <CalendarCheck size={22} />
              </span>
              <div>
                <h3>Sem fidelidade</h3>
                <p>É mensalidade: você paga o mês que usar e cancela quando quiser.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERGUNTAS FREQUENTES ── */}
      <section id="faq" className="afv-section">
        <div className="afv-wrap afv-tight">
          <div className="afv-head" data-reveal>
            <h2 className="afv-h2">Perguntas frequentes</h2>
          </div>
          <div className="afv-faq" data-reveal>
            {FAQS.map((faq, i) => {
              const aberta = openFaq === i;
              return (
                <div key={faq.q} className={`afv-faq-item${aberta ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="afv-faq-q"
                    onClick={() => setOpenFaq(aberta ? null : i)}
                    aria-expanded={aberta}
                  >
                    <span>{faq.q}</span>
                    <Plus size={18} />
                  </button>
                  {aberta && <p className="afv-faq-a">{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAIXA FINAL ── */}
      <section id="contact" className="afv-final">
        <div className="afv-bg-photo afv-bg-photo-forte afv-bg-photo-direita" aria-hidden="true">
          <img src={img('/lp/barbearia-dourada.webp')} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="afv-wrap afv-tight" data-reveal>
          <h2 className="afv-h2">
            Barbeiro, bora colocar sua barbearia no <Ouro>automático?</Ouro>
          </h2>
          <p className="afv-lead">
            Agenda online, lembrete no WhatsApp, financeiro e assinantes num lugar só. Comece hoje.
          </p>
          <div className="afv-mt">
            <BotaoOuro
              to={cadastroDiamante}
              principal="Quero o Agendei Fácil agora"
              linha={`R$ ${PRECO_DIAMANTE}/mês · PIX ou cartão · sem fidelidade`}
            />
          </div>
          <div className="afv-center afv-mt-s">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="afv-ghost">
              <MessageCircle size={16} /> Falar com a gente no WhatsApp
            </a>
          </div>
        </div>
      </section>
      </div>

      {/* ── RODAPÉ ── (fora da trava: Termos, Privacidade e contato ficam sempre visíveis) */}
      <footer className="afv-foot">
        <div className="afv-wrap">
          <div className="afv-foot-brand">
            <Marca id="afv-marca-rodape" />
          </div>
          <p>Sistema de agendamento para barbearias e salões.</p>
          <nav aria-label="Links do rodapé">
            <button type="button" onClick={handleLogin}>
              Já sou cliente · Entrar
            </button>
            <Link to="/terms">Termos de uso</Link>
            <Link to="/privacy">Privacidade</Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </nav>
          <p>Suporte: (48) 99126-5320 · contato@agendafacil.com</p>
          <p className="afv-foot-copy">&copy; {new Date().getFullYear()} Agendei Fácil. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* ── WHATSAPP FLUTUANTE ── (sem barra fixa de preço: o Lucas não quer o preço aparecendo
          antes de a pessoa ver a página) */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="afv-wa"
        aria-label="Dúvidas? Fale com a gente no WhatsApp"
      >
        <img src={img('/lp/whatsapp.webp')} alt="" width={128} height={128} />
        <span>Dúvidas? Chama aqui</span>
      </a>

      {/* ── POPUP "VOCÊ JÁ É ASSINANTE AGENDEI FÁCIL?" ── */}
      {showSubscriberModal && (
        <div className="afv-modal" onClick={() => setShowSubscriberModal(false)}>
          <div
            className="afv-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="afv-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="afv-modal-x"
              onClick={() => setShowSubscriberModal(false)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
            <div className="afv-modal-emoji" aria-hidden="true">
              🤔
            </div>
            <h3 id="afv-modal-titulo">Você já é assinante Agendei Fácil?</h3>
            <div className="afv-modal-btns">
              <button type="button" onClick={handleGoToLogin} className="afv-btn-gold">
                Sim, já sou assinante
              </button>
              <button type="button" onClick={handleGoToPricing} className="afv-btn-line">
                {/* Com a página travada o botão leva ao vídeo, então o texto não promete o preço. */}
                {liberado ? 'Não, quero ver o preço de hoje' : 'Não, quero ver como funciona'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FOTO AMPLIADA ── */}
      {zoom && (
        <div className="afv-zoom" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Imagem ampliada">
          <button type="button" className="afv-modal-x" onClick={() => setZoom(null)} aria-label="Fechar">
            <X size={18} />
          </button>
          <img src={zoom.src} alt={zoom.alt} />
        </div>
      )}
    </div>
  );
};

export default LandingVendas;

/* ───────────────────────── estilo (só desta página) ─────────────────────────
   Tudo começa com .afv, então nada daqui vaza para outras telas.
   Escrito primeiro para celular; as regras com min-width ajustam tablet e computador. */
const CSS = `
.afv{--bg:#040A07;--card:#0B1711;--card2:#10221A;--line:rgba(255,255,255,.09);--cream:#F7F3E8;--cream2:#D9D4C4;--muted:#A6A291;--gold:#F4C247;--gold-l:#FFE59A;--gold-d:#C98C16;--green:#2BD17E;position:relative;min-height:100vh;background:var(--bg);color:var(--cream);font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.6;overflow-x:hidden;overflow-x:clip;-webkit-font-smoothing:antialiased}
.afv *,.afv *::before,.afv *::after{box-sizing:border-box}
.afv ::selection{background:rgba(244,194,71,.35);color:#fff}
:where(.afv) a{color:inherit;text-decoration:none}
:where(.afv) button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
:where(.afv) img{max-width:100%;height:auto;display:block}
:where(.afv) p{margin:0}
:where(.afv) b{font-weight:700}
.afv-wrap{position:relative;width:100%;max-width:1120px;margin:0 auto;padding:0 16px}
.afv-tight{max-width:780px}
.afv-section{position:relative;padding:68px 0;scroll-margin-top:8px}
.afv-section-s{padding:4px 0 40px}
.afv-section-dark{background:linear-gradient(180deg,#040A07,#06110C 50%,#040A07)}
.afv-center{text-align:center}
.afv-mt{margin-top:28px}
.afv-mt-s{margin-top:16px}
@media (min-width:768px){.afv-section{padding:104px 0}.afv-section-s{padding:0 0 56px}.afv-wrap{padding:0 24px}}

/* títulos */
.afv-h1,.afv-h2{margin:0;font-family:'Space Grotesk',Inter,sans-serif;font-weight:700;color:var(--cream);text-wrap:balance}
.afv-h1{font-size:clamp(40px,10.6vw,76px);line-height:1.02;letter-spacing:-.05em}
.afv-line{display:block}
.afv-nw{white-space:nowrap}
.afv-h2{font-size:clamp(30px,7.6vw,48px);line-height:1.1;letter-spacing:-.035em}
.afv-serif{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:800;letter-spacing:-.01em;padding:0 .1em .08em .02em;margin-right:-.06em}
.afv .afv-gold{background-image:linear-gradient(100deg,#C98C16 0%,#F4C247 20%,#FFE59A 40%,#FFF8DA 50%,#FFE59A 60%,#F4C247 80%,#C98C16 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:afv-shine 8s linear infinite}
@keyframes afv-shine{from{background-position:0% center}to{background-position:-200% center}}
.afv-kicker{display:block;margin:0 0 14px;font-family:'Space Grotesk',Inter,sans-serif;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--green)}
.afv-lead{margin:18px 0 0;font-size:17px;line-height:1.65;color:var(--cream2)}
.afv-head{max-width:700px;margin:0 auto;text-align:center}
.afv-head .afv-lead{max-width:580px;margin-left:auto;margin-right:auto}
.afv .afv-hl{color:var(--cream);font-weight:600}
.afv-hl-green{color:var(--green);font-weight:600}

/* marca */
.afv-brand{display:inline-flex;align-items:center;gap:10px}
.afv-brand svg{flex-shrink:0;filter:drop-shadow(0 6px 14px rgba(244,194,71,.35))}
.afv-brand-name{font-family:'Space Grotesk',Inter,sans-serif;font-size:19px;font-weight:700;line-height:1;letter-spacing:-.03em;color:var(--cream);white-space:nowrap}
.afv .afv-brand-name b{font-weight:700;background:linear-gradient(100deg,#FFE59A,#F4C247 50%,#C98C16);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.afv-brand-link{display:inline-flex;border-radius:12px}
.afv-brand-link:focus-visible{outline:3px solid var(--gold-l);outline-offset:4px}

/* topo */
.afv-top{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0}
.afv-enter{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(4,10,7,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-size:13.5px;font-weight:600;color:var(--cream);transition:background .2s,border-color .2s}
.afv-enter:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.3)}
.afv-hero{position:relative;isolation:isolate;overflow:hidden;padding:0 0 52px}
.afv-hero .afv-wrap{z-index:1}
.afv-hero-photo{position:absolute;left:0;right:0;top:0;height:min(100%,860px);z-index:-1;pointer-events:none;overflow:hidden}
.afv-hero-photo img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:26% 50%;opacity:.72;filter:saturate(.95) contrast(1.05)}
.afv-hero-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,10,7,.42) 0%,rgba(4,10,7,.6) 28%,rgba(4,10,7,.8) 52%,rgba(4,10,7,.94) 76%,#040A07 100%)}
@media (min-width:960px){
 .afv-hero-photo{height:100%}
 .afv-hero-photo img{object-position:50% 45%;opacity:.7}
 .afv-hero-photo::after{background:linear-gradient(90deg,rgba(4,10,7,.94) 0%,rgba(4,10,7,.78) 34%,rgba(4,10,7,.45) 66%,rgba(4,10,7,.55) 100%),linear-gradient(180deg,rgba(4,10,7,.35) 0%,transparent 30%,transparent 70%,#040A07 100%)}
}
.afv-hero::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse 75% 55% at 50% 28%,#000 25%,transparent 75%);mask-image:radial-gradient(ellipse 75% 55% at 50% 28%,#000 25%,transparent 75%)}
.afv-hero::after{content:'';position:absolute;z-index:0;left:50%;top:-220px;width:980px;height:680px;transform:translateX(-50%);pointer-events:none;background:radial-gradient(closest-side,rgba(43,209,126,.14),rgba(43,209,126,0))}
.afv-hero-grid{position:relative;z-index:1;display:grid;align-items:center;padding-top:14px}
.afv-hero-copy{text-align:center}
.afv-hero-visual{margin-top:30px}
.afv-hero-grid.tem-video .afv-hero-visual{margin-top:52px}
.afv-hero-grid:not(.tem-video) .afv-hero-cta{order:2}
.afv-hero-grid:not(.tem-video) .afv-hero-visual{order:3}
.afv-seal{display:inline-flex;align-items:center;gap:9px;margin:0 0 20px;padding:7px 15px;border-radius:999px;border:1px solid rgba(244,194,71,.45);background:rgba(10,14,8,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:'Space Grotesk',Inter,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-l)}
.afv-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:afv-pulse 2.2s infinite}
@keyframes afv-pulse{0%{box-shadow:0 0 0 0 rgba(43,209,126,.55)}70%{box-shadow:0 0 0 9px rgba(43,209,126,0)}100%{box-shadow:0 0 0 0 rgba(43,209,126,0)}}
.afv-hero .afv-h1{text-shadow:0 2px 24px rgba(0,0,0,.45)}
/* "BARBEIRO," em faixa dourada (pedido do Lucas: tem que chamar a atenção) */
.afv .afv-chamada{display:inline-block;margin:0 0 .14em;padding:.04em .2em .07em;border-radius:.16em;background:linear-gradient(100deg,#FFE59A,#F4C247 45%,#E5A324);color:#1A1200;text-transform:uppercase;letter-spacing:-.03em;text-shadow:none;transform:rotate(-2.5deg);box-shadow:0 .1em .45em -.08em rgba(244,194,71,.75),inset 0 .03em 0 rgba(255,255,255,.6);animation:afv-chamada 2.8s ease-in-out infinite}
@keyframes afv-chamada{0%,100%{box-shadow:0 .1em .45em -.08em rgba(244,194,71,.6),inset 0 .03em 0 rgba(255,255,255,.6)}50%{box-shadow:0 .1em .9em .02em rgba(244,194,71,.95),inset 0 .03em 0 rgba(255,255,255,.6)}}
.afv-hero .afv-lead{font-size:17px;max-width:540px;margin-left:auto;margin-right:auto;color:#E6E1D3}
/* frase que se escreve sozinha embaixo do título */
.afv-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.afv-digita{display:flex;justify-content:center;min-height:1.5em;margin:20px 0 0;font-family:'Space Grotesk',Inter,sans-serif;font-size:clamp(17px,4.7vw,26px);font-weight:700;line-height:1.3;letter-spacing:-.015em}
@media (max-width:360px){.afv-digita{font-size:15.5px}}
@media (min-width:960px){.afv-digita{justify-content:flex-start}}
.afv .afv-digita-txt{display:inline-flex;align-items:center;gap:.4em;white-space:nowrap;color:var(--green);text-shadow:0 2px 18px rgba(0,0,0,.6)}
.afv-digita-check{flex-shrink:0;width:1em;height:1em;padding:.12em;border-radius:50%;background:rgba(43,209,126,.16);box-shadow:0 0 0 1px rgba(43,209,126,.45)}
.afv-cursor{display:inline-block;width:.09em;height:1.05em;margin-left:-.28em;border-radius:2px;background:var(--gold);animation:afv-pisca 1s steps(1) infinite}
@keyframes afv-pisca{0%,49%{opacity:1}50%,100%{opacity:0}}
.afv-video-box{position:relative;width:100%;margin:0 auto}
.afv-video-box.afv-video-v{max-width:330px;aspect-ratio:auto}
.afv-video-box.afv-video-h{max-width:880px;aspect-ratio:auto}
.afv-video-box .afv-video{margin-top:0}
.afv-video-tag{position:absolute;top:0;left:50%;z-index:4;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:10px;width:max-content;max-width:calc(100% - 16px);padding:8px 18px 8px 8px;border:0;border-radius:999px;background:linear-gradient(100deg,#FFE59A,#F4C247 45%,#E5A324);color:#1A1200;text-align:left;box-shadow:0 0 0 5px #06100B,0 14px 34px -10px rgba(244,194,71,.85);animation:afv-tag 2.6s ease-in-out infinite;transition:filter .2s}
.afv-video-tag:hover{filter:brightness(1.05)}
.afv-video-tag:focus-visible{outline:3px solid var(--gold-l);outline-offset:6px}
.afv-video-tag-ico{width:34px;height:34px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:#1A1200;color:#FFE59A}
.afv-video-tag-ico svg{margin-left:2px}
.afv .afv-video-tag-txt{display:flex;flex-direction:column;font-family:'Space Grotesk',Inter,sans-serif;font-size:15.5px;font-weight:700;line-height:1.15;letter-spacing:-.01em;color:#1A1200;white-space:nowrap}
.afv .afv-video-tag-txt small{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(26,18,0,.68);margin-bottom:2px}
@keyframes afv-tag{0%,100%{box-shadow:0 0 0 5px #06100B,0 14px 34px -10px rgba(244,194,71,.85)}50%{box-shadow:0 0 0 5px #06100B,0 14px 44px -4px rgba(244,194,71,1)}}
.afv-hero-cta{margin-top:26px;text-align:center}
.afv-checks{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;list-style:none;margin:20px 0 0;padding:0;font-size:14px;color:var(--cream2)}
.afv-checks li{display:inline-flex;align-items:center;gap:7px}
.afv-checks svg{flex-shrink:0;color:var(--green)}
/* trava: contagem embaixo do vídeo */
.afv .afv-video video{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;background:#000;display:block;cursor:pointer}
/* capa do vídeo do topo: clara, mostrando o sistema; o play fica embaixo do celular da imagem */
.afv-play-capa img{opacity:1}
.afv-play-capa:hover img{transform:scale(1.015)}
.afv-play-capa::after{background:none}
.afv-play-capa .afv-play-btn{top:80%;width:70px;height:70px;margin:-35px 0 0 -35px}
.afv-play.afv-play-pausado{background:rgba(4,10,7,.38)}
.afv-play.afv-play-pausado::after{background:none}
.afv-play-pausado .afv-play-cap{top:calc(50% + 54px);bottom:auto;left:0;right:0;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,.8)}
.afv-vctl{position:absolute;left:12px;bottom:12px;z-index:3;display:flex;gap:8px}
.afv-vctl button{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.2);background:rgba(4,10,7,.72);color:var(--cream);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:background .2s,border-color .2s}
.afv-vctl button:hover{background:rgba(4,10,7,.9);border-color:rgba(244,194,71,.6)}
.afv-vctl button:focus-visible{outline:3px solid var(--gold-l);outline-offset:2px}
.afv-trava{margin-top:16px;padding:14px 16px 16px;border-radius:16px;background:rgba(9,19,14,.82);border:1px solid rgba(244,194,71,.32);text-align:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.afv-trava-titulo{display:flex;align-items:center;justify-content:center;gap:8px;font-family:'Space Grotesk',Inter,sans-serif;font-size:15px;font-weight:700;line-height:1.35;color:var(--cream)}
.afv-trava-titulo svg{flex-shrink:0;color:var(--gold)}
.afv-trava-barra{height:8px;margin-top:12px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.1)}
.afv-trava-barra span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#C98C16,#F4C247,#FFE59A);transition:width .4s linear}
.afv-trava.is-ok{border-color:rgba(43,209,126,.55);background:rgba(10,30,20,.88)}
.afv-trava.is-ok .afv-trava-titulo svg{color:var(--green)}
.afv-trava-link{display:inline-flex;align-items:center;gap:8px;min-height:46px;margin-top:12px;padding:10px 20px;border:0;border-radius:999px;background:linear-gradient(100deg,#FFE59A,#F4C247 45%,#E5A324);color:#1A1200;font-family:'Space Grotesk',Inter,sans-serif;font-size:15px;font-weight:700}
.afv-trava-link svg{animation:afv-desce 1.6s ease-in-out infinite}
@keyframes afv-desce{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
.afv-gira{animation:afv-gira 1s linear infinite}
@keyframes afv-gira{to{transform:rotate(360deg)}}
.afv-trava-lento{min-height:44px;margin-top:8px;padding:8px 6px;border:0;background:none;font-size:14px;font-weight:600;line-height:1.35;color:var(--cream2);text-decoration:underline;text-underline-offset:3px}
.afv-trava-lento:hover{color:var(--cream)}
.afv-trava-aviso{display:none;align-items:center;gap:10px;max-width:460px;padding:14px 16px;border-radius:16px;background:rgba(9,19,14,.72);border:1px solid rgba(244,194,71,.3);font-size:15px;line-height:1.45;color:var(--cream2);text-align:left}
.afv-trava-aviso svg{flex-shrink:0;color:var(--gold)}
.afv-resto{animation:afv-rise .9s cubic-bezier(.2,.7,.2,1) both}
.afv-resto.is-travado{display:none}
@media (min-width:960px){
 .afv-hero{padding-bottom:88px}
 .afv-hero-grid{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);grid-template-areas:"copy visual" "cta visual";column-gap:56px;padding-top:16px}
 /* vídeo do topo no computador: do tamanho que cabe na tela junto com a contagem (notebook incluso) */
 .afv-hero-visual .afv-video-box.afv-video-v{max-width:clamp(240px,calc((100vh - 250px) * .5625),330px)}
 .afv-hero-visual .afv-video-tag{max-width:none}
 .afv-hero .afv-h1{font-size:64px}
 .afv-hero-copy{grid-area:copy;align-self:end;text-align:left}
 .afv-hero-visual,.afv-hero-grid.tem-video .afv-hero-visual{grid-area:visual;margin-top:0;padding-top:28px}
 .afv-hero-cta{grid-area:cta;align-self:start;text-align:left}
 .afv-hero .afv-lead{margin-left:0}
 .afv-hero-cta .afv-cta{margin-left:0}
 .afv-hero-cta .afv-checks{justify-content:flex-start}
 .afv-trava-aviso{display:flex}
}
.afv-rise{animation:afv-rise .9s cubic-bezier(.2,.7,.2,1) both}
.afv-d1{animation-delay:.08s}.afv-d2{animation-delay:.16s}.afv-d3{animation-delay:.26s}
@keyframes afv-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

/* botões */
.afv-cta{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:100%;max-width:440px;margin:0 auto;padding:18px 20px;border:0;border-radius:16px;background:linear-gradient(100deg,#FFE59A,#F4C247 45%,#E5A324);color:#1A1200;text-align:center;box-shadow:0 14px 38px -12px rgba(244,194,71,.78),inset 0 1px 0 rgba(255,255,255,.55);transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}
.afv-cta::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-18deg);animation:afv-sheen 5.5s ease-in-out infinite;pointer-events:none}
@keyframes afv-sheen{0%,64%{left:-60%}100%{left:130%}}
.afv-cta:hover{transform:translateY(-2px);filter:brightness(1.04);box-shadow:0 20px 46px -12px rgba(244,194,71,.92),inset 0 1px 0 rgba(255,255,255,.55)}
.afv-cta:active{transform:scale(.985)}
.afv-cta:focus-visible,.afv-ghost:focus-visible,.afv-enter:focus-visible,.afv-faq-q:focus-visible,.afv-play:focus-visible,.afv-prova-midia:focus-visible,.afv-wa:focus-visible{outline:3px solid var(--gold-l);outline-offset:3px}
.afv .afv-cta-main{position:relative;z-index:1;font-family:'Space Grotesk',Inter,sans-serif;font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.2;color:#1A1200}
.afv .afv-cta-sub{position:relative;z-index:1;font-size:13px;font-weight:500;line-height:1.3;color:rgba(26,18,0,.78)}
.afv-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:11px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--cream);font-size:14px;font-weight:600;line-height:1.3;text-align:center;transition:background .2s,border-color .2s}
.afv-ghost:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.26)}

/* celular de exemplo */
.afv-phone-wrap{position:relative;width:100%;max-width:330px;margin:0 auto;padding:34px 0}
.afv-phone{position:relative;border-radius:42px;padding:9px;background:linear-gradient(160deg,#33443A,#0C1410 38%,#1C2B23);box-shadow:0 0 0 1px rgba(255,255,255,.08),0 50px 90px -35px rgba(0,0,0,.95),0 0 70px -12px rgba(43,209,126,.28)}
.afv-screen{position:relative;overflow:hidden;border-radius:34px;background:#0A1310;display:flex;flex-direction:column}
.afv-notch{position:absolute;top:9px;left:50%;z-index:2;width:90px;height:22px;border-radius:999px;background:#000;transform:translateX(-50%)}
.afv-chat-top{display:flex;align-items:center;gap:10px;padding:42px 14px 12px;background:#12221A;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}
.afv-chat-avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;background:linear-gradient(135deg,#FFE59A,#C98C16);color:#1A1200}
.afv-chat-name{font-size:14px;font-weight:700;line-height:1.2;color:#F2EFE6}
.afv-chat-sub{font-size:11.5px;line-height:1.3;color:#8FA398}
.afv-chat-body{display:flex;flex-direction:column;gap:10px;padding:14px 11px 16px;background:radial-gradient(120% 60% at 50% 0%,rgba(43,209,126,.06),transparent),#0A1310;text-align:left}
.afv-chat-day{align-self:center;padding:4px 10px;border-radius:8px;background:#12221A;font-size:10.5px;font-weight:700;letter-spacing:.08em;color:#9FB2A7}
.afv-msg{position:relative;align-self:flex-start;max-width:94%;padding:9px 11px 20px;border-radius:4px 14px 14px 14px;background:#17281E;border:1px solid rgba(255,255,255,.05);font-size:12.4px;line-height:1.45;color:#ECE8DD;opacity:0;transform:translateY(10px);animation:afv-pop .7s cubic-bezier(.2,.8,.2,1) forwards}
.afv-msg p+p{margin-top:7px}
.afv-msg-1{animation-delay:.6s}
.afv-msg-2{animation-delay:1.7s;border-color:rgba(244,194,71,.28)}
.afv-msg-tag{display:flex;align-items:center;gap:5px;margin-bottom:5px;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--green)}
.afv-msg-2 .afv-msg-tag{color:var(--gold)}
.afv-msg-time{position:absolute;right:9px;bottom:4px;font-size:10px;color:#8FA398}
@keyframes afv-pop{to{opacity:1;transform:none}}
.afv-chat-input{display:flex;align-items:center;gap:8px;padding:8px 10px 16px;background:#0A1310}
.afv-chat-field{flex:1;height:36px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#12221A;font-size:12.5px;color:#7F9388}
.afv-chat-mic{width:36px;height:36px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:#1E8F57;color:#E8FFF2}
.afv-badge{position:absolute;z-index:3;padding:10px 13px;border-radius:14px;background:rgba(7,15,11,.92);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px -16px rgba(0,0,0,.95);text-align:left;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.afv-badge small{display:block;font-family:'Space Grotesk',Inter,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9FB2A7}
.afv-badge strong{display:block;margin-top:2px;font-family:'Space Grotesk',Inter,sans-serif;font-size:17px;font-weight:700;line-height:1.15;color:var(--cream)}
.afv-badge span{display:block;font-size:11.5px;line-height:1.3;color:var(--cream2)}
.afv-badge-a{top:0;left:-6px;border-color:rgba(43,209,126,.45)}
.afv-badge-a strong{color:#9CF2C4}
.afv-badge-b{bottom:0;right:-6px;border-color:rgba(244,194,71,.5)}
.afv-badge-b strong{color:var(--gold-l)}
@media (min-width:960px){.afv-phone-wrap{max-width:340px}.afv-badge-a{left:-34px}.afv-badge-b{right:-26px}}

/* vídeos */
.afv-video{position:relative;margin:18px auto 0;overflow:hidden;border-radius:24px;background:#000;border:1px solid rgba(244,194,71,.45);box-shadow:0 30px 80px -30px rgba(0,0,0,.95),0 0 0 6px rgba(244,194,71,.06)}
.afv-video-v{width:100%;max-width:330px;aspect-ratio:9/16}
.afv-video-h{width:100%;max-width:880px;aspect-ratio:16/9}
.afv-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.afv-play{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:#000}
.afv-play img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;opacity:.85;transition:opacity .3s,transform .6s}
.afv-play::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,10,7,0) 45%,rgba(4,10,7,.8))}
.afv-play:hover img{opacity:1;transform:scale(1.02)}
.afv-play-btn{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#FFE59A,#F4C247 55%,#E5A324);color:#1A1200;box-shadow:0 0 0 10px rgba(244,194,71,.18),0 18px 40px -10px rgba(244,194,71,.75)}
.afv-play-btn{position:absolute;left:50%;top:50%;z-index:1;margin:-38px 0 0 -38px;transition:transform .2s}
.afv-play-btn svg{margin-left:4px}
.afv-play:hover .afv-play-btn{transform:scale(1.07)}
.afv-play-cap{position:absolute;left:16px;right:16px;bottom:14px;z-index:1;font-family:'Space Grotesk',Inter,sans-serif;font-size:15px;font-weight:700;color:var(--cream);text-align:left}
.afv-video-depo{max-width:360px;margin:42px auto 0;text-align:center}
.afv-video-depo .afv-video{margin-top:12px}

/* faixas escuras e fotos de fundo */
.afv-band{position:relative;padding:20px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:linear-gradient(180deg,#030805,#07120D)}
.afv-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 14px;list-style:none;margin:0;padding:0}
.afv-chips li{display:inline-flex;align-items:center;gap:14px;font-family:'Space Grotesk',Inter,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--cream2)}
.afv-chips li:not(:last-child)::after{content:'✦';color:var(--gold);font-size:10px}
.afv-bg-photo{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.afv-bg-photo img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;opacity:.8;filter:saturate(.95)}
.afv-bg-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#040A07 0%,rgba(4,10,7,.42) 20%,rgba(4,10,7,.42) 80%,#040A07 100%)}
.afv-bg-photo-forte img{opacity:.7}
.afv-bg-photo-direita img{object-position:86% 55%}
.afv-nums-band{position:relative;isolation:isolate;overflow:hidden;padding:64px 0}
.afv-nums-band .afv-kicker{margin-bottom:0}
.afv-nums{display:grid;gap:14px;max-width:820px;margin:20px auto 0}
@media (min-width:640px){.afv-nums{grid-template-columns:1fr 1fr}}
.afv-num{padding:26px 16px;border-radius:20px;text-align:center;background:rgba(9,19,14,.74);border:1px solid rgba(255,255,255,.12);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.afv-num strong{display:block;font-family:'Space Grotesk',Inter,sans-serif;font-size:clamp(44px,12vw,62px);font-weight:700;letter-spacing:-.045em;line-height:1.05}
.afv-num span{display:block;margin-top:10px;font-size:15px;line-height:1.45;color:var(--cream2)}

/* conta da falta */
.afv-chair{position:relative;max-width:620px;margin:30px auto 0;overflow:hidden;border-radius:24px;border:1px solid rgba(255,255,255,.1);box-shadow:0 40px 90px -45px rgba(0,0,0,.95)}
.afv-chair img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;filter:saturate(.8) brightness(.82)}
.afv-chair::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(4,10,7,0) 40%,rgba(4,10,7,.88))}
.afv-chair figcaption{position:absolute;left:14px;right:14px;bottom:14px;z-index:1;text-align:left}
.afv-chair small{display:inline-flex;align-items:center;gap:7px;font-family:'Space Grotesk',Inter,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#FFC2B8}
.afv-red-dot{width:8px;height:8px;border-radius:50%;background:#FF6B57;box-shadow:0 0 0 4px rgba(255,107,87,.2)}
.afv-chair strong{display:block;margin-top:4px;font-family:'Space Grotesk',Inter,sans-serif;font-size:28px;font-weight:700;line-height:1.1;letter-spacing:-.03em;color:var(--cream)}
.afv-chair figcaption > span{display:block;margin-top:2px;font-size:14px;color:var(--cream2)}
.afv-calc{max-width:620px;margin:22px auto 0;padding:20px 18px 22px;border-radius:24px;background:linear-gradient(180deg,#0D1A13,#08120D);border:1px solid var(--line);box-shadow:0 40px 90px -50px rgba(0,0,0,.9)}
.afv-calc-title{text-align:center;font-family:'Space Grotesk',Inter,sans-serif;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.afv-calc-row{display:grid;gap:10px;padding:16px 0;border-bottom:1px dashed rgba(255,255,255,.09)}
.afv-calc-label{font-size:15.5px;font-weight:600;line-height:1.3;color:var(--cream)}
.afv-calc-label small{display:block;margin-top:2px;font-size:13px;font-weight:400;color:var(--muted)}
.afv-stepper{display:grid;grid-template-columns:52px 1fr 52px;align-items:center;gap:8px}
.afv-stepper button{height:48px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);display:grid;place-items:center;color:var(--cream);font-size:22px;font-weight:700;line-height:1;transition:border-color .2s,color .2s,background .2s}
.afv-stepper button:hover{border-color:rgba(244,194,71,.6);color:var(--gold-l);background:rgba(244,194,71,.06)}
.afv-stepper button:disabled{opacity:.35;cursor:not-allowed}
.afv-stepper output{text-align:center;font-family:'Space Grotesk',Inter,sans-serif;font-size:24px;font-weight:700;letter-spacing:-.02em;color:var(--cream)}
@media (min-width:560px){.afv-calc{padding:24px 26px 26px}.afv-calc-row{grid-template-columns:1fr 230px;align-items:center}}
.afv-calc-result{margin-top:20px;padding:20px 16px;border-radius:18px;text-align:center;background:radial-gradient(100% 120% at 50% 0%,rgba(244,194,71,.14),rgba(244,194,71,.03));border:1px solid rgba(244,194,71,.32)}
.afv-calc-result small{display:block;font-family:'Space Grotesk',Inter,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-l)}
.afv-calc-big{display:block;margin:6px 0 4px;font-family:'Space Grotesk',Inter,sans-serif;font-size:clamp(46px,13vw,64px);font-weight:700;letter-spacing:-.045em;line-height:1.08}
.afv-calc-year{font-size:15.5px;color:var(--cream)}
.afv-calc-year b{color:var(--gold-l)}
.afv-calc-math{margin-top:6px;font-size:12.5px;color:var(--muted)}
.afv-calc-after{max-width:520px;margin:20px auto 0;text-align:center;font-size:15px;color:var(--cream2)}

/* como funciona */
.afv-how{display:grid;gap:40px;align-items:center;margin-top:36px}
@media (min-width:960px){.afv-how{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:56px}}
.afv-steps{display:grid}
.afv-step{position:relative;padding:22px 18px 24px;border-radius:20px;text-align:center;background:var(--card);border:1px solid var(--line)}
.afv-step small{display:block;font-family:'Space Grotesk',Inter,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.afv-step-big{display:inline-block;margin:4px 0 8px;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:800;font-size:40px;line-height:1.15;padding:0 .08em .04em 0;color:var(--cream)}
.afv-step-big.is-green{color:var(--green)}
.afv-step p{max-width:420px;margin:0 auto;font-size:15.5px;line-height:1.55;color:var(--cream2)}
.afv-step-gold{border-color:rgba(244,194,71,.42);background:linear-gradient(180deg,rgba(244,194,71,.09),var(--card) 62%)}
.afv-arrow{display:grid;place-items:center;height:38px;color:var(--gold)}
.afv-how-img{text-align:center}
.afv-how-img > img{width:100%;max-width:540px;margin:0 auto;filter:drop-shadow(0 40px 60px rgba(0,0,0,.6))}
.afv-how-img > p{margin-top:14px;font-size:15px;color:var(--cream2)}
.afv-note{display:flex;gap:12px;align-items:flex-start;max-width:540px;margin:20px auto 0;padding:14px 16px;border-radius:16px;background:rgba(43,209,126,.07);border:1px solid rgba(43,209,126,.28);font-size:14.5px;line-height:1.5;color:var(--cream2);text-align:left}
.afv-note svg{flex-shrink:0;margin-top:2px;color:var(--green)}

/* fileiras de cartões (arrastar para o lado) */
.afv-pills{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;list-style:none;margin:22px 0 0;padding:0}
.afv-pills li{padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:13px;color:var(--cream2)}
.afv-pills b{color:var(--gold-l)}
.afv-row-nav{display:none}
.afv-row{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:30px -16px 0;padding:6px 16px 18px;scroll-padding:0 16px}
.afv-row::-webkit-scrollbar{display:none}
.afv-card{position:relative;flex:0 0 80%;max-width:300px;scroll-snap-align:start;display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--card);border:1px solid var(--line)}
.afv-card-art{position:relative;aspect-ratio:5/4;display:grid;place-items:center;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,#173527,#0A1510 70%);border-bottom:1px solid var(--line)}
.afv-card-art img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover}
.afv-card-art img.is-contain{object-fit:contain;padding:12px}
.afv-card-tag{position:absolute;top:10px;left:10px;z-index:2;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;background:rgba(4,10,7,.85);border:1px solid rgba(43,209,126,.45);font-family:'Space Grotesk',Inter,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#B9F5D3}
.afv-card-tag.is-main{border-color:rgba(244,194,71,.65);color:var(--gold-l)}
.afv-art-icon{width:84px;height:84px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(244,194,71,.22),rgba(244,194,71,.05));border:1px solid rgba(244,194,71,.38);color:var(--gold-l);box-shadow:0 22px 44px -22px rgba(244,194,71,.65)}
.afv-art-icon.is-green{background:linear-gradient(145deg,rgba(43,209,126,.24),rgba(43,209,126,.05));border-color:rgba(43,209,126,.42);color:#9CF2C4;box-shadow:0 22px 44px -22px rgba(43,209,126,.6)}
.afv-card-body{padding:16px 16px 20px;text-align:left}
.afv-card-body h3{margin:0 0 6px;font-family:'Space Grotesk',Inter,sans-serif;font-size:17px;font-weight:700;line-height:1.25;letter-spacing:-.01em;color:var(--cream)}
.afv-card-body p{font-size:14px;line-height:1.55;color:var(--cream2)}
.afv-hint{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px;font-size:13.5px;color:var(--muted)}
@media (min-width:768px){
 .afv-row-nav{display:flex;justify-content:flex-end;gap:8px;margin-top:26px}
 .afv-row-nav button{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:var(--cream);transition:border-color .2s,color .2s}
 .afv-row-nav button:hover{border-color:rgba(244,194,71,.6);color:var(--gold-l)}
 .afv-row{margin:14px 0 0;padding:6px 0 18px;scroll-padding:0}
 .afv-card{flex-basis:290px}
}

/* depoimentos */
.afv-row-provas .afv-card{flex-basis:86%;max-width:340px}
@media (min-width:768px){.afv-row-provas .afv-card{flex-basis:340px}}
.afv-prova-midia{position:relative;display:grid;place-items:center;width:100%;height:300px;padding:14px;border:0;border-bottom:1px solid var(--line);background:#F3F0E7;cursor:zoom-in}
.afv-prova-midia.is-escuro{background:#07101C}
.afv-prova-midia img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:10px;box-shadow:0 10px 30px -14px rgba(0,0,0,.45)}
.afv-prova-zoom{position:absolute;right:10px;bottom:10px;display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;background:rgba(4,10,7,.82);color:var(--cream);font-size:11.5px;font-weight:600}
.afv-prova-corpo{display:flex;flex:1;flex-direction:column;gap:10px;padding:16px 16px 18px;text-align:left}
.afv-prova-frase{font-family:'Space Grotesk',Inter,sans-serif;font-size:17px;font-weight:700;line-height:1.3;letter-spacing:-.01em;color:var(--cream)}
.afv-prova-fonte{margin-top:auto;font-size:13px;color:var(--muted)}
.afv-audio{display:flex;align-items:center;gap:10px;padding:10px;border-radius:16px;background:#0E1D15;border:1px solid rgba(43,209,126,.3)}
.afv .afv-audio-photo{width:46px;height:46px;flex-shrink:0;border-radius:50%;object-fit:cover;border:2px solid rgba(43,209,126,.6)}
.afv-audio-btn{width:44px;height:44px;flex-shrink:0;border:0;border-radius:50%;display:grid;place-items:center;background:var(--green);color:#04150C;transition:filter .2s}
.afv-audio-btn:hover{filter:brightness(1.08)}
.afv-audio-main{flex:1;min-width:0}
.afv-audio-bar{height:6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.12)}
.afv-audio-bar span{display:block;height:100%;border-radius:inherit;background:var(--green)}
.afv-audio-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:#A9C9B6}
.afv-audio-right{display:inline-flex;align-items:center;gap:8px}
.afv-rate{padding:3px 8px;border:0;border-radius:999px;background:rgba(255,255,255,.1);font-size:11px;font-weight:700;line-height:1.2;color:var(--cream)}
.afv-panel-title{margin:0;font-family:'Space Grotesk',Inter,sans-serif;font-size:18px;font-weight:700;line-height:1.35;color:var(--cream)}
.afv-small{margin:10px 2px 0;font-size:12.5px;line-height:1.5;color:var(--muted)}

/* para quem é */
.afv-who-section{isolation:isolate;overflow:hidden}
.afv-who-section{padding:110px 0}
.afv-who-section .afv-bg-photo img{opacity:1;object-position:50% 30%}
.afv-who-section .afv-bg-photo::after{background:linear-gradient(180deg,#040A07 0%,rgba(4,10,7,.3) 22%,rgba(4,10,7,.3) 78%,#040A07 100%)}
.afv-who{max-width:640px;margin:0 auto;padding:28px 20px;border-radius:24px;background:rgba(9,19,14,.66);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.afv-who h2{margin:0;text-align:center;font-family:'Space Grotesk',Inter,sans-serif;font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--cream)}
.afv-list{display:grid;gap:14px;list-style:none;margin:20px 0 0;padding:0}
.afv-list li{display:flex;align-items:flex-start;gap:12px;font-size:15.5px;line-height:1.5;color:var(--cream2)}
.afv-list svg{flex-shrink:0;margin-top:3px;color:var(--green)}
.afv-who-end{margin-top:20px;text-align:center;font-size:15px;font-weight:600;color:var(--cream)}

/* oferta */
.afv-offer{max-width:560px;margin:34px auto 0;padding:2px;border-radius:28px;background:linear-gradient(150deg,#FFE59A,#F4C247 30%,rgba(43,209,126,.85) 72%,#F4C247 100%);box-shadow:0 50px 110px -40px rgba(244,194,71,.62)}
.afv-offer-in{padding:30px 18px 26px;border-radius:26px;text-align:center;background:radial-gradient(120% 70% at 50% 0%,#14281D,#07110C 62%)}
.afv-offer-seal{display:inline-block;padding:7px 14px;border-radius:999px;background:var(--cream);font-family:'Space Grotesk',Inter,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#0B1711}
.afv-offer h3{margin:18px 0 4px;font-family:'Space Grotesk',Inter,sans-serif;font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-.02em;color:var(--cream)}
.afv-offer-sub{font-size:15px;font-weight:600;color:var(--green)}
.afv-price{display:flex;align-items:flex-start;justify-content:center;gap:6px;margin:22px 0 8px;font-family:'Space Grotesk',Inter,sans-serif}
.afv-price-cur{margin-top:14px;font-size:24px;font-weight:700;color:var(--gold-l)}
.afv-price-val{font-size:clamp(66px,19vw,90px);font-weight:700;line-height:1;letter-spacing:-.05em}
.afv-price-per{align-self:flex-end;margin-bottom:10px;font-size:18px;font-weight:600;color:var(--cream2)}
.afv-offer-lines{margin:4px 0 22px;font-size:14.5px;line-height:1.6;color:var(--cream2)}
.afv-secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;font-size:13px;color:var(--muted)}
.afv-secure svg{flex-shrink:0;color:var(--green)}
.afv-offer-alt{margin-top:16px}
.afv-all{max-width:560px;margin:18px auto 0;padding:22px 18px;border-radius:24px;background:#07110C;border:1px solid var(--line);text-align:left}
.afv-all-title{margin:0 0 4px;text-align:center;font-family:'Space Grotesk',Inter,sans-serif;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--cream2)}
.afv-all-group{margin-top:18px}
.afv-all-group h4{margin:0 0 10px;font-family:'Space Grotesk',Inter,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
.afv-all ul{display:grid;gap:10px;list-style:none;margin:0;padding:0}
.afv-all li{display:flex;align-items:flex-start;gap:10px;font-size:14.5px;line-height:1.45;color:var(--cream2)}
.afv-all li svg{flex-shrink:0;margin-top:2px;color:var(--green)}
.afv-all li b{color:var(--cream);font-weight:600}
.afv-prata{max-width:560px;margin:18px auto 0;text-align:center;font-size:14px;line-height:1.5;color:var(--muted)}
.afv-prata a{color:var(--cream2);text-decoration:underline;text-underline-offset:3px}
.afv-prata a:hover{color:var(--cream)}

/* garantia */
.afv-safe{display:grid;gap:12px;max-width:980px;margin:0 auto}
@media (min-width:768px){.afv-safe{grid-template-columns:repeat(3,1fr)}}
.afv-safe-card{display:flex;align-items:flex-start;gap:14px;padding:18px;border-radius:18px;background:var(--card);border:1px solid var(--line);text-align:left}
.afv-safe-ico{width:44px;height:44px;flex-shrink:0;border-radius:12px;display:grid;place-items:center;background:rgba(43,209,126,.1);border:1px solid rgba(43,209,126,.35);color:var(--green)}
.afv-safe-card h3{margin:0 0 4px;font-family:'Space Grotesk',Inter,sans-serif;font-size:16px;font-weight:700;color:var(--cream)}
.afv-safe-card p{font-size:14px;line-height:1.5;color:var(--cream2)}

/* perguntas */
.afv-faq{display:grid;gap:10px;margin-top:28px}
.afv-faq-item{overflow:hidden;border-radius:16px;background:var(--card);border:1px solid var(--line)}
.afv-faq-q{display:flex;width:100%;min-height:56px;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:0;background:transparent;text-align:left;font-family:'Space Grotesk',Inter,sans-serif;font-size:15.5px;font-weight:600;line-height:1.35;color:var(--cream)}
.afv-faq-q svg{flex-shrink:0;color:var(--gold);transition:transform .25s}
.afv-faq-item.is-open .afv-faq-q svg{transform:rotate(45deg)}
.afv-faq-a{padding:0 18px 18px;font-size:14.5px;line-height:1.6;color:var(--cream2)}

/* final */
.afv-final{position:relative;isolation:isolate;overflow:hidden;padding:96px 0 84px;text-align:center;border-top:1px solid var(--line);background:#020604}
.afv-final .afv-lead{max-width:520px;margin-left:auto;margin-right:auto;color:#E6E1D3}
.afv-final .afv-h2{text-shadow:0 2px 24px rgba(0,0,0,.5)}

/* rodapé */
.afv-foot{padding:34px 0 120px;border-top:1px solid var(--line);background:#020604;text-align:center;font-size:13px;line-height:1.6;color:var(--muted)}
.afv-foot-brand{display:flex;justify-content:center;margin-bottom:12px}
.afv-foot nav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;margin:14px 0}
.afv-foot nav a,.afv-foot nav button{padding:0;border:0;background:none;font-size:13px;color:var(--cream2);text-decoration:underline;text-underline-offset:3px}
.afv-foot-copy{margin-top:8px}

/* WhatsApp flutuante */
.afv-wa{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9991;display:inline-flex;align-items:center;gap:10px;border-radius:999px;transition:opacity .3s,transform .3s}
.afv .afv-wa img{width:58px;height:58px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.55))}
.afv-wa span{display:none}
@media (min-width:768px){
 .afv-wa{right:22px;bottom:22px;padding:6px 18px 6px 6px;background:rgba(7,15,11,.92);border:1px solid rgba(43,209,126,.45);box-shadow:0 18px 40px -14px rgba(0,0,0,.9);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
 .afv .afv-wa img{width:44px;height:44px;filter:none}
 .afv-wa span{display:inline;font-size:14px;font-weight:700;color:var(--cream)}
 .afv-wa:hover{border-color:rgba(43,209,126,.8)}
}
/* notebook (tela baixa): só o ícone, para não ficar em cima do vídeo e da contagem */
@media (min-width:960px) and (max-height:820px){.afv-wa{padding:6px}.afv-wa span{display:none}}

/* popup e foto ampliada */
.afv-modal,.afv-zoom{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.78)}
.afv-modal-box{position:relative;width:100%;max-width:400px;padding:30px 20px 22px;border-radius:24px;text-align:center;background:linear-gradient(180deg,#10221A,#0B1711);border:1px solid rgba(244,194,71,.35);box-shadow:0 40px 90px -30px rgba(0,0,0,.9);color:var(--cream)}
.afv-modal-x{position:absolute;top:10px;right:10px;width:40px;height:40px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);color:var(--cream)}
.afv-modal-emoji{font-size:34px;line-height:1}
.afv-modal-box h3{margin:12px 0 20px;font-family:'Space Grotesk',Inter,sans-serif;font-size:21px;font-weight:700;line-height:1.25;letter-spacing:-.01em;color:var(--cream)}
.afv-modal-btns{display:grid;gap:10px}
.afv-btn-gold,.afv-btn-line{width:100%;min-height:50px;padding:14px 16px;border-radius:14px;font-size:15px;font-weight:700;line-height:1.3}
.afv-btn-gold{border:0;background:linear-gradient(100deg,#FFE59A,#F4C247 45%,#E5A324);color:#1A1200}
.afv-btn-line{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:var(--cream)}
.afv-btn-line:hover{background:rgba(255,255,255,.08)}
.afv-zoom{cursor:zoom-out}
.afv-zoom img{max-width:100%;max-height:86vh;width:auto;border-radius:12px;background:#fff}
.afv-zoom .afv-modal-x{position:fixed;top:14px;right:14px}

/* animação ao rolar (só liga quando o JavaScript confirma que pode) */
.afv[data-anim] [data-reveal]{transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.afv[data-anim] [data-reveal]:not([data-on]){opacity:0;transform:translateY(24px)}

@media (prefers-reduced-motion:reduce){
 .afv *,.afv *::before,.afv *::after{animation:none !important;transition:none !important}
 .afv-msg{opacity:1;transform:none}
 .afv[data-anim] [data-reveal]:not([data-on]){opacity:1;transform:none}
 .afv .afv-cursor{animation:afv-pisca 1s steps(1) infinite !important}
}
`;
