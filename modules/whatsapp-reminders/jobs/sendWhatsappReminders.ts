import { createClient } from '@supabase/supabase-js';
import { decryptApiKey } from '../server/crypto';
import { sendWhatsappByProvider } from '../server/providerClient';

type DueReminderRow = {
  appointment_id: string;
  establishment_id: string;
  client_whatsapp: string;
  client_name: string;
  establishment_name: string;
  service_name: string;
  professional_name: string;
  appointment_date: string; // yyyy-mm-dd
  appointment_time: string; // HH:mm:ss (ou HH:mm)
  remind_before_minutes: number;
  message_template: string | null;
  provider: string;
  api_key_encrypted: string;
  instance_phone_number: string;
  instance_status: string;
};

function getMetaMessageIdFromSendResponse(data: unknown): string | null {
  const maybeObj = (data as any) || null;
  const first = maybeObj?.messages?.[0];
  const id = String(first?.id || '').trim();
  return id || null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => ctx[key] ?? `{${key}}`);
}

function defaultTemplate() {
  return (
    'Olá {client_name}! 👋\n' +
    'Lembrete do seu agendamento em {establishment_name}.\n\n' +
    '📅 {appointment_date}\n' +
    '⏰ {appointment_time}\n' +
    '✂️ {service_name}\n' +
    '👨‍💼 {professional_name}\n\n' +
    'Se precisar reagendar, fale com a barbearia.'
  );
}

function formatReminderDateLabel(appointmentDate: string, timezone: string): string {
  const raw = String(appointmentDate || '').trim();
  if (!raw) return 'Hoje';

  try {
    const parts = raw.split('-');
    if (parts.length !== 3) return raw;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return raw;

    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayInTz = fmt.format(now); // yyyy-mm-dd
    const target = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    if (target === todayInTz) return 'Hoje';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
  } catch {
    return raw;
  }
}

function normalizePhoneCandidates(raw: string): string[] {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return [];
  const set = new Set<string>();
  set.add(digits);
  // Brasil: se veio sem DDI, tentar prefixar 55 (10 ou 11 dígitos)
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    set.add(`55${digits}`);
  }
  // Se veio com 55 mas talvez o provider espere sem, tentar remover
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    set.add(digits.slice(2));
  }
  return Array.from(set).filter(Boolean);
}

function computeNextAttemptAt(attemptCount: number): string | null {
  // backoff: 3min, 7min, 15min, 30min...
  const minutes = attemptCount <= 1 ? 3 : attemptCount === 2 ? 7 : attemptCount === 3 ? 15 : 30;
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toISOString();
}

function isMetaProvider(provider: string): boolean {
  const value = String(provider || '').trim().toLowerCase();
  return value === 'meta' || value === 'meta_cloud' || value === 'meta_cloud_api' || value === 'cloud_api';
}

