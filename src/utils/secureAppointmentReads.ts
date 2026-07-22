import { supabase } from '../lib/supabase';

/**
 * Leitura segura dos agendamentos de um telefone num estabelecimento, via função
 * SECURITY DEFINER `get_client_appointments_for_establishment` (não devolve CPF e
 * exige o telefone — impede varredura da base inteira).
 *
 * O match é feito pelos dígitos do telefone (últimos 9), tolerante a formato/máscara.
 *
 * Retorna:
 *  - array de agendamentos (sem CPF) quando a função responde;
 *  - null quando a função não pôde ser usada — nesse caso o chamador deve cair no
 *    seu método antigo (leitura direta) como rede de segurança durante a transição.
 */
export async function fetchClientAppointmentsSecure(
  phone: string,
  establishmentId: string,
  dateMin?: string | null,
  dateMax?: string | null
): Promise<any[] | null> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9 || !establishmentId) return null;
  try {
    const { data, error } = await supabase.rpc('get_client_appointments_for_establishment', {
      p_phone: digits,
      p_establishment_id: establishmentId,
      p_date_min: dateMin ?? null,
      p_date_max: dateMax ?? null,
    });
    if (!error && Array.isArray(data)) return data as any[];
  } catch {
    // silencioso: cai no fallback do chamador
  }
  return null;
}
