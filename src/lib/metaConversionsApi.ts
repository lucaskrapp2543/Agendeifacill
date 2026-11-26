/**
 * Aviso de COMPRA para o Meta direto do servidor (não depende do navegador do cliente).
 *
 * Por que existe: o pixel do navegador falha com bloqueador de anúncio, iPhone e quando a pessoa
 * fecha a aba antes da hora. O servidor sabe com certeza quando o pagamento caiu, então ele avisa.
 * O navegador avisa a mesma compra com o MESMO nome (`eventId`) e o Meta junta os dois em um.
 *
 * REGRAS:
 *  - É só um aviso a mais. NUNCA lança erro e NUNCA atrasa a venda: tem limite de tempo curto e,
 *    se falhar, a conta e o pagamento seguem normais.
 *  - Sem a chave META_CAPI_TOKEN no Netlify, não faz nada (o pixel do navegador continua valendo).
 *  - E-mail, telefone e nome vão embaralhados (SHA-256). O Meta não recebe o dado em texto puro.
 *  - Só para a PRIMEIRA compra de um cliente novo. Renovação não é venda nova.
 */
import { createHash } from 'node:crypto';
import { META_PIXEL_ID, idCompraSite } from './metaPixelConfig';

const VERSAO_API = 'v26.0';
/** Tempo máximo de espera pelo Meta. Passou disso, desiste (a venda nunca espera por ele). */
const LIMITE_MS = 2000;

const embaralhar = (valor: string): string => createHash('sha256').update(valor).digest('hex');

const soDigitos = (v: unknown): string => {
  let out = '';
  for (const c of String(v ?? '')) if (c >= '0' && c <= '9') out += c;
  return out;
};

const texto = (v: unknown, limite = 500): string => String(v ?? '').trim().slice(0, limite);

/** Primeiro IP de uma lista "ip, ip, ip". */
const primeiroIp = (v: unknown): string => texto(v, 200).split(',')[0].trim();

export interface CompraParaMeta {
  /** Nome único da compra (idCompraSite / idCompraCakto). Sem ele o aviso não sai. */
  eventId: string;
  /** Valor pago, em reais. */
  valor: number;
  plano?: string | null;
  email?: string | null;
  /** Com ou sem o 55 na frente. */
  telefone?: string | null;
  nome?: string | null;
  /** Dados do navegador de quem comprou (guardados na hora do cadastro). */
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  /** Página onde a compra começou. */
  urlOrigem?: string | null;
  /** Quando o pagamento caiu. Padrão: agora. */
  quando?: Date | string | null;
}

export interface ResultadoAvisoMeta {
  ok: boolean;
  motivo?: 'sem_chave' | 'sem_id' | 'sem_navegador' | 'sem_dados_da_pessoa' | 'recusado' | 'erro';
  detalhe?: string;
}

