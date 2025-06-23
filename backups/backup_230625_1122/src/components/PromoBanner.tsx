import React from 'react';

export const PromoBanner = () => {
  return (
    <div className="w-full">
      <img 
        src="/2.svg" 
        alt="Agora agendar ficou fácil - AgendaFácil" 
        className="w-full h-auto block mx-auto mb-8 border-0"
        style={{ backgroundColor: 'transparent', border: 'none', outline: 'none' }}
      />
      <img 
        src="/pcemobile.png" 
        alt="PC e Mobile - AgendaFácil" 
        className="w-full h-auto block mx-auto mb-12 border-0 max-w-4xl"
        style={{ backgroundColor: 'transparent', border: 'none', outline: 'none' }}
      />
    </div>
  );
};
