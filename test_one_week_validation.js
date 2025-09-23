// Teste direto da validação de 1 agendamento por semana
console.log('🧪 TESTE DE VALIDAÇÃO DE 1 AGENDAMENTO POR SEMANA');

// Simular dados
const establishment = {
  id: 'SEU_ESTABELECIMENTO_ID',
  limit_subscribers_one_week: true
};

const user = {
  id: 'SEU_USER_ID'
};

const isSubscriberBooking = true;

// Verificar condições
console.log('📋 Condições:');
console.log('- isSubscriberBooking:', isSubscriberBooking);
console.log('- limit_subscribers_one_week:', establishment?.limit_subscribers_one_week);
console.log('- userId:', user?.id);

// Verificar se a validação deve executar
if (isSubscriberBooking && establishment?.limit_subscribers_one_week && user?.id) {
  console.log('✅ VALIDAÇÃO DEVE EXECUTAR!');
  
  // Simular data de agendamento
  const selectedDate = new Date();
  const appointmentDate = new Date(selectedDate);
  const startOfWeek = new Date(appointmentDate);
  startOfWeek.setDate(appointmentDate.getDate() - appointmentDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  console.log('📅 Período da semana:');
  console.log('- Início:', startOfWeek.toISOString());
  console.log('- Fim:', endOfWeek.toISOString());
  console.log('- Data início (YYYY-MM-DD):', startOfWeek.toISOString().split('T')[0]);
  console.log('- Data fim (YYYY-MM-DD):', endOfWeek.toISOString().split('T')[0]);
  
} else {
  console.log('❌ VALIDAÇÃO NÃO DEVE EXECUTAR!');
  console.log('Motivos:');
  if (!isSubscriberBooking) console.log('- Não é agendamento de assinante');
  if (!establishment?.limit_subscribers_one_week) console.log('- Limitação não está ativa');
  if (!user?.id) console.log('- Usuário não logado');
}
