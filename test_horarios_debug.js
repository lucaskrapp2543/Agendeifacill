// Script para testar horários de funcionamento
// Cole este código no console do navegador (F12)

console.log('🔍 TESTE DE HORÁRIOS DE FUNCIONAMENTO');
console.log('=====================================');

// 1. Verificar se o componente está carregado
const quickChecker = document.querySelector('[data-testid="quick-availability-checker"]');
console.log('✅ Componente encontrado:', !!quickChecker);

// 2. Verificar dados do estabelecimento (se disponível)
if (window.establishmentData) {
  console.log('🏪 Dados do estabelecimento:', window.establishmentData);
  console.log('📅 Horários de funcionamento:', window.establishmentData.business_hours);
} else {
  console.log('⚠️ Dados do estabelecimento não encontrados no window');
}

// 3. Testar formatação de datas
const testDate = new Date('2025-08-29');
console.log('📅 Data de teste:', testDate);
console.log('📅 Dia da semana (pt-BR):', testDate.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase());
console.log('📅 Dia da semana (en):', testDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase());

// 4. Verificar se há algum erro no console
console.log('🔍 Verifique se há erros no console acima');

// 5. Instruções para o usuário
console.log('');
console.log('📋 INSTRUÇÕES:');
console.log('1. Selecione uma data no verificador de horários');
console.log('2. Selecione um serviço');
console.log('3. Clique em "Verificar Horários"');
console.log('4. Observe os logs de debug no console');
console.log('5. Compare os dias da semana com os horários configurados');
