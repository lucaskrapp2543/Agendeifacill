/**
 * Diz se o estabelecimento tem Mercado Pago conectado — SEM depender do token cru.
 *
 * Usa a coluna calculada `has_mercadopago` (Fase 1). Se ela não veio no select
 * (telas/registros antigos que ainda trazem o token), cai no jeito antigo
 * (token preenchido) como rede de segurança durante a transição.
 *
 * Depois que o token for escondido (Fase 3), o caminho do fallback deixa de
 * existir e a verificação passa a ser 100% pela plaquinha.
 */
export function establishmentHasMercadoPago(establishment: any): boolean {
  const flag = establishment?.has_mercadopago;
  if (flag === true) return true;
  if (flag === false) return false;
  // fallback (transição): selects que ainda trazem o token cru
  return !!String(establishment?.mercadopago_access_token || '').trim();
}
