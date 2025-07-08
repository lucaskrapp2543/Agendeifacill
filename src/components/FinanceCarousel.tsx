import React, { useState, useEffect } from 'react';

const FinanceCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    { image: '/finan1.png', alt: 'Finanças 1' },
    { image: '/finan2.png', alt: 'Finanças 2' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === 0 ? 1 : 0));
    }, 7000);

    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="relative h-[500px] overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.alt}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.endsWith('.png')) {
                  target.src = target.src.replace('.png', '.svg');
                }
              }}
            />
          </div>
        ))}
      </div>
      
      {/* Botões de navegação */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-4 h-4 rounded-full transition-colors duration-300 ${
              index === currentSlide ? 'bg-blue-600' : 'bg-gray-400'
            }`}
            aria-label={`Ir para slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default FinanceCarousel; 