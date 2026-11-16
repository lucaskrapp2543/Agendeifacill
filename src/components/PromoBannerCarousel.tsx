import { useEffect, useRef, useState } from 'react';

export type PromoBannerSlide = {
  key: string;
  mobile: string;
  mobileWebp?: string;
  desktop?: string;
  desktopWebp?: string;
};

type PromoBannerCarouselProps = {
  slides: PromoBannerSlide[];
  onSlideClick: (key: string) => void;
};

/**
 * Banner promocional do topo de "Meus agendamentos".
 *
 * Fica separado do painel de propósito: a troca automática a cada 10s redesenha SÓ o banner,
 * e não a tela inteira (a agenda). Mesmo visual e mesmas regras de antes:
 * - troca sozinho a cada 10s;
 * - setas e bolinhas trocam na hora e pausam a troca automática por 45s.
 */
export const PromoBannerCarousel = ({ slides, onSlideClick }: PromoBannerCarouselProps) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const pausedUntilRef = useRef<number>(0);
  const slidesLengthRef = useRef<number>(slides.length);
  slidesLengthRef.current = slides.length;

  // Se um banner sumiu (ex.: conectou o WhatsApp), não deixa apontar para um slide que não existe.
  useEffect(() => {
    if (slides.length > 0 && currentIdx >= slides.length) {
      setCurrentIdx(0);
    }
  }, [slides.length, currentIdx]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const len = slidesLengthRef.current;
      if (len === 0) return;
      setCurrentIdx((prev) => (prev + 1) % len);
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const goTo = (newIdx: number) => {
    pausedUntilRef.current = Date.now() + 45000;
    setCurrentIdx(newIdx);
  };

  if (slides.length === 0) return null;
  const safeIdx = currentIdx < slides.length ? currentIdx : 0;

  return (
    <div className="-mx-3 sm:mx-0 relative overflow-hidden sm:rounded-xl shadow-md">
      {/* Técnica clássica: inner tem N*100% de largura, cada slide 1/N */}
      <div
        style={{
          display: 'flex',
          width: `${slides.length * 100}%`,
          transform: `translateX(-${safeIdx * (100 / slides.length)}%)`,
          transition: 'transform 0.5s ease-in-out',
        }}
      >
        {slides.map((slide, i) => (
          <picture
            key={i}
            style={{ width: `${100 / slides.length}%`, display: 'block', flexShrink: 0 }}
            onClick={() => onSlideClick(slide.key)}
            className="cursor-pointer"
          >
            {slide.desktopWebp && (
              <source media="(min-width: 768px)" type="image/webp" srcSet={slide.desktopWebp} />
            )}
            {slide.desktop && (
              <source media="(min-width: 768px)" srcSet={slide.desktop} />
            )}
            {slide.mobileWebp && (
              <source type="image/webp" srcSet={slide.mobileWebp} />
            )}
            <img
              src={slide.mobile}
              alt={`Promo ${i + 1}`}
              draggable={false}
              className="w-full h-auto"
            />
          </picture>
        ))}
      </div>

      {/* Seta esquerda */}
      <button
        type="button"
        onClick={() => goTo((safeIdx - 1 + slides.length) % slides.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white text-lg font-bold transition-colors"
        aria-label="Anterior"
      >
        ‹
      </button>

      {/* Seta direita */}
      <button
        type="button"
        onClick={() => goTo((safeIdx + 1) % slides.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white text-lg font-bold transition-colors"
        aria-label="Próximo"
      >
        ›
      </button>

      {/* Bolinhas indicadoras */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all ${i === safeIdx ? 'bg-white scale-125' : 'bg-white/50'}`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
