/**
 * Pixel do Meta (Facebook/Instagram) — lado do NAVEGADOR. Só nas páginas de VENDA do Agendei Fácil.
 *
 * REGRAS (não mudar sem pensar):
 *  1. Só carrega quando uma página de venda chama `iniciarPixel()` (página inicial, /cadastroag,
 *     /cadastrar). NUNCA nas páginas de agendamento das barbearias nem no painel: ali quem navega
 *     é o cliente do barbeiro, e esses dados não são nossos para mandar ao Meta.
 *  2. Os avisos automáticos do Meta ficam DESLIGADOS (leitura de cliques e de troca de tela).
 *     Sem isso, depois que a pessoa entra no painel o Meta passaria a ler os botões de lá.
 *     Só sai o que este arquivo manda de propósito.
 *  3. Nada aqui pode quebrar a página: todo erro é engolido em silêncio.
 *  4. Fora do site oficial (computador de teste, prévia, aplicativo) nada é enviado ao Meta.
 *     Fica só anotado em `window.__afPixelLog`, para conferir.
 */
import { META_PIXEL_ID } from './metaPixelConfig';

const DOMINIOS_OFICIAIS = ['agendeifacil.com', 'agendeifacil.com.br'];
const PREFIXO_GUARDADO = 'afpx:';
const LIMITE_LOG = 200;

type Dados = Record<string, unknown>;

interface OpcoesEvento {
  /** Nome único do evento (para o Meta juntar com o aviso do servidor). */
  eventId?: string;
  /** `visita`: só uma vez enquanto a aba estiver aberta. `sempre`: uma vez só neste navegador. */
  umaVez?: 'visita' | 'sempre';
  /** Nome usado para lembrar que já foi enviado. Padrão: o nome do evento. */
  chave?: string;
}

const temJanela = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

/** O pixel de verdade só roda no site oficial. Em qualquer outro lugar é modo de teste. */
export function pixelEmModoTeste(): boolean {
  if (!temJanela()) return true;
  try {
    const w = window as any;
    if (w.Capacitor?.isNativePlatform?.()) return true;
    const host = String(window.location.hostname || '').toLowerCase();
    return !DOMINIOS_OFICIAIS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
}

function anotar(tipo: string, nome: string, dados?: Dados, eventId?: string) {
  try {
    const w = window as any;
    const log: unknown[] = Array.isArray(w.__afPixelLog) ? w.__afPixelLog : (w.__afPixelLog = []);
    log.push({ tipo, nome, dados: dados || null, eventId: eventId || null, quando: Date.now() });
    if (log.length > LIMITE_LOG) log.splice(0, log.length - LIMITE_LOG);
  } catch {
    // só anotação
  }
}

function jaEnviou(chave: string, onde: 'visita' | 'sempre'): boolean {
  try {
    const caixa = onde === 'sempre' ? window.localStorage : window.sessionStorage;
    if (caixa.getItem(PREFIXO_GUARDADO + chave)) return true;
    caixa.setItem(PREFIXO_GUARDADO + chave, '1');
    return false;
  } catch {
    // Navegador sem armazenamento: usa a memória desta página.
    const w = window as any;
    const memoria: Record<string, boolean> = (w.__afPixelMemoria = w.__afPixelMemoria || {});
    if (memoria[chave]) return true;
    memoria[chave] = true;
    return false;
  }
}

function chamarFbq(...args: unknown[]) {
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === 'function') fbq(...args);
  } catch {
    // o pixel nunca derruba a página
  }
}

/**
 * Carrega o pixel. Pode chamar quantas vezes quiser: só carrega uma.
 * Chamar SÓ em página de venda (ver regra 1 no topo).
 */
export function iniciarPixel(): void {
  if (!temJanela()) return;
  try {
    const w = window as any;
    if (w.__afPixelIniciado) return;
    w.__afPixelIniciado = true;
    anotar('inicio', pixelEmModoTeste() ? 'modo-teste' : 'pixel-ligado');
    if (pixelEmModoTeste()) return;

    // Páginas antigas (/conhecerv2, /conhecerv3) ligam este mesmo pixel por conta própria.
    // Se já estiver ligado, não liga de novo.
    if (typeof w.fbq === 'function') return;

    const fila: any = function (...args: unknown[]) {
      if (fila.callMethod) fila.callMethod(...args);
      else fila.queue.push(args);
    };
    w.fbq = fila;
    if (!w._fbq) w._fbq = fila;
    fila.push = fila;
    fila.loaded = true;
    fila.version = '2.0';
    fila.queue = [];
    // Regra 2: o Meta não avisa sozinho a cada troca de tela (o site é uma página só).
    fila.disablePushState = true;
    fila.allowDuplicatePageViews = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onerror = () => anotar('erro', 'script-bloqueado');
    document.head.appendChild(script);

    // Regra 2: desliga a leitura automática de botões e formulários (tem que vir ANTES do init).
    w.fbq('set', 'autoConfig', false, META_PIXEL_ID);
    w.fbq('init', META_PIXEL_ID);
  } catch {
    // o pixel nunca derruba a página
  }
}

let ultimaPagina = '';
let ultimaPaginaQuando = 0;

/** "Alguém abriu esta página". Chamar ao abrir cada página de venda. */
export function pixelPageView(): void {
  if (!temJanela()) return;
  try {
    const pagina = window.location.pathname;
    const agora = Date.now();
    // Evita aviso em dobro quando a tela monta duas vezes seguidas.
    if (pagina === ultimaPagina && agora - ultimaPaginaQuando < 2000) return;
    ultimaPagina = pagina;
    ultimaPaginaQuando = agora;
    anotar('track', 'PageView');
    if (pixelEmModoTeste()) return;
    chamarFbq('track', 'PageView');
  } catch {
    // o pixel nunca derruba a página
  }
}