export async function runSendWhatsappRemindersOnce() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const wasenderBaseUrl = process.env.WASENDER_BASE_URL;

  const delayMs = Number(process.env.WHATSAPP_REMINDERS_DELAY_MS ?? 650);
  const tz = process.env.WHATSAPP_REMINDERS_TIMEZONE ?? 'America/Sao_Paulo';

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o job.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('whatsapp_get_due_reminders', { p_timezone: tz });
  if (error) {
    console.error('❌ Erro ao buscar lembretes pendentes (RPC):', error);
    throw error;
  }

  const rows = ((data as unknown) as DueReminderRow[]) || [];
  if (rows.length === 0) {
    console.log('ℹ️ Nenhum lembrete pendente nesta execução.');
    return { processed: 0, sent: 0, failed: 0 };
  }

  console.log(`🔎 Encontrados ${rows.length} lembretes pendentes (janela ~5min).`);

  let sent = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      const apiKey = decryptApiKey(r.api_key_encrypted);

      const template = (r.message_template || '').trim() || defaultTemplate();
      const appointmentDateLabel = formatReminderDateLabel(r.appointment_date, tz);
      const appointmentTimeLabel = r.appointment_time?.slice(0, 5) || r.appointment_time;
      const msg = renderTemplate(template, {
        client_name: r.client_name || 'cliente',
        establishment_name: r.establishment_name || 'a barbearia',
        service_name: r.service_name || 'serviço',
        professional_name: r.professional_name || 'profissional',
        appointment_date: appointmentDateLabel,
        appointment_time: appointmentTimeLabel,
      });
      const useMetaTemplate = isMetaProvider(r.provider);
      const metaTemplateName = String(process.env.META_TEMPLATE_APPOINTMENT_REMINDER || 'lembrete_agendamento_v1').trim();

      const toCandidates = normalizePhoneCandidates(r.client_whatsapp);
      if (toCandidates.length === 0) {
        throw new Error('Destino inválido (client_whatsapp vazio/sem dígitos).');
      }

      let sendRes = { ok: false, status: 0, data: undefined as any, errorText: undefined as any };
      let usedTo = toCandidates[0];
      for (const cand of toCandidates) {
        usedTo = cand;
        sendRes = await sendWhatsappByProvider({
          provider: String(r.provider || 'wasender'),
          encryptedApiKeyDecrypted: apiKey,
          wasenderBaseUrl,
          metaPhoneNumberId: String(r.instance_phone_number || '').trim(),
          to: cand,
          text: msg,
          metaTemplate:
            useMetaTemplate && metaTemplateName
              ? {
                  name: metaTemplateName,
                  languageCode: 'pt_BR',
                  parameters: [
                    r.client_name || 'cliente',
                    r.establishment_name || 'a barbearia',
                    appointmentDateLabel,
                    String(appointmentTimeLabel || ''),
                    r.service_name || 'serviço',
                    r.professional_name || 'profissional',
                  ],
                }
              : undefined,
        });
        if (sendRes.ok) break;
      }

      const status = sendRes.ok ? 'sent' : 'failed';
      const providerResponse = JSON.stringify(sendRes.data ?? sendRes.errorText ?? null);
      const attemptInc = 1;
      const nextAttemptAt = sendRes.ok ? null : computeNextAttemptAt(attemptInc);
      const metaMessageId = useMetaTemplate && sendRes.ok ? getMetaMessageIdFromSendResponse(sendRes.data) : null;

      // ✅ UPSERT para permitir retries (tabela tem UNIQUE(appointment_id))
      const { data: existingLog } = await supabase
        .from('whatsapp_reminder_logs')
        .select('attempt_count')
        .eq('appointment_id', r.appointment_id)
        .maybeSingle();

      const nextAttemptCount = Number((existingLog as any)?.attempt_count || 0) + 1;
      const { error: logErr } = await supabase.from('whatsapp_reminder_logs').upsert(
        {
          establishment_id: r.establishment_id,
          appointment_id: r.appointment_id,
          phone_to: String(usedTo || ''),
          message: msg,
          status,
          provider_response: providerResponse,
          meta_message_id: metaMessageId,
          meta_status: sendRes.ok && useMetaTemplate ? 'sent' : null,
          meta_status_updated_at: sendRes.ok && useMetaTemplate ? new Date().toISOString() : null,
          attempt_count: nextAttemptCount,
          last_attempt_at: new Date().toISOString(),
          next_attempt_at: sendRes.ok ? null : computeNextAttemptAt(nextAttemptCount),
          last_error: sendRes.ok ? null : `status=${sendRes.status} body=${providerResponse?.slice(0, 500)}`,
        } as any,
        { onConflict: 'appointment_id' }
      );

      if (logErr) {
        // Anti-duplicidade: se já existe log (unique appointment_id), não reenviar (já enviamos acima).
        // Preferimos não falhar a execução inteira por isso.
        console.warn('⚠️ Falha ao registrar log (pode ser duplicidade):', logErr);
      }

      if (sendRes.ok) {
        sent += 1;
        console.log(`✅ Enviado: appointment_id=${r.appointment_id} to=${usedTo}`);
      } else {
        failed += 1;
        console.warn(
          `❌ Falhou: appointment_id=${r.appointment_id} to=${usedTo} status=${sendRes.status} resp=${providerResponse?.slice(0, 300)}`
        );
      }
    } catch (e) {
      failed += 1;
      console.error('❌ Erro ao processar lembrete:', {
        appointment_id: r.appointment_id,
        establishment_id: r.establishment_id,
        error: String(e),
      });

      // Tentar registrar falha no log (sem quebrar tudo)
      try {
        await supabase.from('whatsapp_reminder_logs').upsert(
          {
            establishment_id: r.establishment_id,
            appointment_id: r.appointment_id,
            phone_to: String(r.client_whatsapp || ''),
            message: '[ERRO AO GERAR/ENVIAR MENSAGEM]',
            status: 'failed',
            provider_response: JSON.stringify({ error: String(e) }),
            attempt_count: 1,
            last_attempt_at: new Date().toISOString(),
            next_attempt_at: computeNextAttemptAt(1),
            last_error: String(e).slice(0, 500),
          } as any,
          { onConflict: 'appointment_id' }
        );
      } catch {
        // ignore
      }
    }

    // Delay entre envios (evita disparar tudo no mesmo segundo)
    if (delayMs > 0) await sleep(delayMs);
  }

  return { processed: rows.length, sent, failed };
}

// Execução direta via tsx (ESM)
const isDirectRun = (() => {
  const argv1 = process.argv?.[1] || '';
  return argv1.includes('sendWhatsappReminders');
})();

if (isDirectRun) {
  runSendWhatsappRemindersOnce()
    .then(res => {
      console.log('🏁 Job finalizado:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Job falhou:', err);
      process.exit(1);
    });
}


