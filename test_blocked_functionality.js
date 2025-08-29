// Script para testar a funcionalidade de bloqueio
// Execute este script no console do navegador na página do admin dashboard

async function testBlockFunctionality() {
  console.log('=== Teste de Funcionalidade de Bloqueio ===');
  
  // 1. Verificar se a coluna existe
  console.log('1. Verificando se a coluna is_blocked existe...');
  
  try {
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'establishments')
      .eq('column_name', 'is_blocked');
    
    if (error) {
      console.error('Erro ao verificar coluna:', error);
      return;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ Coluna is_blocked existe:', columns[0]);
    } else {
      console.log('❌ Coluna is_blocked NÃO existe!');
      console.log('Execute o SQL: ALTER TABLE establishments ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;');
      return;
    }
  } catch (error) {
    console.error('Erro ao verificar coluna:', error);
    return;
  }
  
  // 2. Verificar estabelecimentos existentes
  console.log('\n2. Verificando estabelecimentos existentes...');
  
  try {
    const { data: establishments, error } = await supabase
      .from('establishments')
      .select('id, name, is_blocked')
      .limit(5);
    
    if (error) {
      console.error('Erro ao buscar estabelecimentos:', error);
      return;
    }
    
    console.log('Estabelecimentos encontrados:', establishments);
  } catch (error) {
    console.error('Erro ao buscar estabelecimentos:', error);
    return;
  }
  
  // 3. Testar atualização de bloqueio
  console.log('\n3. Testando atualização de bloqueio...');
  
  // Pegar o primeiro estabelecimento para teste
  try {
    const { data: testEstablishment, error } = await supabase
      .from('establishments')
      .select('id, name, is_blocked')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Erro ao buscar estabelecimento para teste:', error);
      return;
    }
    
    console.log('Estabelecimento para teste:', testEstablishment);
    
    // Testar bloqueio
    const newBlockedStatus = !testEstablishment.is_blocked;
    console.log(`Tentando alterar is_blocked de ${testEstablishment.is_blocked} para ${newBlockedStatus}`);
    
    const { data: updateResult, error: updateError } = await supabase
      .from('establishments')
      .update({ is_blocked: newBlockedStatus })
      .eq('id', testEstablishment.id)
      .select();
    
    if (updateError) {
      console.error('Erro ao atualizar bloqueio:', updateError);
      return;
    }
    
    console.log('✅ Atualização bem-sucedida:', updateResult);
    
    // Verificar se a atualização persistiu
    const { data: verifyResult, error: verifyError } = await supabase
      .from('establishments')
      .select('id, name, is_blocked')
      .eq('id', testEstablishment.id)
      .single();
    
    if (verifyError) {
      console.error('Erro ao verificar atualização:', verifyError);
      return;
    }
    
    console.log('✅ Verificação da atualização:', verifyResult);
    
    // Reverter para o estado original
    const { data: revertResult, error: revertError } = await supabase
      .from('establishments')
      .update({ is_blocked: testEstablishment.is_blocked })
      .eq('id', testEstablishment.id)
      .select();
    
    if (revertError) {
      console.error('Erro ao reverter:', revertError);
    } else {
      console.log('✅ Revertido para estado original:', revertResult);
    }
    
  } catch (error) {
    console.error('Erro no teste de atualização:', error);
  }
  
  console.log('\n=== Fim do Teste ===');
}

// Executar o teste
testBlockFunctionality();
