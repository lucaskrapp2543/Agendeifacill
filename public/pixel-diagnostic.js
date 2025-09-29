// Script de diagnóstico para Facebook Pixel
console.log('🔍 Iniciando diagnóstico do Facebook Pixel...');

// 1. Verificar se o pixel está carregado
const checkPixel = () => {
  console.log('📊 Status do Facebook Pixel:');
  console.log('- window.fbq existe:', typeof window.fbq !== 'undefined');
  console.log('- window._fbq existe:', typeof window._fbq !== 'undefined');

  if (window.fbq) {
    console.log('✅ Facebook Pixel carregado');
    return true;
  } else {
    console.log('❌ Facebook Pixel NÃO carregado');
    return false;
  }
};

// 2. Verificar scripts do Facebook
const checkScripts = () => {
  const scripts = document.querySelectorAll('script');
  let facebookScripts = 0;

  scripts.forEach(script => {
    if (script.src && script.src.includes('facebook.net')) {
      facebookScripts++;
      console.log('📜 Script Facebook encontrado:', script.src);
    }
  });

  console.log(`📊 Total de scripts Facebook: ${facebookScripts}`);
  return facebookScripts > 0;
};

// 3. Verificar conectividade
const checkConnectivity = async () => {
  try {
    const response = await fetch('https://connect.facebook.net/en_US/fbevents.js', {
      method: 'HEAD',
      mode: 'no-cors'
    });
    console.log('🌐 Conectividade com Facebook: ✅ OK');
    return true;
  } catch (error) {
    console.log('🌐 Conectividade com Facebook: ❌ ERRO');
    console.error('Erro:', error);
    return false;
  }
};

// 4. Verificar Service Worker
const checkServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      console.log(`🔧 Service Workers ativos: ${registrations.length}`);
      registrations.forEach((registration, index) => {
        console.log(`  - SW ${index + 1}: ${registration.scope}`);
      });
    });
  } else {
    console.log('🔧 Service Worker: Não suportado');
  }
};

// 5. Verificar cache
const checkCache = () => {
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      console.log(`💾 Caches ativos: ${cacheNames.length}`);
      cacheNames.forEach(cacheName => {
        console.log(`  - Cache: ${cacheName}`);
      });
    });
  } else {
    console.log('💾 Cache API: Não suportada');
  }
};

// 6. Executar diagnóstico completo
const runDiagnostic = async () => {
  console.log('🚀 Executando diagnóstico completo...');

  const pixelLoaded = checkPixel();
  const scriptsFound = checkScripts();
  const connectivity = await checkConnectivity();

  checkServiceWorker();
  checkCache();

  // Resumo
  console.log('\n📋 RESUMO DO DIAGNÓSTICO:');
  console.log(`✅ Pixel carregado: ${pixelLoaded}`);
  console.log(`✅ Scripts encontrados: ${scriptsFound}`);
  console.log(`✅ Conectividade: ${connectivity}`);

  if (pixelLoaded && scriptsFound && connectivity) {
    console.log('🎉 Facebook Pixel funcionando perfeitamente!');
  } else {
    console.log('⚠️ Facebook Pixel com problemas - verificar logs acima');
  }
};

// Executar diagnóstico
runDiagnostic();

// Exportar função para uso manual
window.diagnosticFacebookPixel = runDiagnostic;
