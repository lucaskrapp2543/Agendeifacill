import React from 'react';

export const PromoBanner = () => {
  return (
    <div className="relative w-full max-w-6xl mx-auto mb-12">
      {/* Sua imagem personalizada - ei.svg */}
      <img 
        src="/ei.svg" 
        alt="Agora agendar ficou fácil - AgendaFácil" 
        className="w-full h-auto rounded-2xl shadow-2xl"
        style={{ maxHeight: '700px', objectFit: 'contain' }}
      />
      
      {/* Efeito de brilho sutil ao redor */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-2xl blur-xl -z-10 opacity-50"></div>
    </div>
  );
};
