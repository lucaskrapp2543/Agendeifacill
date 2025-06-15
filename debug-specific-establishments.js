// Script para comparar estabelecimentos específicos
// Execute com: node debug-specific-establishments.js

import { createClient } from '@supabase/supabase-js';

// Usar as mesmas credenciais do projeto
const supabaseUrl = 'https://ixmjkqjzqzqzqzqzqzqz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWprcWp6cXpxenF6cXpxenF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2NzI4NzQsImV4cCI6MjA0OTI0ODg3NH0.example';

const supabase = createClient(supabaseUrl, supabaseKey);

async function compareEstablishments() {
  console.log('🔍 COMPARANDO ESTABELECIMENTOS...\n');
  
  const testCodes = ['2020', '1010', '1999', '1234'];
  
  for (const code of testCodes) {
    console.log(`\n🏢 TESTANDO CÓDIGO: ${code}`);
    console.log('═'.repeat(50));
    
    try {
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .eq('code', code)
        .single();

      if (error) {
        console.log(`❌ ERRO: ${error.message}`);
        continue;
      }

      if (!data) {
        console.log(`❌ NENHUM RESULTADO`);
        continue;
      }

      console.log(`✅ ENCONTRADO: ${data.name}`);
      console.log(`📋 DADOS BÁSICOS:`);
      console.log(`   - ID: ${data.id}`);
      console.log(`   - Nome: ${data.name}`);
      console.log(`   - Código: ${data.code}`);
      console.log(`   - Descrição: ${data.description || 'N/A'}`);
      console.log(`   - Owner ID: ${data.owner_id}`);
      console.log(`   - Criado em: ${data.created_at}`);
      
      console.log(`\n🔧 CONFIGURAÇÕES:`);
      console.log(`   - Horários de funcionamento: ${data.business_hours ? 'SIM' : 'NÃO'}`);
      console.log(`   - Profissionais: ${data.professionals?.length || 0}`);
      console.log(`   - Serviços: ${data.services_with_prices?.length || 0}`);
      
      if (data.business_hours) {
        console.log(`\n⏰ HORÁRIOS DETALHADOS:`);
        Object.entries(data.business_hours).forEach(([day, hours]) => {
          console.log(`   - ${day}: ${hours.enabled ? 'ABERTO' : 'FECHADO'}`);
          if (hours.enabled) {
            console.log(`     ${hours.open1}-${hours.close1} e ${hours.open2}-${hours.close2}`);
          }
        });
      }
      
      if (data.professionals?.length > 0) {
        console.log(`\n👥 PROFISSIONAIS:`);
        data.professionals.forEach((prof, index) => {
          console.log(`   ${index + 1}. ${prof.name} (ID: ${prof.id})`);
        });
      }
      
      if (data.services_with_prices?.length > 0) {
        console.log(`\n🛠️ SERVIÇOS:`);
        data.services_with_prices.forEach((service, index) => {
          console.log(`   ${index + 1}. ${service.name} - R$ ${service.price} (${service.duration}min)`);
        });
      }
      
      // Verificar se há problemas específicos
      console.log(`\n🔍 VERIFICAÇÕES:`);
      
      const issues = [];
      
      if (!data.business_hours) {
        issues.push('❌ Sem horários de funcionamento');
      } else {
        const hasEnabledDays = Object.values(data.business_hours).some(h => h.enabled);
        if (!hasEnabledDays) {
          issues.push('❌ Nenhum dia da semana habilitado');
        }
      }
      
      if (!data.professionals || data.professionals.length === 0) {
        issues.push('❌ Sem profissionais cadastrados');
      }
      
      if (!data.services_with_prices || data.services_with_prices.length === 0) {
        issues.push('❌ Sem serviços cadastrados');
      }
      
      if (issues.length === 0) {
        console.log(`   ✅ TUDO OK - Estabelecimento completo`);
      } else {
        console.log(`   ⚠️ PROBLEMAS ENCONTRADOS:`);
        issues.forEach(issue => console.log(`     ${issue}`));
      }
      
    } catch (err) {
      console.log(`❌ ERRO GERAL: ${err.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('🎯 RESUMO: Verifique se os estabelecimentos que não funcionam têm');
  console.log('   configurações diferentes dos que funcionam.');
}

compareEstablishments(); 