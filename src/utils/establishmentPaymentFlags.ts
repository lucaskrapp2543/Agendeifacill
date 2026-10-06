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

/**
 * Mercado Pago "utilizável" para COBRAR: conectado E saudável.
 *
 * Quando a conta caiu no Mercado Pago (`reconnect_required`), o booking passa a
 * cobrar pela conta da PLATAFORMA (o valor vira saldo da barbearia — carteira/saque),
 * exatamente como uma barbearia sem Mercado Pago. O painel continua avisando
 * "Mercado Pago caiu — reconecte"; só a cobrança do cliente não para.
 * (Regra pedida em 06/10/2026 depois de clientes verem "pagamento falhou / cancelado".)
 */
export function establishmentHasUsableMercadoPago(establishment: any): boolean {
  return establishmentHasMercadoPago(establishment) && !establishmentMercadoPagoNeedsReconnect(establishment);
}

/**
 * O pagamento online é OPCIONAL nesta barbearia? (cliente pode escolher pagar no local)
 *
 * Mesma regra das páginas de booking (resolvePaymentRequirement / BookingPage), em
 * versão pura (só colunas do estabelecimento) para as rotinas de limpeza de
 * `pending_payment`: em barbearia OPCIONAL, um checkout abandonado vira "pagar no
 * local" em vez de cancelamento + aviso de "não recebemos seu pagamento".
 * Fallback seguro: sem dados => false (= comportamento antigo, cancela).
 */
export function isOnlinePaymentOptionalForEstablishment(establishment: any): boolean {
  if (!establishment) return false;
  if (establishment.online_payment_blocked_by_admin === true) return true; // só paga no local
  const hasPagarMe = Boolean(String(establishment.pagarme_recipient_id || '').trim());
  const hasMercadoPago = establishmentHasUsableMercadoPago(establishment);
  const exigirMp = establishment.exigir_pagamento_antecipado_mercadopago === true;
  const opcionalMp = establishment.pagamento_adiantado_opcional_mercadopago === true;
  const exigirPm = establishment.exigir_pagamento_antecipado === true;
  const opcionalPm = establishment.pagamento_adiantado_opcional === true;
  const cobrancaPelaPlataforma = !hasMercadoPago && !hasPagarMe;
  const usarMercadoPago = cobrancaPelaPlataforma ? true : hasMercadoPago && exigirMp;
  const usarPagarMe = !usarMercadoPago && hasPagarMe && exigirPm;
  if (!usarMercadoPago && !usarPagarMe) return true; // nenhum gateway exige pagamento => nunca é obrigatório
  if (usarPagarMe) return opcionalPm;
  if (cobrancaPelaPlataforma) return !(exigirMp && !opcionalMp);
  return opcionalMp;
}
