import React from 'react';

interface TestCarouselProps {
  establishmentName: string;
}

export const TestCarousel: React.FC<TestCarouselProps> = ({ establishmentName }) => {
  console.log('🔥 TestCarousel - RENDERIZANDO AGORA!');
  
  return (
    <div style={{
      width: '100%',
      maxWidth: '600px',
      margin: '0 auto 32px auto',
      padding: '20px',
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '8px',
      textAlign: 'center'
    }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        🚨 TESTE DE RENDERIZAÇÃO
      </h2>
      <p>Se você está vendo isso, o componente está funcionando!</p>
      <p style={{ marginTop: '8px' }}>Estabelecimento: {establishmentName}</p>
      
      {/* Teste com uma imagem simples */}
      <div style={{ marginTop: '16px' }}>
        <img 
          src="/barbeiro ft 1.png" 
          alt="Teste"
          style={{
            width: '256px',
            height: '192px',
            margin: '0 auto',
            objectFit: 'cover',
            borderRadius: '8px'
          }}
          onLoad={() => console.log('✅ Imagem carregada com sucesso!')}
          onError={() => console.log('❌ Erro ao carregar imagem')}
        />
      </div>
    </div>
  );
}; 