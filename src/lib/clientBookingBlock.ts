import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * "Bloquear cliente" (Meus Clientes → Ver mais): o cliente bloqueado vê a agenda
 * sempre lotada nas páginas públicas (completa, chat e simples).
 *
 * A pergunta vai para a função `public_is_client_booking_blocked`, que só responde
 * sim/não. Qualquer falha (função ainda não criada, rede) = NÃO bloqueado: na dúvida,
 * o cliente agenda normal.
 */
export async function isClientBookingBlocked(establishmentId: string, phone: string): Promise<boolean> {
  const id = String(establishmentId || '').trim();
  const digits = String(phone || '').replace(/\D/g, '');
  if (!id || digits.length < 10) return false;
  try {
    const { data, error } = await supabase.rpc('public_is_client_booking_blocked', {
      p_establishment_id: id,
      p_phone: digits,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** Mesmo teste em forma de hook: refaz quando o telefone digitado muda. */
export function useClientBookingBlocked(establishmentId: string | null | undefined, phone: string | null | undefined): boolean {
  const [blocked, setBlocked] = useState(false);
  const id = String(establishmentId || '').trim();
  const digits = String(phone || '').replace(/\D/g, '');
  useEffect(() => {
    let cancelled = false;
    if (!id || digits.length < 10) {
      setBlocked(false);
      return;
    }
    void isClientBookingBlocked(id, digits).then((result) => {
      if (!cancelled) setBlocked(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, digits]);
  return blocked;
}
