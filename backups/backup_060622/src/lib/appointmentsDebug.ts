import { supabase } from './supabase';

export const debugAppointments = async (userId: string) => {
  console.log('🔧 === DIAGNÓSTICO COMPLETO DE AGENDAMENTOS ===');
  console.log('👤 User ID:', userId);
  
  try {
    // 1. Verificar usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('1️⃣ Usuário atual:', {
      id: user?.id,
      email: user?.email,
      matchesTarget: user?.id === userId,
      error: userError
    });

    // 2. Verificar se existem agendamentos na tabela (sem filtro)
    const { data: allAppointments, error: allError } = await supabase
      .from('appointments')
      .select('*')
      .limit(10);
    
    console.log('2️⃣ Total de agendamentos na tabela:', {
      count: allAppointments?.length || 0,
      data: allAppointments,
      error: allError
    });

    // 3. Buscar agendamentos deste usuário especificamente
    const { data: userAppointments, error: userError2 } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', userId);
    
    console.log('3️⃣ Agendamentos do usuário:', {
      count: userAppointments?.length || 0,
      data: userAppointments,
      error: userError2
    });

    // 4. Verificar policies RLS
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_table_policies', { table_name: 'appointments' })
      .single();
    
    console.log('4️⃣ Políticas RLS:', {
      policies,
      error: policiesError
    });

    // 5. Tentar criar um agendamento de teste
    const testAppointment = {
      client_id: userId,
      client_name: 'Teste Debug',
      establishment_id: 'test',
      service: 'Teste',
      professional: 'Teste',
      appointment_date: new Date().toISOString().split('T')[0],
      appointment_time: '10:00',
      status: 'pending'
    };

    console.log('5️⃣ Tentando criar agendamento de teste...');
    const { data: testData, error: testError } = await supabase
      .from('appointments')
      .insert([testAppointment])
      .select();
    
    console.log('5️⃣ Resultado do teste:', {
      success: !testError,
      data: testData,
      error: testError
    });

    // 6. Se criou, tentar buscar novamente
    if (testData && testData[0]) {
      const { data: afterCreate, error: afterError } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', userId);
      
      console.log('6️⃣ Após criar teste:', {
        count: afterCreate?.length || 0,
        data: afterCreate,
        error: afterError
      });

      // Limpar o teste
      await supabase
        .from('appointments')
        .delete()
        .eq('id', testData[0].id);
      
      console.log('6️⃣ Agendamento de teste removido');
    }

    return {
      totalAppointments: allAppointments?.length || 0,
      userAppointments: userAppointments?.length || 0,
      canCreate: !testError,
      issues: {
        authIssue: userError || user?.id !== userId,
        rlsIssue: allAppointments?.length === 0 && allError,
        queryIssue: userError2,
        createIssue: testError
      }
    };

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return { error };
  }
};

export const fixAppointmentsRLS = async () => {
  console.log('🔧 Tentando corrigir políticas RLS...');
  
  try {
    // Tentar desabilitar RLS temporariamente para teste
    const { error } = await supabase
      .rpc('disable_rls_for_table', { table_name: 'appointments' });
    
    if (error) {
      console.log('❌ Não foi possível desabilitar RLS:', error);
      console.log('💡 SOLUÇÃO: Execute no SQL Editor do Supabase:');
      console.log('ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;');
    } else {
      console.log('✅ RLS desabilitado para appointments');
    }
    
    return { error };
  } catch (err) {
    console.error('❌ Erro ao corrigir RLS:', err);
    return { error: err };
  }
}; 