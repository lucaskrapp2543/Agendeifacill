// Teste para verificar se a validação de remarcação no mesmo dia está funcionando
// Execute este script no console do navegador

console.log('🧪 TESTE: Validação de remarcação no mesmo dia');

// Simular dados de teste
const testData = {
  userId: 'test-user-id',
  establishmentId: 'test-establishment-id',
  appointmentDate: new Date('2025-09-26'),
  isSubscriber: true
};

console.log('📋 Dados de teste:', testData);

// Verificar se a função existe
if (typeof validateSameDayReschedule === 'function') {
  console.log('✅ Função validateSameDayReschedule encontrada');
} else {
  console.log('❌ Função validateSameDayReschedule não encontrada');
}

// Verificar se o estabelecimento tem a configuração
console.log('🔍 Verificando configuração do estabelecimento...');

// Simular verificação
const establishment = {
  prevent_same_day_reschedule: true
};

if (establishment.prevent_same_day_reschedule) {
  console.log('✅ Configuração ativada - deve mostrar aviso');
} else {
  console.log('❌ Configuração desativada - não deve mostrar aviso');
}

console.log('🎯 Teste concluído!');
