// Script para verificar estabelecimentos no banco de dados
import { createClient } from '@supabase/supabase-js';

// Usar as mesmas variáveis que o projeto usa
const supabaseUrl = 'https://ixmjkqjzqzqzqzqzqzqz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWprcWp6cXpxenF6cXpxenF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2NzI4NzQsImV4cCI6MjA0OTI0ODg3NH0.example';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugEstablishments() {
  console.log('🔍 VERIFICANDO ESTABELECIMENTOS NO BANCO...\n');
  
  try {
    // Primeiro, testar conexão
    console.log('🔗 Testando conexão com Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('establishments')
      .select('count(*)', { count: 'exact' });
    
    if (testError) {
      console.error('❌ ERRO DE CONEXÃO:', testError);
      console.log('💡 Verifique se as credenciais do Supabase estão corretas');
      return;
    }
    
    console.log('✅ Conexão OK!\n');
    
    // Buscar todos os estabelecimentos
    const { data: establishments, error } = await supabase
      .from('establishments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar estabelecimentos:', error);
      return;
    }

    if (!establishments || establishments.length === 0) {
      console.log('❌ NENHUM ESTABELECIMENTO ENCONTRADO NO BANCO!');
      console.log('   Você precisa criar estabelecimentos primeiro.');
      console.log('   Acesse: http://localhost:5173/dashboard/establishment');
      return;
    }

    console.log(`✅ ENCONTRADOS ${establishments.length} ESTABELECIMENTOS:\n`);
    
    establishments.forEach((est, index) => {
      console.log(`${index + 1}. ESTABELECIMENTO:`);
      console.log(`   📛 Nome: ${est.name}`);
      console.log(`   🔢 Código: ${est.code}`);
      console.log(`   🆔 ID: ${est.id}`);
      console.log(`   👤 Owner ID: ${est.owner_id}`);
      console.log(`   📅 Criado em: ${new Date(est.created_at).toLocaleString('pt-BR')}`);
      console.log(`   🔗 Link: http://localhost:5173/booking/${est.code}`);
      console.log(`   ⚙️ Tem horários: ${est.business_hours ? 'Sim' : 'Não'}`);
      console.log(`   👥 Profissionais: ${est.professionals?.length || 0}`);
      console.log(`   🛠️ Serviços: ${est.services_with_prices?.length || 0}`);
      console.log('   ─────────────────────────────────────────\n');
    });

    // Testar busca por código específico
    console.log('🧪 TESTANDO BUSCA POR CÓDIGOS ESPECÍFICOS:\n');
    
    const testCodes = ['2020', '1234', '5678', '9999'];
    
    for (const code of testCodes) {
      const { data: testEst, error: testError } = await supabase
        .from('establishments')
        .select('*')
        .eq('code', code)
        .single();

      if (testError) {
        console.log(`❌ Código ${code}: Não encontrado (${testError.message})`);
      } else {
        console.log(`✅ Código ${code}: ${testEst.name} (ID: ${testEst.id})`);
      }
    }

    // Criar estabelecimentos de teste se necessário
    if (establishments.length === 1) {
      console.log('\n🏗️ CRIANDO ESTABELECIMENTOS DE TESTE...\n');
      
      const testEstablishments = [
        {
          name: 'Barbearia Silva',
          code: '1234',
          description: 'Barbearia tradicional',
          owner_id: establishments[0].owner_id, // Usar o mesmo owner
          business_hours: {
            monday: { enabled: true, open1: '08:00', close1: '12:00', open2: '14:00', close2: '18:00' },
            tuesday: { enabled: true, open1: '08:00', close1: '12:00', open2: '14:00', close2: '18:00' },
            wednesday: { enabled: true, open1: '08:00', close1: '12:00', open2: '14:00', close2: '18:00' },
            thursday: { enabled: true, open1: '08:00', close1: '12:00', open2: '14:00', close2: '18:00' },
            friday: { enabled: true, open1: '08:00', close1: '12:00', open2: '14:00', close2: '18:00' },
            saturday: { enabled: true, open1: '08:00', close1: '12:00', open2: '14:00', close2: '16:00' },
            sunday: { enabled: false, open1: '08:00', close1: '12:00', open2: '14:00', close2: '18:00' }
          },
          professionals: [
            { id: 'prof1', name: 'João Silva', specialties: [] },
            { id: 'prof2', name: 'Pedro Santos', specialties: [] }
          ],
          services_with_prices: [
            { id: 'serv1', name: 'Corte Masculino', price: 25, duration: 30 },
            { id: 'serv2', name: 'Barba', price: 15, duration: 20 },
            { id: 'serv3', name: 'Corte + Barba', price: 35, duration: 45 }
          ]
        },
        {
          name: 'Salão Beleza Total',
          code: '5678',
          description: 'Salão de beleza feminino',
          owner_id: establishments[0].owner_id,
          business_hours: {
            monday: { enabled: true, open1: '09:00', close1: '12:00', open2: '14:00', close2: '19:00' },
            tuesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '14:00', close2: '19:00' },
            wednesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '14:00', close2: '19:00' },
            thursday: { enabled: true, open1: '09:00', close1: '12:00', open2: '14:00', close2: '19:00' },
            friday: { enabled: true, open1: '09:00', close1: '12:00', open2: '14:00', close2: '19:00' },
            saturday: { enabled: true, open1: '09:00', close1: '12:00', open2: '14:00', close2: '17:00' },
            sunday: { enabled: false, open1: '09:00', close1: '12:00', open2: '14:00', close2: '19:00' }
          },
          professionals: [
            { id: 'prof1', name: 'Maria Oliveira', specialties: [] },
            { id: 'prof2', name: 'Ana Costa', specialties: [] }
          ],
          services_with_prices: [
            { id: 'serv1', name: 'Corte Feminino', price: 40, duration: 45 },
            { id: 'serv2', name: 'Escova', price: 30, duration: 30 },
            { id: 'serv3', name: 'Pintura', price: 80, duration: 120 }
          ]
        }
      ];

      for (const testEst of testEstablishments) {
        try {
          const { data: newEst, error: createError } = await supabase
            .from('establishments')
            .insert([testEst])
            .select()
            .single();

          if (createError) {
            console.log(`❌ Erro ao criar ${testEst.name}:`, createError.message);
          } else {
            console.log(`✅ Criado: ${testEst.name} (Código: ${testEst.code})`);
          }
        } catch (err) {
          console.log(`❌ Erro ao criar ${testEst.name}:`, err.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugEstablishments(); 