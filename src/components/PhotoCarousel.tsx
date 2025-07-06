import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoCarouselProps {
  photos: string[];
  logoUrl?: string;
  establishmentName?: string;
}

export const PhotoCarousel: React.FC<PhotoCarouselProps> = ({ photos, logoUrl, establishmentName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-play a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % photos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [photos.length]);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative">
      <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden bg-gray-100">
        {/* Imagem atual */}
        <div className="relative w-full h-full">
          <img
            src={photos[currentIndex]}
            alt={`Foto ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-500"
            onError={(e) => {
              // Se a imagem falhar, usa a foto padrão correspondente
              const target = e.target as HTMLImageElement;
              const defaultPhotos = ['/barbeiro ft 1.png', '/barbeiro ft 2.png', '/barbeiro ft 3.png'];
              target.src = defaultPhotos[currentIndex];
            }}
          />
          
          {/* Overlay escuro para melhor contraste dos botões */}
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        </div>

        {/* Botão Anterior */}
        <button
          onClick={goToPrevious}
          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Botão Próximo */}
        <button
          onClick={goToNext}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
          aria-label="Próxima foto"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Indicadores (bolinhas) - No lado esquerdo */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-10">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-white'
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
              aria-label={`Ir para foto ${index + 1}`}
            />
          ))}
        </div>

        {/* Contador */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
          {currentIndex + 1} / {photos.length}
        </div>
      </div>

      {/* Logo do estabelecimento - Responsiva */}
      <div className="flex justify-center">
        <div className="relative -mt-16 md:-mt-20 mb-4 md:mb-8">
          <img
            src={logoUrl || '/logoagendamento.png'}
            alt={`Logo ${establishmentName || 'do estabelecimento'}`}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/logoagendamento.png';
            }}
          />
        </div>
      </div>
    </div>
  );
}; 