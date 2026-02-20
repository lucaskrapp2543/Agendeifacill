import { createClient } from '@supabase/supabase-js';
import { format, parseISO } from 'date-fns';
import { decryptApiKey } from '../server/crypto';
import { wasenderSendMessage } from '../server/wasenderClient';

type ExpiredSubscriptionRow = {
  id: string;
  establishment_id: string;
  end_date: string;
  subscriber_name: string | null;
  subscriber_whatsapp: string | null;
  client_whatsapp: string | null;
  subscriptions?: { name?: string | null } | null;
  establishments?: { name?: string | null; code?: string | null } | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

function normalizePhoneCandidates(raw: string): string[] {
  const digits = normalizePhoneDigits(raw);
  if (!digits) return [];
  const set = new Set<string>();
  set.add(digits);
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    set.add(`55${digits}`);
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    set.add(digits.slice(2));
  }
  return Array.from(set).filter(Boolean);
}

function formatBrDate(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy');
  } catch {
    return String(value || '');
  }
}

function getNowInTimezoneParts(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const dateIso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, dateIso };
}

function isInsideWindow(hour: number, minute: number, targetHour: number, targetMinute: number, windowMinutes: number) {
  const current = hour * 60 + minute;
  const target = targetHour * 60 + targetMinute;
  return Math.abs(current - target) <= Math.max(0, windowMinutes);
}

