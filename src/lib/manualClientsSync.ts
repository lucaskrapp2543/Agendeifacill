import { getWhatsappLookupKeys } from './subscriberAppointmentFlags';
import { supabase } from './supabase';

export function normalizeWhatsappForManualClientStorage(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

type ManualClientRow = { id: string; name: string; whatsapp: string };

export async function findManualClientByWhatsapp(
  establishmentId: string,
  rawWhatsapp: string
): Promise<ManualClientRow | null> {
  const estId = String(establishmentId || '').trim();
  const keys = getWhatsappLookupKeys(rawWhatsapp);
  if (!estId || keys.length === 0) return null;

  const { data, error } = await supabase
    .from('manual_clients')
    .select('id, name, whatsapp')
    .eq('establishment_id', estId)
    .in('whatsapp', keys)
    .limit(1);

  if (error) {
    console.warn('manualClientsSync: erro ao buscar cliente manual:', error.message || error);
    return null;
  }

  return (data?.[0] as ManualClientRow | undefined) || null;
}

export type EnsureManualClientResult = {
  created: boolean;
  updated: boolean;
  skipped: boolean;
  error?: unknown;
};

/**
 * Garante que o contato exista em manual_clients ("Meus Clientes").
 * Não sobrescreve nome já cadastrado — só cria ou melhora nomes genéricos.
 */
export async function ensureManualClientFromContact(params: {
  establishmentId: string;
  name: string;
  whatsapp: string;
  updateNameIfGeneric?: boolean;
}): Promise<EnsureManualClientResult> {
  const establishmentId = String(params.establishmentId || '').trim();
  const name = String(params.name || '').trim();
  const normalizedWhatsapp = normalizeWhatsappForManualClientStorage(params.whatsapp);

  if (!establishmentId || !name || !normalizedWhatsapp) {
    return { created: false, updated: false, skipped: true };
  }

  const existing = await findManualClientByWhatsapp(establishmentId, normalizedWhatsapp);

  if (existing) {
    const existingName = String(existing.name || '').trim();
    const genericNames = new Set(['', 'cliente', 'cliente desconhecido', 'cliente sem nome']);
    const shouldUpdateName =
      params.updateNameIfGeneric !== false &&
      genericNames.has(existingName.toLowerCase()) &&
      name.length > 0 &&
      existingName !== name;

    if (!shouldUpdateName) {
      return { created: false, updated: false, skipped: true };
    }

    const { error } = await supabase
      .from('manual_clients')
      .update({
        name,
        whatsapp: normalizedWhatsapp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      return { created: false, updated: false, skipped: false, error };
    }
    return { created: false, updated: true, skipped: false };
  }

  const insertBase: Record<string, unknown> = {
    establishment_id: establishmentId,
    name,
    whatsapp: normalizedWhatsapp,
  };

  let { error } = await supabase.from('manual_clients').insert({
    ...insertBase,
    force_advance_payment: false,
  });

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { created: false, updated: false, skipped: true };
    }
    if (msg.includes('force_advance_payment')) {
      ({ error } = await supabase.from('manual_clients').insert(insertBase));
    }
  }

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { created: false, updated: false, skipped: true };
    }
    return { created: false, updated: false, skipped: false, error };
  }

  return { created: true, updated: false, skipped: false };
}

export type SyncSubscribersToManualClientsResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

/**
 * Espelha assinantes de client_subscriptions em manual_clients quando ainda não existem.
 */
export async function syncSubscribersToManualClients(
  establishmentId: string
): Promise<SyncSubscribersToManualClientsResult> {
  const stats: SyncSubscribersToManualClientsResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const estId = String(establishmentId || '').trim();
  if (!estId) return stats;

  const pageSize = 1000;
  let from = 0;
  const rows: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('client_subscriptions')
      .select('subscriber_name, subscriber_whatsapp, client_whatsapp, client_name_override')
      .eq('establishment_id', estId)
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn('manualClientsSync: erro ao buscar assinantes:', error.message || error);
      stats.errors += 1;
      return stats;
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const seenPhones = new Set<string>();

  for (const row of rows) {
    const name = String(row?.client_name_override || row?.subscriber_name || '').trim();
    const rawPhone = String(row?.subscriber_whatsapp || row?.client_whatsapp || '').trim();
    const storageKey = normalizeWhatsappForManualClientStorage(rawPhone);

    if (!name || !storageKey || seenPhones.has(storageKey)) continue;
    seenPhones.add(storageKey);

    const result = await ensureManualClientFromContact({
      establishmentId: estId,
      name,
      whatsapp: rawPhone,
    });

    if (result.error) stats.errors += 1;
    else if (result.created) stats.created += 1;
    else if (result.updated) stats.updated += 1;
    else stats.skipped += 1;
  }

  if (stats.created > 0 || stats.updated > 0) {
    console.log(
      `✅ Assinantes sincronizados em Meus Clientes: ${stats.created} criado(s), ${stats.updated} atualizado(s).`
    );
  }

  return stats;
}
