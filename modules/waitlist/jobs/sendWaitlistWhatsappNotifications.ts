import { createClient } from '@supabase/supabase-js';
import { decryptApiKey } from '../../whatsapp-reminders/server/crypto';
import { wasenderSendMessage } from '../../whatsapp-reminders/server/wasenderClient';

type PendingOutboxRow = {
  id: string;
  establishment_id: string;
  waitlist_entry_id: string | null;
  phone_to: string;
  message: string;
  whatsapp_instances?: {
    api_key_encrypted: string;
    provider: string;
    phone_number: string;
    status: string;
  } | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSendWaitlistWhatsappNotificationsOnce() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const wasenderBaseUrl = process.env.WASENDER_BASE_URL;
  const delayMs = Number(process.env.WHATSAPP_WAITLIST_DELAY_MS ?? 650);

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o job.');
  }
  if (!wasenderBaseUrl) {
    throw new Error('WASENDER_BASE_URL é obrigatório (ex.: https://wasenderapi.com).');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Buscar pendências + instancia do estabelecimento (módulo whatsapp-reminders)
  // Observação: caso o módulo whatsapp-reminders não esteja instalado, essa query pode falhar.
  const { data, error } = await supabase
    .from('waitlist_whatsapp_outbox')
    .select(
      'id, establishment_id, waitlist_entry_id, phone_to, message, whatsapp_instances:whatsapp_instances!left(api_key_encrypted, provider, phone_number, status)'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('❌ Erro ao buscar outbox (fila):', error);
    throw error;
  }

  const rows = ((data as unknown) as PendingOutboxRow[]) || [];
  if (rows.length === 0) {
    console.log('ℹ️ Nenhuma notificação pendente da fila nesta execução.');
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      const inst = r.whatsapp_instances;
      if (!inst?.api_key_encrypted) {
        throw new Error('Estabelecimento sem whatsapp_instances configurado (api_key_encrypted ausente).');
      }
      if (String(inst.status || '').toLowerCase() !== 'active') {
        throw new Error(`Instância WhatsApp não está ativa (status=${inst.status}).`);
      }

      const apiKey = decryptApiKey(inst.api_key_encrypted);
      const sendRes = await wasenderSendMessage({
        baseUrl: wasenderBaseUrl,
        apiKey,
        to: r.phone_to,
        text: r.message,
      });

      const status = sendRes.ok ? 'sent' : 'failed';

      const { error: updErr } = await supabase
        .from('waitlist_whatsapp_outbox')
        .update({
          status,
          sent_at: sendRes.ok ? new Date().toISOString() : null,
          provider_response: JSON.stringify(sendRes.data ?? sendRes.errorText ?? null),
        })
        .eq('id', r.id);

      if (updErr) {
        console.warn('⚠️ Falha ao atualizar outbox status:', updErr);
      }

      if (sendRes.ok) {
        sent += 1;
        console.log(`✅ [Fila] Enviado: outbox_id=${r.id} to=${r.phone_to}`);
      } else {
        failed += 1;
        console.warn(`❌ [Fila] Falhou: outbox_id=${r.id} to=${r.phone_to} status=${sendRes.status}`);
      }
    } catch (e: any) {
      failed += 1;
      console.error('❌ Erro ao enviar notificação de fila:', {
        outbox_id: r.id,
        establishment_id: r.establishment_id,
        error: String(e?.message || e),
      });

      // Marcar como failed para não travar a fila
      try {
        await supabase
          .from('waitlist_whatsapp_outbox')
          .update({
            status: 'failed',
            provider_response: JSON.stringify({ error: String(e?.message || e) }),
          })
          .eq('id', r.id);
      } catch {
        // ignore
      }
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return { processed: rows.length, sent, failed };
}

// Execução direta via tsx (ESM)
const isDirectRun = (() => {
  const argv1 = process.argv?.[1] || '';
  return argv1.includes('sendWaitlistWhatsappNotifications');
})();

if (isDirectRun) {
  runSendWaitlistWhatsappNotificationsOnce()
    .then((res) => {
      console.log('🏁 Job finalizado:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Job falhou:', err);
      process.exit(1);
    });
}

