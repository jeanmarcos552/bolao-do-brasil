'use client';
import { useEffect, useState } from 'react';

type Slide = { src: string; alt: string };

const DEFAULT_SLIDES: Slide[] = [
  { src: '/images/ronal_beijando_a_taca.jpg', alt: 'Ronaldo beijando a taça da Copa do Mundo' },
];

export default function BrasilCarousel({
  slides = DEFAULT_SLIDES,
  caption = 'Brasil tem 5 estrelas',
}: { slides?: Slide[]; caption?: string } = {}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 4500);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="relative rounded-md overflow-hidden h-48 sm:h-64 mt-6 select-none">
      {slides.map(({ src, alt }, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`} />
      ))}

      <div className="absolute inset-0" style={{ background: 'rgba(0, 80, 31, 0.65)' }} />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className="text-amarelo text-3xl tracking-[0.4em] drop-shadow-lg">★★★★★</span>
        <span className="text-amarelo font-extrabold text-xl sm:text-2xl tracking-widest uppercase drop-shadow-lg">
          {caption}
        </span>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-opacity ${i === current ? 'bg-amarelo opacity-100' : 'bg-white opacity-50'}`}
              aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
