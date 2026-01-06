import React from 'react';

const WhatsAppButton = () => {
  // Número do WhatsApp (48991484275) - adicionar código do país 55
  const whatsappNumber = '5548991484275';
  const message = 'Quero saber melhor sobre agendei facil vim pelo site';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-[9999] transform hover:scale-110 transition-transform duration-300 shadow-lg rounded-full block"
      style={{ position: 'fixed' }}
      aria-label="Contato WhatsApp"
    >
      <div className="relative group">
        <img 
          src="/wppicon.png" 
          alt="WhatsApp" 
          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14"
        />
        <span className="absolute -top-10 right-0 bg-black/80 backdrop-blur-sm text-white text-[10px] sm:text-xs py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
          Fale Conosco
        </span>
      </div>
    </a>
  );
};

export default WhatsAppButton; 