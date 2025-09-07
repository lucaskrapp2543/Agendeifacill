/**
 * Utilitário para migrar dados de clientes manuais da chave antiga para a nova
 * Isso garante que os dados não sejam perdidos durante a atualização
 */

export const migrateManualClients = (establishmentId: string) => {
  try {
    // Buscar dados da chave antiga
    const oldManualClients = JSON.parse(localStorage.getItem('manualClients') || '{}');
    
    if (Object.keys(oldManualClients).length === 0) {
      console.log('📋 Nenhum cliente manual encontrado na chave antiga');
      return;
    }

    // Buscar dados da nova chave
    const storageKey = `manual_clients_${establishmentId}`;
    const newManualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');

    // Migrar dados que não existem na nova chave
    let migratedCount = 0;
    Object.entries(oldManualClients).forEach(([whatsapp, clientData]: [string, any]) => {
      if (!newManualClients[whatsapp]) {
        newManualClients[whatsapp] = {
          ...clientData,
          // Garantir que tenha os campos necessários
          email: clientData.email || null,
          addedAt: clientData.addedAt || new Date().toISOString()
        };
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      // Salvar dados migrados
      localStorage.setItem(storageKey, JSON.stringify(newManualClients));
      console.log(`✅ Migrados ${migratedCount} clientes manuais para a nova chave`);
    } else {
      console.log('📋 Todos os clientes manuais já estão na nova chave');
    }

    return migratedCount;
  } catch (error) {
    console.error('❌ Erro ao migrar clientes manuais:', error);
    return 0;
  }
};

/**
 * Função para limpar dados duplicados e otimizar o armazenamento
 */
export const cleanupManualClients = (establishmentId: string) => {
  try {
    const storageKey = `manual_clients_${establishmentId}`;
    const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    // Remover entradas vazias ou inválidas
    const cleanedClients: Record<string, any> = {};
    Object.entries(manualClients).forEach(([whatsapp, clientData]: [string, any]) => {
      if (clientData && clientData.name && clientData.whatsapp) {
        cleanedClients[whatsapp] = {
          name: clientData.name.trim(),
          whatsapp: clientData.whatsapp,
          email: clientData.email || null,
          id: clientData.id || `manual_${whatsapp}`,
          addedAt: clientData.addedAt || new Date().toISOString(),
          birthday: clientData.birthday || null,
          appointmentCount: clientData.appointmentCount || 0
        };
      }
    });

    localStorage.setItem(storageKey, JSON.stringify(cleanedClients));
    console.log(`🧹 Limpeza concluída: ${Object.keys(cleanedClients).length} clientes válidos`);
    
    return Object.keys(cleanedClients).length;
  } catch (error) {
    console.error('❌ Erro ao limpar clientes manuais:', error);
    return 0;
  }
};
