/**
 * Criação da conta em /cadastrar — SÓ para quem tem pagamento confirmado na Cakto.
 *
 * O pagamento é reconferido aqui no servidor (tabela `cakto_orders`, gravada pelo aviso
 * da Cakto) e marcado como usado: o mesmo pagamento não vira duas contas.
 * A senha vai direto para o login do Supabase. Ela NÃO é guardada em nenhuma tabela.
 */
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { emailValido, normalizarEmail } from '../../src/lib/caktoPayload';
import { criarContaComPagamentoCakto, type CodigoCadastroCakto } from '../../src/lib/caktoProcessing';
import { avisarCompraAoMeta, lerCarimbosDoMeta } from '../../src/lib/metaConversionsApi';
import { idCompraCakto } from '../../src/lib/metaPixelConfig';
import { limparTelefone, paisTelefone, telefoneCompleto, validarTelefone } from '../../src/lib/telefonePais';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const RESPOSTAS: Record<CodigoCadastroCakto, { status: number; mensagem: string }> = {
  ok: { status: 200, mensagem: 'Conta criada!' },
  pagamento_nao_encontrado: {
    status: 404,
    mensagem:
      'Não encontramos pagamento confirmado com esse e-mail. Confira se é o mesmo e-mail que você usou para pagar. Se acabou de pagar, espere 1 minuto e toque de novo.',
  },
  pagamento_ja_usado: {
    status: 409,
    mensagem: 'Esse pagamento já foi usado para criar uma conta. É só entrar com o seu e-mail e a sua senha.',
  },
  pagamento_estornado: {
    status: 402,
    mensagem: 'Esse pagamento foi cancelado ou devolvido, por isso a conta não pode ser criada. Fale com o suporte.',
  },
  email_ja_tem_conta: {
    status: 409,
    mensagem: 'Esse e-mail já tem uma conta no Agendei Fácil. Fale com o suporte no WhatsApp para ativarmos o seu plano nela.',
  },
  em_andamento: {
    status: 409,
    mensagem: 'Sua conta já está sendo criada. Espere alguns segundos e tente entrar com o seu e-mail e a sua senha.',
  },
  erro: {
    status: 500,
    mensagem: 'Não foi possível criar a conta agora. Tente de novo em instantes. Se continuar, fale com o suporte.',
  },
};

const ipValido = (valor: string): string | null => {
  const ip = String(valor || '').split(',')[0].trim();
  if (!ip || ip.length > 45) return null;
  for (const c of ip) {
    const ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') || c === '.' || c === ':';
    if (!ok) return null;
  }
  return ip;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, mensagem: 'Method Not Allowed' }, { Allow: 'POST' });
  }
  if (!supabaseAdmin) {
    return json(500, { ok: false, code: 'erro', mensagem: RESPOSTAS.erro.mensagem });
  }

  const body = parseJsonBody<any>(event) || {};
  const email = normalizarEmail(body.email);
  const senha = String(body.senha || '');
  const nomeBarbearia = String(body.nomeBarbearia || '').trim().split('  ').join(' ');
  const pais = paisTelefone(body.pais);
  const telefone = limparTelefone(body.telefone, pais.code);

  if (!emailValido(email)) {
    return json(400, { ok: false, code: 'dados_invalidos', campo: 'email', mensagem: 'Digite o e-mail que você usou para pagar.' });
  }
  if (senha.length < 6) {
    return json(400, { ok: false, code: 'dados_invalidos', campo: 'senha', mensagem: 'A senha precisa ter pelo menos 6 caracteres.' });
  }
  if (senha !== senha.trim()) {
    return json(400, { ok: false, code: 'dados_invalidos', campo: 'senha', mensagem: 'A senha não pode começar nem terminar com espaço.' });
  }
  if (senha.length > 72) {
    return json(400, { ok: false, code: 'dados_invalidos', campo: 'senha', mensagem: 'A senha pode ter no máximo 72 caracteres.' });
  }
  if (nomeBarbearia.length < 2 || nomeBarbearia.length > 80) {
    return json(400, { ok: false, code: 'dados_invalidos', campo: 'nomeBarbearia', mensagem: 'Digite o nome da sua barbearia.' });
  }
  const conferenciaTelefone = validarTelefone(telefone, pais.code);
  if (!conferenciaTelefone.ok) {
    return json(400, { ok: false, code: 'dados_invalidos', campo: 'telefone', mensagem: conferenciaTelefone.erro });
  }

  try {
    const resultado = await criarContaComPagamentoCakto(supabaseAdmin, {
      email,
      password: senha,
      establishmentName: nomeBarbearia,
      whatsapp: telefoneCompleto(telefone, pais.code),
      ip: ipValido(String(event.headers?.['x-nf-client-connection-ip'] || event.headers?.['x-forwarded-for'] || '')),
      userAgent: String(event.headers?.['user-agent'] || '').slice(0, 400) || null,
    });

    // Aviso de compra para o Meta (pixel). Só um aviso a mais: a conta JÁ está criada e nada aqui desfaz isso.
    let compraMeta: { eventId: string; valor: number } | null = null;
    try {
      if (resultado.ok && resultado.orderId) {
        compraMeta = { eventId: idCompraCakto(resultado.orderId), valor: Number(resultado.amountCents || 0) / 100 };
        const carimbos = lerCarimbosDoMeta(body.meta_pixel);
        await avisarCompraAoMeta({
          eventId: compraMeta.eventId,
          valor: compraMeta.valor,
          plano: 'Diamante',
          email,
          telefone: telefoneCompleto(telefone, pais.code),
          ip: ipValido(String(event.headers?.['x-nf-client-connection-ip'] || event.headers?.['x-forwarded-for'] || '')),
          userAgent: String(event.headers?.['user-agent'] || '').slice(0, 400) || null,
          fbp: carimbos.fbp,
          fbc: carimbos.fbc,
          urlOrigem: 'https://agendeifacil.com/cadastrar',
        });
      }
    } catch {
      // o aviso nunca atrapalha a criação da conta
    }

    const resposta = RESPOSTAS[resultado.code] || RESPOSTAS.erro;
    if (!resultado.ok && resultado.code === 'erro') {
      console.error('[cakto/cadastro] erro ao criar conta:', resultado.detalhe || '(sem detalhe)');
    }
    return json(resposta.status, {
      ok: resultado.ok,
      code: resultado.code,
      mensagem: resposta.mensagem,
      ...(resultado.ok ? { establishmentCode: resultado.establishmentCode } : {}),
      ...(resultado.ok && compraMeta ? { compraMeta } : {}),
    });
  } catch (error: any) {
    console.error('[cakto/cadastro] erro inesperado:', String(error?.message || error));
    return json(500, { ok: false, code: 'erro', mensagem: RESPOSTAS.erro.mensagem });
  }
};