export async function runSendExpiredSubscriptionRemindersOnce() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const wasenderBaseUrl = process.env.WASENDER_BASE_URL;
  const timezone = process.env.EXPIRED_SUBSCRIPTIONS_TIMEZONE || 'America/Sao_Paulo';
  const sendHour = Number(process.env.EXPIRED_SUBSCRIPTIONS_SEND_HOUR ?? 12);
  const sendMinute = Number(process.env.EXPIRED_SUBSCRIPTIONS_SEND_MINUTE ?? 0);
  const windowMinutes = Number(process.env.EXPIRED_SUBSCRIPTIONS_SEND_WINDOW_MINUTES ?? 20);
  const delayMs = Number(process.env.EXPIRED_SUBSCRIPTIONS_DELAY_MS ?? 650);

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o job.');
  }
  if (!wasenderBaseUrl) {
    throw new Error('WASENDER_BASE_URL é obrigatório (ex.: https://wasenderapi.com).');
  }

  const now = getNowInTimezoneParts(timezone);
  if (!isInsideWindow(now.hour, now.minute, sendHour, sendMinute, windowMinutes)) {
    return {
      skippedBySchedule: true,
      now: { hour: now.hour, minute: now.minute, timezone, date: now.dateIso },
      target: { hour: sendHour, minute: sendMinute, windowMinutes },
      processed: 0,
      sent: 0,
      failed: 0,
    };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rowsData, error: rowsError } = await supabase
    .from('client_subscriptions')
    .select(
      'id, establishment_id, end_date, subscriber_name, subscriber_whatsapp, client_whatsapp, subscriptions(name), establishments(name, code)'
    )
    .lt('end_date', now.dateIso)
    .order('end_date', { ascending: true })
    .limit(300);

  if (rowsError) {
    throw rowsError;
  }

  const rows = ((rowsData as unknown) as ExpiredSubscriptionRow[]) || [];
  if (rows.length === 0) {
    return { skippedBySchedule: false, processed: 0, sent: 0, failed: 0 };
  }

  const clientSubscriptionIds = rows.map((r) => String(r.id)).filter(Boolean);
  const establishmentIds = Array.from(new Set(rows.map((r) => String(r.establishment_id || '')).filter(Boolean)));

  const { data: sentTodayData, error: sentTodayError } = await supabase
    .from('expired_subscription_whatsapp_logs')
    .select('client_subscription_id')
    .eq('sent_date', now.dateIso)
    .in('client_subscription_id', clientSubscriptionIds);

  if (sentTodayError) {
    throw sentTodayError;
  }
  const alreadySentToday = new Set<string>(((sentTodayData as any[]) || []).map((x) => String(x.client_subscription_id || '')).filter(Boolean));

  const { data: instancesData, error: instancesError } = await supabase
    .from('whatsapp_instances')
    .select('establishment_id, api_key_encrypted, status')
    .in('establishment_id', establishmentIds)
    .eq('status', 'active');

  if (instancesError) {
    throw instancesError;
  }

  const instanceByEstablishment = new Map<string, { api_key_encrypted: string; status: string }>();
  for (const i of (instancesData as any[]) || []) {
    const estId = String(i.establishment_id || '').trim();
    if (!estId) continue;
    instanceByEstablishment.set(estId, {
      api_key_encrypted: String(i.api_key_encrypted || ''),
      status: String(i.status || ''),
    });
  }

  let sent = 0;
  let failed = 0;
  let processed = 0;

  for (const row of rows) {
    try {
      const clientSubscriptionId = String(row.id || '');
      if (!clientSubscriptionId || alreadySentToday.has(clientSubscriptionId)) {
        continue;
      }
      processed += 1;

      const establishmentId = String(row.establishment_id || '');
      const instance = instanceByEstablishment.get(establishmentId);
      if (!instance?.api_key_encrypted) {
        failed += 1;
        await supabase.from('expired_subscription_whatsapp_logs').upsert({
          establishment_id: establishmentId,
          client_subscription_id: clientSubscriptionId,
          phone_to: null,
          message: '[SEM INSTÂNCIA WHATSAPP ATIVA]',
          status: 'failed',
          provider_response: JSON.stringify({ error: 'Estabelecimento sem instância WhatsApp ativa.' }),
          sent_date: now.dateIso,
        } as any, { onConflict: 'client_subscription_id,sent_date' });
        continue;
      }

      const rawPhone = String(row.subscriber_whatsapp || row.client_whatsapp || '').trim();
      const phoneCandidates = normalizePhoneCandidates(rawPhone);
      if (phoneCandidates.length === 0) {
        failed += 1;
        await supabase.from('expired_subscription_whatsapp_logs').upsert({
          establishment_id: establishmentId,
          client_subscription_id: clientSubscriptionId,
          phone_to: null,
          message: '[SEM TELEFONE VÁLIDO]',
          status: 'failed',
          provider_response: JSON.stringify({ error: 'Assinante sem telefone válido.' }),
          sent_date: now.dateIso,
        } as any, { onConflict: 'client_subscription_id,sent_date' });
        continue;
      }

      const apiKey = decryptApiKey(instance.api_key_encrypted);
      const planName = String(row.subscriptions?.name || 'Plano').trim() || 'Plano';
      const establishmentCode = String(row.establishments?.code || establishmentId).trim();
      const bookingUrl = `https://agendeifacil.com/booking/${establishmentCode}`;
      const dueDateLabel = formatBrDate(String(row.end_date || ''));
      const message =
        `Olá! Passando para lembrar que seu plano (${planName}) venceu em ${dueDateLabel}.\n\n` +
        `Para renovar, acesse ${bookingUrl} e vá na sua assinatura, depois clique no botão "Renovar".\n\n` +
        `É simples, rápido e fácil.`;

      let sendRes = { ok: false, status: 0, data: undefined as any, errorText: undefined as any };
      let usedPhone = phoneCandidates[0];
      for (const candidate of phoneCandidates) {
        usedPhone = candidate;
        sendRes = await wasenderSendMessage({
          baseUrl: wasenderBaseUrl,
          apiKey,
          to: candidate,
          text: message,
        });
        if (sendRes.ok) break;
      }

      if (sendRes.ok) {
        sent += 1;
      } else {
        failed += 1;
      }

      await supabase.from('expired_subscription_whatsapp_logs').upsert({
        establishment_id: establishmentId,
        client_subscription_id: clientSubscriptionId,
        phone_to: usedPhone,
        message,
        status: sendRes.ok ? 'sent' : 'failed',
        provider_response: JSON.stringify(sendRes.data ?? sendRes.errorText ?? null),
        sent_date: now.dateIso,
      } as any, { onConflict: 'client_subscription_id,sent_date' });

      if (delayMs > 0) await sleep(delayMs);
    } catch (rowError) {
      failed += 1;
      console.error('❌ Erro ao processar cobrança de assinatura vencida:', {
        client_subscription_id: row?.id,
        establishment_id: row?.establishment_id,
        error: String((rowError as any)?.message || rowError),
      });
    }
  }

  return {
    skippedBySchedule: false,
    processed,
    sent,
    failed,
    totalExpiredFound: rows.length,
    sentDate: now.dateIso,
  };
}

