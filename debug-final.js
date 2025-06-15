import { createClient } from '@supabase/supabase-js';

// Usar as mesmas configurações do projeto
const supabaseUrl = 'https://your-project.supabase.co'; // Substitua pela sua URL
const supabaseKey = 'your-anon-key'; // Substitua pela sua chave

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCarousel() {
  console.log('🔍 DEBUG FINAL - Verificando carrossel de fotos');
  console.log('================================================');
  
  try {
    // Teste 1: Verificar se as colunas existem
    console.log('\n📊 TESTE 1: Verificando se as colunas foram criadas...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'establishments' 
          AND column_name LIKE 'custom_photo%'
          ORDER BY column_name;
        `
      });
    
    if (columnsError) {
      console.log('❌ Erro ao verificar colunas:', columnsError);
    } else {
      console.log('✅ Colunas encontradas:', columns);
    }
    
    // Teste 2: Buscar estabelecimento específico
    console.log('\n📊 TESTE 2: Buscando estabelecimento código 1010...');
    const { data: establishment, error: estError } = await supabase
      .from('establishments')
      .select('id, name, code, custom_photo_1_url, custom_photo_2_url, custom_photo_3_url')
      .eq('code', '1010')
      .single();
    
    if (estError) {
      console.log('❌ Erro ao buscar estabelecimento:', estError);
    } else {
      console.log('✅ Estabelecimento encontrado:', establishment);
      console.log('🖼️ URLs das fotos:', {
        foto1: establishment.custom_photo_1_url,
        foto2: establishment.custom_photo_2_url,
        foto3: establishment.custom_photo_3_url
      });
    }
    
    // Teste 3: Simular lógica do carrossel
    console.log('\n📊 TESTE 3: Simulando lógica do carrossel...');
    const customPhotos = [
      establishment?.custom_photo_1_url,
      establishment?.custom_photo_2_url,
      establishment?.custom_photo_3_url
    ];
    
    const defaultPhotos = [
      '/barbeiro ft 1.png',
      '/barbeiro ft 2.png',
      '/barbeiro ft 3.png'
    ];
    
    const photos = customPhotos.map((customPhoto, index) => 
      customPhoto || defaultPhotos[index]
    ).filter(Boolean);
    
    console.log('📷 Fotos personalizadas:', customPhotos);
    console.log('📷 Fotos padrão:', defaultPhotos);
    console.log('📷 Fotos finais do carrossel:', photos);
    console.log('📊 Total de fotos:', photos.length);
    
    if (photos.length === 0) {
      console.log('❌ PROBLEMA: Nenhuma foto para exibir!');
    } else {
      console.log('✅ Carrossel deveria funcionar com', photos.length, 'fotos');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar apenas se estiver no navegador
if (typeof window !== 'undefined') {
  debugCarousel();
} else {
  console.log('Execute este script no console do navegador');
} 