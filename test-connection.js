// Script simples para testar conexão com Supabase
// Execute com: node test-connection.js

console.log('🔍 Testando conexão com Supabase...\n');

// Simular uma busca HTTP direta
const testSupabaseConnection = async () => {
  try {
    // Tentar fazer uma requisição HTTP simples para testar
    const response = await fetch('http://localhost:5173/api/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Status da resposta:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Resposta:', data);
    } else {
      console.log('❌ Erro na resposta:', response.statusText);
    }
    
  } catch (error) {
    console.log('❌ Erro de conexão:', error.message);
  }
};

// Testar se o servidor está rodando
const testServer = async () => {
  try {
    const response = await fetch('http://localhost:5173/', {
      method: 'GET'
    });
    
    if (response.ok) {
      console.log('✅ Servidor está rodando em http://localhost:5173');
      
      // Testar algumas rotas específicas
      const testRoutes = [
        '/booking/2020',
        '/booking/1234',
        '/booking/5678'
      ];
      
      console.log('\n🧪 Testando rotas de booking:');
      
      for (const route of testRoutes) {
        try {
          const routeResponse = await fetch(`http://localhost:5173${route}`);
          console.log(`${route}: ${routeResponse.status} ${routeResponse.statusText}`);
        } catch (err) {
          console.log(`${route}: ❌ Erro - ${err.message}`);
        }
      }
      
    } else {
      console.log('❌ Servidor não está respondendo');
    }
    
  } catch (error) {
    console.log('❌ Servidor não está rodando:', error.message);
    console.log('💡 Execute: npm run dev');
  }
};

// Executar testes
testServer(); 