// SCRIPT PARA INVESTIGAR AGENDAMENTOS ÓRFÃOS NO FRONTEND
// Execute este código no console do navegador

console.log('🔍 INVESTIGANDO AGENDAMENTOS ÓRFÃOS...');

// 1. Verificar profissionais carregados
console.log('📋 PROFISSIONAIS CARREGADOS:');
if (window.establishment && window.establishment.professionals) {
  window.establishment.professionals.forEach((prof, index) => {
    console.log(`${index + 1}. ID: "${prof.id}" | Nome: "${prof.name}"`);
  });
} else {
  console.log('❌ Estabelecimento não encontrado ou sem profissionais');
}

// 2. Verificar agendamentos com problemas
console.log('\n🔍 AGENDAMENTOS COM PROBLEMAS:');
if (window.appointments) {
  const problematicAppointments = window.appointments.filter(apt => 
    !apt.professional || 
    apt.professional === '' || 
    apt.professional === 'Luc'
  );
  
  console.log(`Total de agendamentos problemáticos: ${problematicAppointments.length}`);
  
  problematicAppointments.forEach((apt, index) => {
    console.log(`${index + 1}. ID: ${apt.id} | Cliente: ${apt.client_name} | Profissional: "${apt.professional}" | Data: ${apt.appointment_date}`);
  });
} else {
  console.log('❌ Agendamentos não encontrados na variável window');
}

// 3. Verificar todos os valores únicos de professional nos agendamentos
console.log('\n📊 TODOS OS VALORES DE PROFISSIONAL NOS AGENDAMENTOS:');
if (window.appointments) {
  const uniqueProfessionals = [...new Set(window.appointments.map(apt => apt.professional))];
  uniqueProfessionals.forEach((prof, index) => {
    const count = window.appointments.filter(apt => apt.professional === prof).length;
    console.log(`${index + 1}. "${prof}" - ${count} agendamentos`);
  });
}

// 4. Função para buscar agendamentos específicos
window.findAppointmentsByProfessional = function(professionalName) {
  console.log(`\n🔍 BUSCANDO AGENDAMENTOS PARA: "${professionalName}"`);
  if (window.appointments) {
    const appointments = window.appointments.filter(apt => apt.professional === professionalName);
    console.log(`Encontrados ${appointments.length} agendamentos:`);
    appointments.forEach((apt, index) => {
      console.log(`${index + 1}. ${apt.client_name} - ${apt.appointment_date} ${apt.appointment_time} - ${apt.service}`);
    });
    return appointments;
  }
  return [];
};

// 5. Função para verificar se um profissional existe
window.checkProfessionalExists = function(professionalIdOrName) {
  console.log(`\n🔍 VERIFICANDO SE PROFISSIONAL EXISTE: "${professionalIdOrName}"`);
  if (window.establishment && window.establishment.professionals) {
    const byId = window.establishment.professionals.find(p => p.id === professionalIdOrName);
    const byName = window.establishment.professionals.find(p => p.name === professionalIdOrName);
    
    if (byId) {
      console.log(`✅ Encontrado por ID: ${byId.name}`);
      return byId;
    } else if (byName) {
      console.log(`✅ Encontrado por Nome: ${byName.name}`);
      return byName;
    } else {
      console.log(`❌ Profissional NÃO encontrado: "${professionalIdOrName}"`);
      return null;
    }
  }
  return null;
};

console.log('\n✅ Script carregado! Use as funções:');
console.log('- findAppointmentsByProfessional("Luc")');
console.log('- checkProfessionalExists("Luc")');
console.log('- checkProfessionalExists("ID_DO_PROFISSIONAL")');










