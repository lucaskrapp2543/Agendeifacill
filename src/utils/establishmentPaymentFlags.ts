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

/**
 * Diz se a conta Mercado Pago do estabelecimento CAIU e precisa ser reconectada.
 *
 * `mercadopago_health = 'reconnect_required'` é gravado pelo servidor quando o
 * Mercado Pago recusa a renovação do token com erro permanente (invalid_grant),
 * e limpo quando a conta é reconectada ou o token renova com sucesso.
 *
 * Fallback seguro: coluna ausente/NULL (clientes antigos, migration não aplicada,
 * select sem a coluna) => false, ou seja, comporta exatamente como hoje.
 * Só faz sentido junto com token salvo — sem token, a tela já mostra "desconectado".
 */
export function establishmentMercadoPagoNeedsReconnect(establishment: any): boolean {
  if (!establishmentHasMercadoPago(establishment)) return false;
  return String(establishment?.mercadopago_health || '').trim() === 'reconnect_required';
}
