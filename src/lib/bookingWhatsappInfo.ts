import { supabase } from './supabase';

/**
 * O que o cliente final pode saber sobre o WhatsApp do estabelecimento na hora
 * de fechar o agendamento: está conectado? manda confirmação? lembra X antes?
 * Vem da função SQL public_booking_whatsapp_info (só booleanos e minutos).
 * Se a função não existir ou falhar, devolve null e a página segue sem a frase.
 */
export type BookingWhatsappInfo = {
  connected: boolean;
  greetingEnabled: boolean;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
};

export async function fetchBookingWhatsappInfo(establishmentId: string): Promise<BookingWhatsappInfo | null> {
  const id = String(establishmentId || '').trim();
  if (!id) return null;
  try {
    const { data, error } = await supabase.rpc('public_booking_whatsapp_info', { p_establishment_id: id });
    if (error || !data || (data as any).ok !== true) return null;
    const d = data as any;
    return {
      connected: d.connected === true,
      greetingEnabled: d.greeting_enabled !== false,
      reminderEnabled: d.reminder_enabled !== false,
      reminderOffsetMinutes: Number(d.reminder_offset_minutes || 60),
    };
  } catch {
    return null;
  }
}

/** 10 → "10 minutos", 60 → "1 hora", 180 → "3 horas", 90 → "1h30". */
export function formatReminderOffset(minutes: number): string {
  const m = Math.max(0, Math.round(Number(minutes || 0)));
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h}h${String(rest).padStart(2, '0')}`;
}

/**
 * Frase para a tela de sucesso. Vazia quando o WhatsApp não está conectado ou
 * nada automático está ligado (não prometer o que não vai chegar).
 */
export function buildWhatsappSuccessNote(info: BookingWhatsappInfo | null): string {
  if (!info || !info.connected) return '';
  const tempo = formatReminderOffset(info.reminderOffsetMinutes);
  if (info.greetingEnabled && info.reminderEnabled) {
    return `📲 A confirmação vai chegar no seu WhatsApp e você será lembrado ${tempo} antes do horário.`;
  }
  if (info.reminderEnabled) {
    return `📲 Você será lembrado no seu WhatsApp ${tempo} antes do horário.`;
  }
  if (info.greetingEnabled) {
    return '📲 A confirmação vai chegar no seu WhatsApp.';
  }
  return '';
}
