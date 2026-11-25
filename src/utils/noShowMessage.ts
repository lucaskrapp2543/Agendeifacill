// Mensagem de "você faltou" que o painel deixa PRONTA para o barbeiro enviar pelo
// próprio WhatsApp depois de clicar em "Cliente Faltou". Nada é enviado sozinho:
// o robô do WhatsApp não manda mensagem na falta (server/.../reminderScheduler.ts).

/** Telefone só com números e com 55 na frente quando for número brasileiro sem DDI; '' se inválido. */
export function phoneForWhatsApp(raw: unknown): string {
  let digitos = String(raw ?? '').replace(/\D/g, '');
  if (digitos.length >= 10 && digitos.length <= 11) digitos = `55${digitos}`;
  return digitos.length >= 12 ? digitos : '';
}

/** Sem "hoje" no texto: a falta pode ser marcada no dia seguinte. */
export function buildNoShowWhatsAppMessage(dados: {
  clientName?: string | null;
  establishmentName?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  professionalName?: string | null;
}): string {
  const primeiroNome = String(dados.clientName || '').trim().split(/\s+/)[0] || '';
  const barbearia = String(dados.establishmentName || '').trim();
  const data = String(dados.appointmentDate || '').slice(0, 10).split('-').reverse().join('/');
  const hora = String(dados.appointmentTime || '').slice(0, 5);
  const profissional = String(dados.professionalName || '').trim();

  // Sem emojis de propósito: em alguns aparelhos o WhatsApp aberto por link troca emoji por "�".
  const linhas = [
    `${primeiroNome ? `Oi, ${primeiroNome}!` : 'Oi!'} Sentimos sua falta${barbearia ? ` na ${barbearia}` : ''}.`,
    'Seu horário passou e você não compareceu.',
    '',
  ];
  if (data) linhas.push(`Data: ${data}`);
  if (hora) linhas.push(`Horário: ${hora}`);
  if (profissional) linhas.push(`Profissional: ${profissional}`);
  linhas.push('', 'Quando quiser, é só agendar de novo.');
  return linhas.join('\n');
}
