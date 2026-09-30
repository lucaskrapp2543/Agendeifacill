/**
 * Helpers de JID/conteúdo iguais aos do Baileys, reimplementados aqui para este
 * módulo não depender do pacote (que não carrega fora do Linux) e poder ser
 * testado sozinho.
 */
const isJidGroup = (jid: string) => jid.endsWith('@g.us');
const isJidBroadcast = (jid: string) => jid.endsWith('@broadcast');
const isJidStatusBroadcast = (jid: string) => jid === 'status@broadcast';
const isJidNewsletter = (jid: string) => jid.endsWith('@newsletter');
/** Mesma regra do Baileys: primeira chave "conversation" ou "*Message" (exceto distribuição de chave). */
const getContentType = (content: any): string | undefined => {
  if (!content || typeof content !== 'object') return undefined;
  return Object.keys(content).find((k) => (k === 'conversation' || k.includes('Message')) && k !== 'senderKeyDistributionMessage');
};

/**
 * MENSAGEM DE APRESENTAÇÃO
 * ------------------------
 * Quando um cliente manda qualquer mensagem para o WhatsApp do estabelecimento, o
 * sistema responde sozinho com o link de agendamento (completa / simples / chat).
 *
 * Isto roda dentro do evento `messages.upsert` do Baileys. Regras inegociáveis:
 *   - NUNCA lançar erro para fora (um erro solto aqui derruba o processo inteiro e
 *     desconecta o WhatsApp de todos os estabelecimentos);
 *   - NUNCA responder duas vezes ao mesmo cliente em 12 horas (trava no banco);
 *   - NUNCA responder ao próprio dono, grupo, status, canal, histórico ou mensagem velha;
 *   - a marca "já apresentei" é gravada ANTES de enviar. Se não conseguir gravar,
 *     não envia: melhor um cliente sem apresentação do que quatro apresentações.
 *
 * Ordem das checagens (da mais barata para a mais cara):
 *   1. é grupo / status / canal?           -> ignora
 *   2. type !== 'notify'?                  -> ignora (histórico)
 *   3. fromMe?                             -> ignora (o dono escrevendo)
 *   4. sem conteúdo (não decifrou)?        -> ignora
 *   5. não é mensagem de gente?            -> ignora (reação, edição, enquete...)
 *   6. mesma mensagem já vista?            -> ignora (WhatsApp reentrega)
 *   7. mensagem com mais de 15 min?        -> ignora (chegou com o serviço fora)
 *   8. traduz @lid -> número (canônico)
 *   9. já tem apresentação em andamento?   -> ignora
 *  10. já apresentado nas últimas 12 h?    -> ignora
 *  11. passou de 20 por minuto?            -> ignora (é defeito, não cliente)
 *  12. interruptor desligado?              -> ignora (lido do banco na hora, sem cache)
 *  13. GRAVA a marca
 *  14. ENVIA
 */

export type PresentationReplyDeps = {
  getSupabaseAdmin: () => any;
  publicBaseUrl?: string;
};

const WINDOW_HOURS = 12;
const MAX_MESSAGE_AGE_MS = 15 * 60 * 1000;
const MAX_PER_MINUTE = 20;
const SEEN_IDS_CAP = 2000;
const HUMAN_DELAY_MS = 1500;

/** Tipos que chegam pelo mesmo evento mas não são "alguém te chamando". */
const NOT_A_HUMAN_MESSAGE = new Set([
  'protocolMessage',
  'reactionMessage',
  'pollUpdateMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'keepInChatMessage',
  'pinInChatMessage',
  'encReactionMessage',
  'editedMessage',
]);

const inFlight = new Set<string>();
const seenByUser = new Map<string, { list: string[]; set: Set<string> }>();
const perMinute = new Map<string, { windowStart: number; count: number }>();
let undecipherable = { count: 0, windowStart: Date.now() };

const onlyDigits = (value: string) => String(value || '').replace(/\D/g, '');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function alreadySeen(userId: string, messageId: string): boolean {
  if (!messageId) return false;
  let bucket = seenByUser.get(userId);
  if (!bucket) {
    bucket = { list: [], set: new Set() };
    seenByUser.set(userId, bucket);
  }
  if (bucket.set.has(messageId)) return true;
  bucket.set.add(messageId);
  bucket.list.push(messageId);
  if (bucket.list.length > SEEN_IDS_CAP) {
    const oldest = bucket.list.shift();
    if (oldest) bucket.set.delete(oldest);
  }
  return false;
}

function overPerMinuteLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = perMinute.get(userId);
  if (!bucket || now - bucket.windowStart >= 60_000) {
    perMinute.set(userId, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_PER_MINUTE;
}

function noteUndecipherable() {
  const now = Date.now();
  if (now - undecipherable.windowStart >= 60_000) {
    if (undecipherable.count > 0) {
      console.info(`[whatsapp/apresentacao] ${undecipherable.count} mensagem(ns) sem conteúdo (não decifradas) no último minuto`);
    }
    undecipherable = { count: 0, windowStart: now };
  }
  undecipherable.count += 1;
}

function messageTimestampMs(msg: any): number {
  const raw = msg?.messageTimestamp;
  let seconds = 0;
  if (typeof raw === 'number') seconds = raw;
  else if (raw && typeof raw.toNumber === 'function') seconds = Number(raw.toNumber());
  else if (raw && typeof raw.low === 'number') seconds = Number(raw.low);
  else seconds = Number(raw || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

/** @lid -> número (o mesmo cliente não pode contar duas vezes: uma como número, outra como @lid). */
async function canonicalNumber(socket: any, jid: string): Promise<string> {
  const value = String(jid || '');
  if (value.endsWith('@lid')) {
    try {
      const pn = await socket?.signalRepository?.lidMapping?.getPNForLID?.(value);
      if (pn) return onlyDigits(String(pn));
    } catch {
      // sem mapa ainda: o próprio LID também é estável
    }
    return onlyDigits(value.split('@')[0]);
  }
  return onlyDigits(value.split('@')[0]);
}

function buildLink(baseUrl: string, code: string, choice: string, flags: { chat: boolean; af: boolean }): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (choice === 'chat' && flags.chat) return `${base}/booking/${code}/chat`;
  if (choice === 'af' && flags.af) return `${base}/booking/${code}/af`;
  return `${base}/booking/${code}`;
}

function buildText(establishmentName: string, link: string): string {
  const nome = String(establishmentName || '').trim() || 'nosso estabelecimento';
  return (
    `Olá! 👋 Bem-vindo(a) à *${nome}*!\n` +
    'Agende seu horário pelo nosso link, é rápido: você escolhe o profissional, o serviço e o horário, e já fica confirmado:\n' +
    `${link}\n` +
    'Qualquer dúvida é só chamar por aqui. 😊'
  );
}

function isMissingRelation(error: any): boolean {
  const code = String(error?.code || '').trim();
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === '42703' || msg.includes('does not exist') || msg.includes('schema cache');
}

async function handleOne(deps: PresentationReplyDeps, userId: string, socket: any, msg: any): Promise<void> {
  const jid = String(msg?.key?.remoteJid || '').trim();
  if (!jid) return;

  // 1) grupo / status / canal: em silêncio
  if (isJidGroup(jid) || isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid)) return;
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return;

  // 3) o próprio dono escrevendo
  if (msg?.key?.fromMe) return;

  // 4) sem conteúdo (stub / não decifrou)
  if (!msg?.message) {
    noteUndecipherable();
    return;
  }

  // 5) não é mensagem de gente
  const contentType = getContentType(msg.message);
  if (!contentType || NOT_A_HUMAN_MESSAGE.has(String(contentType))) return;

  // 6) reentrega
  const messageId = String(msg?.key?.id || '').trim();
  if (alreadySeen(userId, messageId)) return;

  // 7) mensagem velha (serviço estava fora)
  const tsMs = messageTimestampMs(msg);
  if (tsMs > 0 && Date.now() - tsMs > MAX_MESSAGE_AGE_MS) return;

  // 8) número canônico
  const phone = await canonicalNumber(socket, jid);
  if (!phone) return;

  // 9) uma apresentação por vez, por contato
  const lockKey = `${userId}|${phone}`;
  if (inFlight.has(lockKey)) return;
  inFlight.add(lockKey);
  try {
    const supabaseAdmin = deps.getSupabaseAdmin();
    if (!supabaseAdmin) return;

    // 12) interruptor + link (lido do banco NA HORA — o dono desliga e para na hora)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('whatsapp_automation_settings')
      .select('presentation_enabled,presentation_link')
      .eq('user_id', userId)
      .maybeSingle();
    if (settingsError) {
      if (isMissingRelation(settingsError)) {
        console.warn('[whatsapp/apresentacao] pulada: migration da apresentação ainda não aplicada (colunas ausentes)');
        return;
      }
      console.warn('[whatsapp/apresentacao] pulada: erro ao ler configuração', String(settingsError?.message || settingsError));
      return;
    }
    if (settings && settings.presentation_enabled === false) {
      console.info(`[whatsapp/apresentacao] pulada para ${phone}: mensagem de apresentação desligada (user ${userId})`);
      return;
    }
    const linkChoice = String(settings?.presentation_link || 'chat').trim().toLowerCase();

    // 10) já apresentado nas últimas 12h?
    const { data: lastRow, error: lastError } = await supabaseAdmin
      .from('whatsapp_presentation_log')
      .select('sent_at')
      .eq('user_id', userId)
      .eq('phone', phone)
      .maybeSingle();
    if (lastError) {
      // Sem a tabela de controle não dá para garantir "sem spam": não envia.
      console.warn('[whatsapp/apresentacao] pulada: sem tabela de controle (rode a migration)', String(lastError?.message || lastError));
      return;
    }
    const lastSentAt = lastRow?.sent_at ? new Date(lastRow.sent_at).getTime() : 0;
    if (lastSentAt && Date.now() - lastSentAt < WINDOW_HOURS * 3_600_000) {
      console.info(`[whatsapp/apresentacao] pulada para ${phone}: já apresentado nas últimas ${WINDOW_HOURS}h (user ${userId})`);
      return;
    }

    // 11) teto por minuto (acima disso é laço, não movimento)
    if (overPerMinuteLimit(userId)) {
      console.warn(`[whatsapp/apresentacao] pulada para ${phone}: mais de ${MAX_PER_MINUTE} apresentações/min (user ${userId}) — possível laço`);
      return;
    }

    // Estabelecimento do dono (nome + código do link)
    const { data: est, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id,code,name,booking_chat_enabled,booking_simple_page_enabled,is_deleted,created_at')
      .eq('owner_id', userId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (estError || !est?.code) {
      console.warn(`[whatsapp/apresentacao] pulada para ${phone}: estabelecimento não encontrado para user ${userId}`, String(estError?.message || ''));
      return;
    }

    const baseUrl = String(deps.publicBaseUrl || process.env.PUBLIC_SITE_URL || 'https://agendeifacil.com').trim();
    const link = buildLink(baseUrl, String(est.code), linkChoice, {
      chat: est.booking_chat_enabled !== false,
      af: est.booking_simple_page_enabled === true,
    });
    const text = buildText(String(est.name || ''), link);

    // 13) GRAVA a marca antes de enviar (INSERT ... ON CONFLICT DO UPDATE numa consulta só)
    const { error: markError } = await supabaseAdmin
      .from('whatsapp_presentation_log')
      .upsert({ user_id: userId, phone, sent_at: new Date().toISOString() }, { onConflict: 'user_id,phone' });
    if (markError) {
      console.warn(`[whatsapp/apresentacao] pulada para ${phone}: não consegui gravar a marca`, String(markError?.message || markError));
      return;
    }

    // 14) ENVIA — responde no mesmo endereço que chegou (já vem no formato certo, @lid ou número)
    await sleep(HUMAN_DELAY_MS);
    if (!socket?.user) {
      console.warn(`[whatsapp/apresentacao] não enviada para ${phone}: sessão caiu antes do envio (user ${userId})`);
      return;
    }
    await socket.sendMessage(jid, { text });
    console.info(`[whatsapp/apresentacao] enviada -> ${jid} (user ${userId}, link ${linkChoice})`);
  } catch (error: any) {
    console.warn(`[whatsapp/apresentacao] falha para ${jid} (user ${userId}):`, String(error?.message || error));
  } finally {
    inFlight.delete(lockKey);
  }
}

/** Ponto de entrada: recebe o evento `messages.upsert` de UMA sessão. Nunca lança. */
export async function handlePresentationInbound(deps: PresentationReplyDeps, userId: string, socket: any, upsert: any): Promise<void> {
  try {
    // 2) só o que acabou de chegar; 'append' é histórico
    if (!upsert || upsert.type !== 'notify') return;
    const messages = Array.isArray(upsert.messages) ? upsert.messages : [];
    for (const msg of messages) {
      await handleOne(deps, userId, socket, msg);
    }
  } catch (error: any) {
    console.warn('[whatsapp/apresentacao] handler falhou:', String(error?.message || error));
  }
}
