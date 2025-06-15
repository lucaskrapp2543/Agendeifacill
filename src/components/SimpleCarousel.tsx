import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SimpleCarouselProps {
  establishmentName: string;
}

export const SimpleCarousel: React.FC<SimpleCarouselProps> = ({ 
  establishmentName 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // SEMPRE usar fotos padrão para teste
  const photos = [
    '/barbeiro ft 1.png',
    '/barbeiro ft 2.png',
    '/barbeiro ft 3.png'
  ];

  console.log('🧪 SimpleCarousel - Sempre usando fotos padrão:', photos);

  // Auto-play: trocar foto a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === photos.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [photos.length]);

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? photos.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex === photos.length - 1 ? 0 : currentIndex + 1);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-8">
      {/* Banner de teste */}
      <div className="bg-green-500 text-white text-center py-2 mb-4 rounded font-bold">
        ✅ TESTE SIMPLES: Carrossel funcionando com fotos padrão
      </div>
      
      {/* Container da imagem */}
      <div className="relative h-64 md:h-80 rounded-lg overflow-hidden bg-gray-100 shadow-lg">
        <img
          src={photos[currentIndex]}
          alt={`${establishmentName} - Foto ${currentIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-500"
          onError={(e) => {
            console.error('❌ Erro ao carregar imagem:', photos[currentIndex]);
          }}
          onLoad={() => {
            console.log('✅ Imagem carregada:', photos[currentIndex]);
          }}
        />
        
        {/* Overlay com gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        {/* Botões de navegação */}
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
          aria-label="Próxima foto"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      
      {/* Indicadores de posição */}
      <div className="flex justify-center mt-4 space-x-2">
        {photos.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              index === currentIndex 
                ? 'bg-primary scale-110' 
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Ir para foto ${index + 1}`}
          />
        ))}
      </div>
      
      {/* Contador de fotos */}
      <div className="text-center mt-2">
        <span className="text-sm text-gray-500">
          {currentIndex + 1} de {photos.length}
        </span>
      </div>
    </div>
  );
}; 