export async function avisarCompraAoMeta(compra: CompraParaMeta): Promise<ResultadoAvisoMeta> {
  try {
    const chave = texto(process.env.META_CAPI_TOKEN, 1000);
    if (!chave) return { ok: false, motivo: 'sem_chave' };

    const eventId = texto(compra.eventId, 200);
    if (!eventId) return { ok: false, motivo: 'sem_id' };

    // O Meta só aceita compra "de site" com o navegador de quem comprou.
    const userAgent = texto(compra.userAgent, 500);
    if (!userAgent) return { ok: false, motivo: 'sem_navegador' };

    const pessoa: Record<string, unknown> = { client_user_agent: userAgent };

    const email = texto(compra.email, 320).toLowerCase();
    if (email.includes('@')) pessoa.em = [embaralhar(email)];

    let telefone = soDigitos(compra.telefone);
    if (telefone.length >= 10 && telefone.length <= 11) telefone = `55${telefone}`;
    if (telefone.length >= 12) {
      pessoa.ph = [embaralhar(telefone)];
      if (telefone.startsWith('55')) pessoa.country = [embaralhar('br')];
    }

    const partes = texto(compra.nome, 200).toLowerCase().split(' ').filter(Boolean);
    if (partes.length > 0) pessoa.fn = [embaralhar(partes[0])];
    if (partes.length > 1) pessoa.ln = [embaralhar(partes[partes.length - 1])];

    if (!pessoa.em && !pessoa.ph) return { ok: false, motivo: 'sem_dados_da_pessoa' };

    const ip = primeiroIp(compra.ip);
    if (ip && ip !== '127.0.0.1') pessoa.client_ip_address = ip;
    const fbp = texto(compra.fbp, 300);
    if (fbp.startsWith('fb.')) pessoa.fbp = fbp;
    const fbc = texto(compra.fbc, 300);
    if (fbc.startsWith('fb.')) pessoa.fbc = fbc;

    const momento = compra.quando ? new Date(compra.quando).getTime() : Date.now();
    const agora = Date.now();
    // O Meta recusa data no futuro ou com mais de 7 dias.
    const segundos = Math.floor(
      (Number.isFinite(momento) && momento <= agora && agora - momento < 6 * 24 * 60 * 60 * 1000 ? momento : agora) / 1000
    );

    const valor = Number(compra.valor);
    const corpo: Record<string, unknown> = {
      data: [
        {
          event_name: 'Purchase',
          event_time: segundos,
          event_id: eventId,
          action_source: 'website',
          event_source_url: texto(compra.urlOrigem, 500) || 'https://agendeifacil.com/',
          user_data: pessoa,
          custom_data: {
            currency: 'BRL',
            value: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : 0,
            content_name: `Plano ${texto(compra.plano, 60) || 'Agendei Fácil'}`,
            content_type: 'product',
          },
        },
      ],
    };
    // Só para conferir na tela "Testar eventos" do Meta. Deixar vazio no dia a dia.
    const codigoDeTeste = texto(process.env.META_TEST_EVENT_CODE, 60);
    if (codigoDeTeste) corpo.test_event_code = codigoDeTeste;

    const pixel = texto(process.env.META_PIXEL_ID, 40) || META_PIXEL_ID;
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), LIMITE_MS);
    try {
      const resposta = await fetch(`https://graph.facebook.com/${VERSAO_API}/${pixel}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A chave vai no corpo (não no endereço) para não aparecer em registro nenhum.
        body: JSON.stringify({ ...corpo, access_token: chave }),
        signal: controle.signal,
      });
      if (!resposta.ok) {
        let detalhe = `http ${resposta.status}`;
        try {
          const erro: any = await resposta.json();
          detalhe = texto(erro?.error?.error_user_msg || erro?.error?.message || detalhe, 300);
        } catch {
          // fica só o número do erro
        }
        console.warn('[meta/compra] aviso recusado pelo Meta:', detalhe);
        return { ok: false, motivo: 'recusado', detalhe };
      }
      console.log('[meta/compra] compra avisada ao Meta:', eventId);
      return { ok: true };
    } finally {
      clearTimeout(relogio);
    }
  } catch (error: any) {
    const detalhe = texto(error?.name === 'AbortError' ? 'demorou demais' : error?.message || error, 300);
    console.warn('[meta/compra] aviso não enviado:', detalhe);
    return { ok: false, motivo: 'erro', detalhe };
  }
}

/** Lê com cuidado os "carimbos" do pixel que o navegador mandou junto com o cadastro. */
export function lerCarimbosDoMeta(bruto: unknown): { fbp?: string; fbc?: string; url?: string } {
  const saida: { fbp?: string; fbc?: string; url?: string } = {};
  if (!bruto || typeof bruto !== 'object') return saida;
  const dados = bruto as Record<string, unknown>;
  const fbp = texto(dados.fbp, 300);
  if (fbp.startsWith('fb.')) saida.fbp = fbp;
  const fbc = texto(dados.fbc, 300);
  if (fbc.startsWith('fb.')) saida.fbc = fbc;
  const url = texto(dados.url, 500);
  if (url.startsWith('https://')) saida.url = url;
  return saida;
}

/**
 * Compra feita pelo cadastro do site (/cadastroag, Mercado Pago): avisa o Meta usando os dados
 * que já ficam guardados no pedido (`site_registration_checkouts`). Chamar SÓ quando a conta
 * acabou de ser criada. Nunca lança erro.
 */
export async function avisarCompraDoCadastroSite(
  checkoutId: string,
  checkout: Record<string, any> | null | undefined,
  plano: { label?: string; amountCents?: number } | null | undefined
): Promise<ResultadoAvisoMeta> {
  try {
    const pedido = checkout || {};
    const carimbos = lerCarimbosDoMeta(pedido.metadata?.meta_pixel);
    const centavos = Number(pedido.amount_cents) > 0 ? Number(pedido.amount_cents) : Number(plano?.amountCents) || 0;
    return await avisarCompraAoMeta({
      eventId: idCompraSite(checkoutId),
      valor: centavos / 100,
      plano: plano?.label || null,
      email: pedido.email,
      telefone: pedido.client_whatsapp,
      nome: pedido.client_name,
      ip: pedido.ip_address,
      userAgent: pedido.user_agent,
      fbp: carimbos.fbp,
      fbc: carimbos.fbc,
      urlOrigem: carimbos.url || 'https://agendeifacil.com/cadastroag',
    });
  } catch {
    return { ok: false, motivo: 'erro' };
  }
}
