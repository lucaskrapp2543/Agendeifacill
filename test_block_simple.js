// Teste simples de bloqueio
console.log('=== Teste Simples de Bloqueio ===');

// Verificar se a coluna existe
async function checkColumn() {
  try {
    const { data, error } = await supabase
      .from('establishments')
      .select('id, name, is_blocked')
      .limit(1);
    
    if (error) {
      console.error('Erro ao verificar:', error);
      return;
    }
    
    console.log('✅ Coluna is_blocked existe!');
    console.log('Dados:', data);
    
    if (data && data.length > 0) {
      const est = data[0];
      console.log(`Estabelecimento: ${est.name}`);
      console.log(`Status atual: ${est.is_blocked ? 'Bloqueado' : 'Desbloqueado'}`);
      
      // Testar alteração
      const newStatus = !est.is_blocked;
      console.log(`Tentando alterar para: ${newStatus ? 'Bloqueado' : 'Desbloqueado'}`);
      
      const { data: updateData, error: updateError } = await supabase
        .from('establishments')
        .update({ is_blocked: newStatus })
        .eq('id', est.id)
        .select();
      
      if (updateError) {
        console.error('❌ Erro ao atualizar:', updateError);
      } else {
        console.log('✅ Atualização bem-sucedida!');
        console.log('Resultado:', updateData);
        
        // Verificar se persistiu
        const { data: verifyData, error: verifyError } = await supabase
          .from('establishments')
          .select('id, name, is_blocked')
          .eq('id', est.id)
          .single();
        
        if (verifyError) {
          console.error('❌ Erro ao verificar:', verifyError);
        } else {
          console.log('✅ Verificação:', verifyData);
          console.log(`Status final: ${verifyData.is_blocked ? 'Bloqueado' : 'Desbloqueado'}`);
        }
      }
    }
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkColumn();