function enviar(tipo: 'track' | 'trackCustom', nome: string, dados?: Dados, opcoes?: OpcoesEvento) {
  if (!temJanela()) return;
  try {
    if (opcoes?.umaVez && jaEnviou(opcoes.chave || nome, opcoes.umaVez)) return;
    anotar(tipo, nome, dados, opcoes?.eventId);
    if (pixelEmModoTeste()) return;
    if (opcoes?.eventId) chamarFbq(tipo, nome, dados || {}, { eventID: opcoes.eventId });
    else chamarFbq(tipo, nome, dados || {});
  } catch {
    // o pixel nunca derruba a página
  }
}

/** Evento que o Meta já conhece: ViewContent, InitiateCheckout, Lead, Contact, Purchase... */
export function pixelEvento(nome: string, dados?: Dados, opcoes?: OpcoesEvento): void {
  enviar('track', nome, dados, opcoes);
}

/** Evento nosso (o Meta aceita qualquer nome): VideoInicio, Video50... */
export function pixelEventoProprio(nome: string, dados?: Dados, opcoes?: OpcoesEvento): void {
  enviar('trackCustom', nome, dados, opcoes);
}

const soDigitos = (v: unknown): string => {
  let out = '';
  for (const c of String(v ?? '')) if (c >= '0' && c <= '9') out += c;
  return out;
};

let jaIdentificou = false;

/**
 * Conta ao Meta quem é a pessoa que preencheu o cadastro (e-mail e WhatsApp).
 * O próprio pixel embaralha os dados antes de enviar: o Meta não recebe o e-mail nem o telefone
 * em texto puro. Serve para ele achar o perfil certo e ligar a venda ao anúncio.
 */
export function pixelIdentificar(pessoa: { email?: string; telefone?: string; nome?: string }): void {
  if (!temJanela() || jaIdentificou) return;
  try {
    const dados: Record<string, string> = {};
    const email = String(pessoa.email || '').trim().toLowerCase();
    if (email.includes('@')) dados.em = email;
    const telefone = soDigitos(pessoa.telefone);
    if (telefone.length >= 10) dados.ph = telefone.length <= 11 ? `55${telefone}` : telefone;
    const partes = String(pessoa.nome || '').trim().toLowerCase().split(' ').filter(Boolean);
    if (partes.length > 0) dados.fn = partes[0];
    if (partes.length > 1) dados.ln = partes[partes.length - 1];
    if (Object.keys(dados).length === 0) return;
    jaIdentificou = true;
    anotar('identificar', Object.keys(dados).join(','));
    if (pixelEmModoTeste()) return;
    chamarFbq('init', META_PIXEL_ID, dados);
  } catch {
    // o pixel nunca derruba a página
  }
}

function lerCookie(nome: string): string {
  try {
    const achado = document.cookie.split('; ').find((c) => c.startsWith(`${nome}=`));
    return achado ? decodeURIComponent(achado.slice(nome.length + 1)).slice(0, 300) : '';
  } catch {
    return '';
  }
}

/**
 * Os dois "carimbos" que o pixel deixa no navegador (qual visita e qual clique no anúncio).
 * Vão junto com o cadastro para o servidor conseguir ligar a compra ao anúncio certo.
 */
export function lerCarimbosDoMeta(): { fbp?: string; fbc?: string; url?: string } {
  if (!temJanela()) return {};
  try {
    const saida: { fbp?: string; fbc?: string; url?: string } = {};
    const fbp = lerCookie('_fbp');
    if (fbp) saida.fbp = fbp;
    let fbc = lerCookie('_fbc');
    if (!fbc) {
      // Chegou agora pelo anúncio e o carimbo ainda não foi gravado: monta pelo endereço.
      const fbclid = new URLSearchParams(window.location.search).get('fbclid');
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`.slice(0, 300);
    }
    if (fbc) saida.fbc = fbc;
    saida.url = `${window.location.origin}${window.location.pathname}`;
    return saida;
  } catch {
    return {};
  }
}

/**
 * Acompanha um vídeo: começou, 25%, 50%, 75% e viu até o fim.
 * Cada marco é avisado uma vez por visita (recarregar a página não avisa de novo).
 */
export function criarRastreadorDeVideo(nomeDoVideo: string) {
  const dados = { video: nomeDoVideo };
  // O vídeo avisa o tempo várias vezes por segundo: a lista em memória evita trabalho repetido.
  const feitos = new Set<string>();
  const marco = (nome: string) => {
    if (feitos.has(nome)) return;
    feitos.add(nome);
    pixelEventoProprio(nome, dados, { umaVez: 'visita', chave: `video:${nomeDoVideo}:${nome}` });
  };
  return {
    comecou: () => marco('VideoInicio'),
    andou: (tempo: number, duracao: number) => {
      if (!(duracao > 0) || !(tempo > 0)) return;
      const parte = tempo / duracao;
      if (parte >= 0.25) marco('Video25');
      if (parte >= 0.5) marco('Video50');
      if (parte >= 0.75) marco('Video75');
      if (parte >= 0.97) marco('VideoCompleto');
    },
    terminou: () => marco('VideoCompleto'),
    /** Assistiu de verdade o tempo que libera a página (1 minuto). */
    assistiuUmMinuto: () => marco('Video1Minuto'),
  };
}
