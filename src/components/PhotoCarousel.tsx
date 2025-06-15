import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoCarouselProps {
  customPhotos: (string | null)[];
  establishmentName: string;
}

export const PhotoCarousel: React.FC<PhotoCarouselProps> = ({ 
  customPhotos, 
  establishmentName 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fotos padrão
  const defaultPhotos = [
    '/barbeiro ft 1.png',
    '/barbeiro ft 2.png',
    '/barbeiro ft 3.png'
  ];

  // Combinar fotos personalizadas com padrão
  const photos = customPhotos.map((customPhoto, index) => 
    customPhoto || defaultPhotos[index]
  ).filter(Boolean);

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

  if (photos.length === 0) return null;

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-8">
      {/* Container da imagem */}
      <div className="relative h-64 md:h-80 rounded-lg overflow-hidden bg-gray-100 shadow-lg">
        <img
          src={photos[currentIndex]}
          alt={`${establishmentName} - Foto ${currentIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-500"
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